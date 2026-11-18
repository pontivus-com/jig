import {
  DragDropContext,
  Droppable,
  type DragStart,
  type DragUpdate,
  type DropResult,
} from "@hello-pangea/dnd";
import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";
import type { Task } from "../../src/core/task";
import { outstandingForDate } from "../../src/core/planning";
import { TaskCardPreview } from "./task-row";

export interface TaskDropIntent {
  readonly task_id: string;
  readonly destination_date: string;
  readonly destination_index: number;
}

interface TaskDragState {
  readonly activeTaskId: string | null;
  readonly sourceDate: string | null;
  readonly intent: TaskDropIntent | null;
}

const EMPTY_DRAG_STATE: TaskDragState = {
  activeTaskId: null,
  sourceDate: null,
  intent: null,
};

const TaskDragContext = createContext<TaskDragState>(EMPTY_DRAG_STATE);

export function useTaskDragState(): TaskDragState {
  return useContext(TaskDragContext);
}

export interface TaskDragProviderProps {
  readonly tasks: readonly Task[];
  readonly children: ReactNode;
  readonly onMove: (
    taskId: string,
    destinationDate: string,
    destinationIndex: number,
  ) => Promise<boolean>;
}

function intentFor(
  taskId: string,
  update: DragUpdate | DropResult,
): TaskDropIntent | null {
  const destination = update.destination;
  if (destination === null || destination === undefined) {
    return null;
  }
  return {
    task_id: taskId,
    destination_date: destination.droppableId,
    destination_index: destination.index,
  };
}

export function TaskDragProvider({
  tasks,
  children,
  onMove,
}: TaskDragProviderProps): React.ReactElement {
  const [state, setState] = useState<TaskDragState>(EMPTY_DRAG_STATE);

  const onDragStart = (start: DragStart): void => {
    setState({
      activeTaskId: start.draggableId,
      sourceDate: start.source.droppableId,
      intent: {
        task_id: start.draggableId,
        destination_date: start.source.droppableId,
        destination_index: start.source.index,
      },
    });
  };

  const onDragUpdate = (update: DragUpdate): void => {
    setState((current) => ({
      ...current,
      intent: intentFor(update.draggableId, update),
    }));
  };

  const onDragEnd = (result: DropResult): void => {
    const destination = result.destination;
    setState(EMPTY_DRAG_STATE);

    if (result.reason !== "DROP" || destination === null) {
      return;
    }

    const task = tasks.find((candidate) => candidate.id === result.draggableId);
    if (task === undefined || task.completed_at !== null) {
      return;
    }

    const filteredDestination = outstandingForDate(
      tasks,
      destination.droppableId,
    ).filter((candidate) => candidate.id !== task.id);
    if (
      destination.index < 0 ||
      destination.index > filteredDestination.length
    ) {
      return;
    }

    if (
      result.source.droppableId === destination.droppableId &&
      result.source.index === destination.index
    ) {
      return;
    }

    void onMove(
      task.id,
      destination.droppableId,
      destination.index,
    );
  };

  return (
    <DragDropContext
      onDragStart={onDragStart}
      onDragUpdate={onDragUpdate}
      onDragEnd={onDragEnd}
    >
      <TaskDragContext.Provider value={state}>
        <div
          className="jig-task-drag-scope"
          data-jig-drop-date={state.intent?.destination_date ?? ""}
          data-jig-drop-index={state.intent?.destination_index ?? ""}
        >
          {children}
        </div>
      </TaskDragContext.Provider>
    </DragDropContext>
  );
}

export interface DateDropZoneProps {
  readonly date: string;
  readonly tasks: readonly Task[];
  readonly children: ReactNode;
  readonly className?: string;
}

export function DateDropZone({
  date,
  tasks,
  children,
  className,
}: DateDropZoneProps): React.ReactElement {
  const dragState = useTaskDragState();
  const outstanding = outstandingForDate(tasks, date).filter(
    (task) => task.id !== dragState.activeTaskId,
  );
  const emptyIntent =
    dragState.intent?.destination_date === date &&
    outstanding.length === 0;
  const crossDateActive =
    dragState.intent?.destination_date === date &&
    dragState.sourceDate !== null &&
    dragState.sourceDate !== date;

  return (
    <Droppable
      droppableId={date}
      type="jig-task"
      renderClone={(provided, snapshot, rubric) => {
        const task = tasks.find(
          (candidate) => candidate.id === rubric.draggableId,
        );
        return (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            className={snapshot.isDragging ? "jig-drag-clone-shell" : ""}
          >
            {task === undefined ? null : <TaskCardPreview task={task} />}
          </div>
        );
      }}
    >
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.droppableProps}
          className={[
            className,
            "jig-date-drop-zone",
            snapshot.isDraggingOver && crossDateActive
              ? "jig-date-drop-zone-active"
              : "",
            emptyIntent ? "jig-date-drop-zone-empty-target" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          data-date={date}
        >
          {children}
          {emptyIntent ? (
            <span
              className="jig-task-drop-indicator jig-task-drop-indicator-empty"
              aria-hidden="true"
            />
          ) : null}
          {provided.placeholder}
        </div>
      )}
    </Droppable>
  );
}
