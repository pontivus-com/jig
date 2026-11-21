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
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from "react";
import type { Task } from "../../src/core/task";
import { outstandingForDate } from "../../src/core/planning";
import { todayCivilDate } from "./dates";
import { TaskDragOverlayCard } from "./task-row";

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

export interface TaskDragScopePresentationProps {
  readonly children: ReactNode;
  readonly activeTaskId?: string | null;
  readonly destinationDate?: string | null;
  readonly destinationIndex?: number | null;
}

export function TaskDragScopePresentation({
  children,
  activeTaskId = null,
  destinationDate = null,
  destinationIndex = null,
}: TaskDragScopePresentationProps): React.ReactElement {
  return (
    <div
      className="jig-task-drag-scope"
      data-jig-drag-active={activeTaskId === null ? "false" : "true"}
      data-jig-drop-date={destinationDate ?? ""}
      data-jig-drop-index={destinationIndex ?? ""}
    >
      {children}
    </div>
  );
}

export interface TaskDragProviderProps {
  readonly tasks: readonly Task[];
  readonly children: ReactNode;
  readonly onMove: (
    taskId: string,
    destinationDate: string,
    destinationIndex: number,
  ) => Promise<boolean>;
  readonly onDragActiveChange?: ((active: boolean) => void) | undefined;
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
  onDragActiveChange,
}: TaskDragProviderProps): React.ReactElement {
  const [state, setState] = useState<TaskDragState>(EMPTY_DRAG_STATE);

  useEffect(
    () => () => onDragActiveChange?.(false),
    [onDragActiveChange],
  );
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
        onDragActiveChange?.(taskId !== null);
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
        onDragActiveChange?.(false);

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
        {children}
        <DragOverlay>
          {activeTask === null ? null : (
            <TaskDragOverlayCard task={activeTask} />
          )}
        </DragOverlay>
      </TaskDragContext.Provider>
    </DragDropProvider>
  );
}

export interface TaskDragBinding {
  readonly rowRef: (element: HTMLLIElement | null) => void;
  readonly dragHandleRef: (element: HTMLSpanElement | null) => void;
  readonly isDragging: boolean;
}

export interface TaskDraggableRegistrationProps {
  readonly task: Task;
  readonly index: number;
  readonly onBindingChange: (binding: TaskDragBinding | null) => void;
}

export function TaskDraggableRegistration({
  task,
  index,
  onBindingChange,
}: TaskDraggableRegistrationProps): null {
  const draggable = useDraggable({
    id: task.id,
    type: "jig-task",
    data: {
      date: task.scheduled_date,
      index,
    },
  });

  const draggableRef = useRef(draggable.ref);
  const draggableHandleRef = useRef(draggable.handleRef);
  draggableRef.current = draggable.ref;
  draggableHandleRef.current = draggable.handleRef;

  const rowRef = useCallback(
    (element: HTMLLIElement | null): void => {
      draggableRef.current(element);
    },
    [],
  );
  const dragHandleRef = useCallback(
    (element: HTMLSpanElement | null): void => {
      draggableHandleRef.current(element);
    },
    [],
  );

  useLayoutEffect(() => {
    onBindingChange({
      rowRef,
      dragHandleRef,
      isDragging: draggable.isDragging,
    });
    return () => onBindingChange(null);
  }, [
    dragHandleRef,
    draggable.isDragging,
    onBindingChange,
    rowRef,
  ]);

  return null;
}

export interface TaskInsertionSlotPresentationProps {
  readonly slotRef?: Ref<HTMLLIElement> | undefined;
  readonly slotIndex?: number | undefined;
  readonly isDropTarget?: boolean | undefined;
  readonly isPastDate?: boolean | undefined;
}

export function TaskInsertionSlotPresentation({
  slotRef,
  slotIndex,
  isDropTarget = false,
  isPastDate = false,
}: TaskInsertionSlotPresentationProps): React.ReactElement {
  return (
    <li
      {...(slotRef === undefined ? {} : { ref: slotRef })}
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
      {...(slotIndex === undefined
        ? {}
        : {
            "data-jig-drop-slot": slotIndex,
            "data-jig-drop-allowed": isPastDate ? "false" : "true",
          })}
      aria-hidden="true"
    >
      <span className="jig-task-drop-indicator" />
    </li>
  );
}

interface TaskInsertionSlotBinding {
  readonly slotRef: (element: HTMLLIElement | null) => void;
  readonly isDropTarget: boolean;
}

interface TaskInsertionSlotRegistrationProps {
  readonly date: string;
  readonly slotIndex: number;
  readonly onBindingChange: (
    binding: TaskInsertionSlotBinding | null,
  ) => void;
}

function TaskInsertionSlotRegistration({
  date,
  slotIndex,
  onBindingChange,
}: TaskInsertionSlotRegistrationProps): null {
  const { ref, isDropTarget } = useDroppable({
    id: `jig-slot-${date}-${slotIndex}`,
    type: "jig-insertion-slot",
    accept: "jig-task",
    data: {
      date,
      slot_index: slotIndex,
    },
  });

  const droppableRef = useRef(ref);
  droppableRef.current = ref;
  const slotRef = useCallback(
    (element: HTMLLIElement | null): void => {
      droppableRef.current(element);
    },
    [],
  );

  useLayoutEffect(() => {
    onBindingChange({ slotRef, isDropTarget });
    return () => onBindingChange(null);
  }, [isDropTarget, onBindingChange, slotRef]);

  return null;
}

export interface TaskInsertionSlotProps {
  readonly date: string;
  readonly slotIndex: number;
  readonly isInteractive: boolean;
}

export function TaskInsertionSlot({
  date,
  slotIndex,
  isInteractive,
}: TaskInsertionSlotProps): React.ReactElement {
  const [binding, setBinding] =
    useState<TaskInsertionSlotBinding | null>(null);
  const isPastDate = date < todayCivilDate();

  return (
    <>
      {isInteractive ? (
        <TaskInsertionSlotRegistration
          key="registration"
          date={date}
          slotIndex={slotIndex}
          onBindingChange={setBinding}
        />
      ) : null}
      <TaskInsertionSlotPresentation
        key="presentation"
        {...(binding === null ? {} : { slotRef: binding.slotRef })}
        slotIndex={slotIndex}
        isDropTarget={isInteractive && (binding?.isDropTarget ?? false)}
        isPastDate={isPastDate}
      />
    </>
  );
}

export interface DateDropZoneProps {
  readonly date: string;
  readonly children: ReactNode;
  readonly isInteractive: boolean;
  readonly className?: string;
}

export function DateDropZone({
  date,
  children,
  isInteractive,
  className,
}: DateDropZoneProps): React.ReactElement {
  const state = useTaskDragState();
  const crossDateActive =
    isInteractive &&
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
