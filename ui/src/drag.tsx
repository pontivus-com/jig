import {
  DragDropProvider,
  DragOverlay,
  useDraggable,
  useDroppable,
} from "@dnd-kit/react";
import {
  KeyboardSensor,
  PointerActivationConstraints,
  PointerSensor,
} from "@dnd-kit/dom";
import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";
import type { Task } from "../../src/core/task";
import { outstandingForDate } from "../../src/core/planning";
import { todayCivilDate } from "./dates";
import {
  TaskCardPreview,
  TaskRow,
  type TaskRowProps,
} from "./task-row";

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

function destinationIndexForSlot(
  task: Task,
  destinationDate: string,
  slotIndex: number,
): number {
  if (
    destinationDate === task.scheduled_date &&
    task.position !== null &&
    slotIndex > task.position
  ) {
    return slotIndex - 1;
  }
  return slotIndex;
}

function dropIntent(
  tasks: readonly Task[],
  taskId: string,
  target: {
    readonly type?: unknown;
    readonly data?: Readonly<Record<string, unknown>>;
  } | null,
): TaskDropIntent | null {
  if (target === null || target.type !== "jig-insertion-slot") {
    return null;
  }
  const date = target.data?.date;
  const slotIndex = target.data?.slot_index;
  if (
    typeof date !== "string" ||
    typeof slotIndex !== "number" ||
    !Number.isInteger(slotIndex) ||
    slotIndex < 0
  ) {
    return null;
  }

  const task = tasks.find((candidate) => candidate.id === taskId);
  if (task === undefined || task.completed_at !== null) {
    return null;
  }

  const destinationIndex = destinationIndexForSlot(
    task,
    date,
    slotIndex,
  );
  const available = outstandingForDate(tasks, date).filter(
    (candidate) => candidate.id !== task.id,
  ).length;
  if (destinationIndex < 0 || destinationIndex > available) {
    return null;
  }

  return {
    task_id: task.id,
    destination_date: date,
    destination_index: destinationIndex,
  };
}

export function TaskDragProvider({
  tasks,
  children,
  onMove,
}: TaskDragProviderProps): React.ReactElement {
  const [state, setState] = useState<TaskDragState>(EMPTY_DRAG_STATE);
  const activeTask =
    state.activeTaskId === null
      ? null
      : tasks.find((task) => task.id === state.activeTaskId) ?? null;

  return (
    <DragDropProvider
      sensors={(defaults) => [
        ...defaults.filter(
          (sensor) =>
            sensor !== PointerSensor &&
            sensor !== KeyboardSensor,
        ),
        PointerSensor.configure({
          activationConstraints: [
            new PointerActivationConstraints.Distance({ value: 6 }),
          ],
        }),
        KeyboardSensor.configure({
          offset: 8,
        }),
      ]}
      onDragStart={({ operation }) => {
        const taskId =
          operation.source === null
            ? null
            : String(operation.source.id);
        const task =
          taskId === null
            ? null
            : tasks.find((candidate) => candidate.id === taskId) ?? null;
        setState({
          activeTaskId: taskId,
          sourceDate: task?.scheduled_date ?? null,
          intent: null,
        });
      }}
      onDragOver={(event) => {
        event.preventDefault();
        const source = event.operation.source;
        const target = event.operation.target;
        if (source === null) {
          setState((current) => ({ ...current, intent: null }));
          return;
        }
        const intent = dropIntent(
          tasks,
          String(source.id),
          target,
        );
        setState((current) => ({ ...current, intent }));
      }}
      onDragEnd={(event) => {
        const source = event.operation.source;
        const target = event.operation.target;
        const intent =
          source === null
            ? null
            : dropIntent(tasks, String(source.id), target);
        setState(EMPTY_DRAG_STATE);

        if (event.canceled || source === null || intent === null) {
          return;
        }

        const task = tasks.find(
          (candidate) => candidate.id === intent.task_id,
        );
        if (
          task === undefined ||
          task.completed_at !== null ||
          (task.scheduled_date === intent.destination_date &&
            task.position === intent.destination_index)
        ) {
          return;
        }

        void onMove(
          intent.task_id,
          intent.destination_date,
          intent.destination_index,
        );
      }}
    >
      <TaskDragContext.Provider value={state}>
        <div
          className="jig-task-drag-scope"
          data-jig-drag-active={state.activeTaskId === null ? "false" : "true"}
          data-jig-drop-date={state.intent?.destination_date ?? ""}
          data-jig-drop-index={state.intent?.destination_index ?? ""}
        >
          {children}
        </div>
        <DragOverlay>
          {activeTask === null ? null : (
            <TaskCardPreview task={activeTask} />
          )}
        </DragOverlay>
      </TaskDragContext.Provider>
    </DragDropProvider>
  );
}

export interface DraggableTaskRowProps
  extends Omit<
    TaskRowProps,
    "rowRef" | "dragHandleRef" | "isDragging"
  > {
  readonly index: number;
}

export function DraggableTaskRow({
  task,
  index,
  ...rowProps
}: DraggableTaskRowProps): React.ReactElement {
  const draggable = useDraggable({
    id: task.id,
    type: "jig-task",
    data: {
      date: task.scheduled_date,
      index,
    },
  });

  const rowRef = (element: HTMLLIElement | null): void => {
    draggable.ref(element);
  };
  const dragHandleRef = (element: HTMLSpanElement | null): void => {
    draggable.handleRef(element);
  };

  return (
    <TaskRow
      {...rowProps}
      task={task}
      rowRef={rowRef}
      dragHandleRef={dragHandleRef}
      isDragging={draggable.isDragging}
    />
  );
}

export interface TaskInsertionSlotProps {
  readonly date: string;
  readonly slotIndex: number;
}

export function TaskInsertionSlot({
  date,
  slotIndex,
}: TaskInsertionSlotProps): React.ReactElement {
  const isPastDate = date < todayCivilDate();
  const { ref, isDropTarget } = useDroppable({
    id: `jig-slot-${date}-${slotIndex}`,
    type: "jig-insertion-slot",
    accept: "jig-task",
    data: {
      date,
      slot_index: slotIndex,
    },
  });

  const slotRef = (element: HTMLLIElement | null): void => {
    ref(element);
  };

  return (
    <li
      ref={slotRef}
      role="presentation"
      className={[
        "jig-task-insertion-slot",
        isDropTarget ? "jig-task-insertion-slot-active" : "",
        isPastDate ? "jig-task-insertion-slot-unavailable" : "",
        isPastDate && isDropTarget
          ? "jig-task-insertion-slot-unavailable-active"
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-jig-drop-slot={slotIndex}
      data-jig-drop-allowed={isPastDate ? "false" : "true"}
      aria-hidden="true"
    >
      <span className="jig-task-drop-indicator" />
    </li>
  );
}

export interface DateDropZoneProps {
  readonly date: string;
  readonly children: ReactNode;
  readonly className?: string;
}

export function DateDropZone({
  date,
  children,
  className,
}: DateDropZoneProps): React.ReactElement {
  const state = useTaskDragState();
  const crossDateActive =
    state.intent?.destination_date === date &&
    state.sourceDate !== null &&
    state.sourceDate !== date;
  const unavailableActive =
    crossDateActive && date < todayCivilDate();

  return (
    <div
      className={[
        className,
        "jig-date-drop-zone",
        crossDateActive ? "jig-date-drop-zone-active" : "",
        unavailableActive ? "jig-date-drop-zone-unavailable" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}
