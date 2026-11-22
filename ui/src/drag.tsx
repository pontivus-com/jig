import {
  DragDropProvider,
  DragOverlay,
  useDroppable,
} from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import {
  KeyboardSensor,
  PointerActivationConstraints,
  PointerSensor,
} from "@dnd-kit/dom";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { RecurrenceSeries } from "../../src/core/recurrence";
import type { Task } from "../../src/core/task";
import {
  isActiveScheduleDate,
  outstandingForDate,
} from "../../src/core/planning";
import { todayCivilDate } from "./dates";
import {
  TaskDragOverlayCard,
  TaskRow,
  type TaskRowProps,
} from "./task-row";

export interface TaskProspectivePlacement {
  readonly activeTaskId: string;
  readonly destinationDate: string;
  readonly destinationIndex: number;
}

interface TaskDragState {
  readonly activeTaskId: string | null;
  readonly prospective: TaskProspectivePlacement | null;
  readonly activeBlockSize: number | null;
}

const EMPTY_DRAG_STATE: TaskDragState = {
  activeTaskId: null,
  prospective: null,
  activeBlockSize: null,
};

const TaskDragContext = createContext<TaskDragState>(EMPTY_DRAG_STATE);

export function useTaskDragState(): TaskDragState {
  return useContext(TaskDragContext);
}

export interface TaskDragProviderProps {
  readonly tasks: readonly Task[];
  readonly recurrences: readonly RecurrenceSeries[];
  readonly now: Date;
  readonly children: ReactNode;
  readonly onMove: (
    taskId: string,
    destinationDate: string,
    destinationIndex: number,
  ) => Promise<boolean>;
  readonly onDragActiveChange?: ((active: boolean) => void) | undefined;
}

interface DropTarget {
  readonly id: string | number;
  readonly type?: unknown;
  readonly data?: Readonly<Record<string, unknown>>;
}

interface DropTargetGeometry extends DropTarget {
  readonly element?: Element | undefined;
  readonly shape?: {
    readonly boundingRectangle: {
      readonly top: number;
      readonly right: number;
      readonly bottom: number;
      readonly left: number;
      readonly height: number;
    };
  } | undefined;
}

interface PointerPosition {
  readonly x: number;
  readonly y: number;
}

function pointerPlacement(
  tasks: readonly Task[],
  activeTaskId: string,
  pointer: PointerPosition,
  droppables: Iterable<DropTargetGeometry>,
): TaskProspectivePlacement | null {
  const activeTask = tasks.find((task) => task.id === activeTaskId);
  if (activeTask === undefined || activeTask.completed_at !== null) {
    return null;
  }

  const registered = Array.from(droppables);
  const dateTarget = registered.find((target) => {
    if (target.type !== "jig-date") {
      return false;
    }
    const shapeBounds = target.shape?.boundingRectangle;
    const liveBounds = target.element?.getBoundingClientRect();
    const bounds =
      liveBounds !== undefined && liveBounds.height > 0
        ? liveBounds
        : shapeBounds;
    return (
      bounds !== undefined &&
      pointer.x >= bounds.left &&
      pointer.x <= bounds.right &&
      pointer.y >= bounds.top &&
      pointer.y <= bounds.bottom
    );
  });
  const date = dateTarget?.data?.date;
  if (
    typeof date !== "string" ||
    !isActiveScheduleDate(todayCivilDate(), date)
  ) {
    return null;
  }

  const available = outstandingForDate(tasks, date).filter(
    (task) => task.id !== activeTaskId,
  );
  const tailTarget = registered.find((target) => {
    if (
      target.type !== "jig-date-tail-geometry" ||
      target.data?.date !== date
    ) {
      return false;
    }
    const shapeBounds = target.shape?.boundingRectangle;
    const liveBounds = target.element?.getBoundingClientRect();
    const bounds =
      liveBounds !== undefined && liveBounds.height > 0
        ? liveBounds
        : shapeBounds;
    return (
      bounds !== undefined &&
      pointer.x >= bounds.left &&
      pointer.x <= bounds.right &&
      pointer.y >= bounds.top &&
      pointer.y <= bounds.bottom
    );
  });
  if (tailTarget !== undefined) {
    return {
      activeTaskId,
      destinationDate: date,
      destinationIndex: available.length,
    };
  }

  const taskRects = registered
    .filter(
      (target) =>
        target.type === "jig-task" &&
        target.data?.date === date &&
        String(target.id) !== activeTaskId &&
        target.shape !== undefined,
    )
    .map((target) => {
      const bounds = target.shape?.boundingRectangle;
      if (bounds === undefined) {
        return null;
      }
      return {
        top: bounds.top,
        bottom: bounds.bottom,
        midpoint: bounds.top + bounds.height / 2,
      };
    })
    .filter(
      (
        bounds,
      ): bounds is {
        readonly top: number;
        readonly bottom: number;
        readonly midpoint: number;
      } => bounds !== null,
    )
    .sort((left, right) => left.top - right.top);

  const hoveredIndex = taskRects.findIndex(
    (bounds) =>
      pointer.y >= bounds.top &&
      pointer.y <= bounds.bottom,
  );

  const rawDestinationIndex =
    hoveredIndex >= 0
      ? activeTask.scheduled_date === date &&
        activeTask.position !== null
        ? activeTask.position <= hoveredIndex
          ? hoveredIndex + 1
          : hoveredIndex
        : hoveredIndex +
          (pointer.y >= (taskRects[hoveredIndex]?.midpoint ?? pointer.y)
            ? 1
            : 0)
      : taskRects.filter((bounds) => pointer.y >= bounds.midpoint).length;

  const destinationIndex = Math.min(
    available.length,
    rawDestinationIndex,
  );

  return {
    activeTaskId,
    destinationDate: date,
    destinationIndex,
  };
}

function targetPlacement(
  tasks: readonly Task[],
  activeTaskId: string,
  target: DropTarget | null,
): TaskProspectivePlacement | null {
  if (target === null) {
    return null;
  }

  const activeTask = tasks.find((task) => task.id === activeTaskId);
  if (activeTask === undefined || activeTask.completed_at !== null) {
    return null;
  }

  const date = target.data?.date;
  if (
    typeof date !== "string" ||
    !isActiveScheduleDate(todayCivilDate(), date)
  ) {
    return null;
  }

  const available = outstandingForDate(tasks, date).filter(
    (task) => task.id !== activeTaskId,
  );

  let destinationIndex: number;
  if (target.type === "jig-date") {
    destinationIndex = available.length;
  } else if (target.type === "jig-task") {
    const targetId = String(target.id);
    const targetIndex = available.findIndex(
      (task) => task.id === targetId,
    );
    const canonicalTargetIndex = target.data?.canonical_index;
    if (
      targetIndex < 0 ||
      typeof canonicalTargetIndex !== "number" ||
      !Number.isInteger(canonicalTargetIndex)
    ) {
      return null;
    }

    const afterTarget =
      activeTask.scheduled_date === date &&
      activeTask.position !== null &&
      activeTask.position < canonicalTargetIndex;
    destinationIndex = targetIndex + (afterTarget ? 1 : 0);
  } else {
    return null;
  }

  if (
    destinationIndex < 0 ||
    destinationIndex > available.length
  ) {
    return null;
  }

  return {
    activeTaskId,
    destinationDate: date,
    destinationIndex,
  };
}

const TaskPointerSensor = PointerSensor.configure({
  activationConstraints(event) {
    return event.pointerType === "touch"
      ? [
          new PointerActivationConstraints.Delay({
            value: 250,
            tolerance: 8,
          }),
        ]
      : [
          new PointerActivationConstraints.Distance({
            value: 6,
          }),
        ];
  },
  activatorElements(source) {
    return source.handle == null ? [] : [source.handle];
  },
});

export function TaskDragProvider({
  tasks,
  recurrences,
  now,
  children,
  onMove,
  onDragActiveChange,
}: TaskDragProviderProps): React.ReactElement {
  const [state, setState] = useState<TaskDragState>(EMPTY_DRAG_STATE);
  const prospectiveRef = useRef<TaskProspectivePlacement | null>(null);
  const pointerRef = useRef<PointerPosition | null>(null);

  const clearDrag = (): void => {
    prospectiveRef.current = null;
    pointerRef.current = null;
    setState(EMPTY_DRAG_STATE);
    onDragActiveChange?.(false);
  };

  useEffect(
    () => () => onDragActiveChange?.(false),
    [onDragActiveChange],
  );

  const activeTask =
    state.activeTaskId === null
      ? null
      : tasks.find((task) => task.id === state.activeTaskId) ?? null;
  const activeRecurrence =
    activeTask?.recurrence_series_id === null ||
    activeTask?.recurrence_series_id === undefined
      ? null
      : recurrences.find(
          (series) => series.id === activeTask.recurrence_series_id,
        ) ?? null;

  return (
    <DragDropProvider
      sensors={(defaults) => [
        ...defaults.filter(
          (sensor) =>
            sensor !== PointerSensor &&
            sensor !== KeyboardSensor,
        ),
        TaskPointerSensor,
        KeyboardSensor.configure({
          offset: 8,
        }),
      ]}
      onDragStart={({ operation }) => {
        pointerRef.current = null;
        const source = operation.source;
        const taskId = source === null ? null : String(source.id);
        const task =
          taskId === null
            ? null
            : tasks.find((candidate) => candidate.id === taskId) ?? null;
        if (task === null || task.completed_at !== null) {
          clearDrag();
          return;
        }

        const activeBlockSize =
          source?.element?.getBoundingClientRect().height ?? null;
        prospectiveRef.current = null;
        setState({
          activeTaskId: task.id,
          prospective: null,
          activeBlockSize,
        });
        onDragActiveChange?.(true);
      }}
      onDragMove={(event, manager) => {
        const source = event.operation.source;
        const { nativeEvent } = event;
        if (
          source === null ||
          !(nativeEvent instanceof PointerEvent)
        ) {
          if (nativeEvent instanceof KeyboardEvent) {
            pointerRef.current = null;
          }
          return;
        }

        const pointer = {
          x: nativeEvent.clientX,
          y: nativeEvent.clientY,
        };
        pointerRef.current = pointer;
        const prospective = pointerPlacement(
          tasks,
          String(source.id),
          pointer,
          manager.registry.droppables,
        );
        prospectiveRef.current = prospective;
        setState((current) => ({
          ...current,
          prospective,
        }));
      }}
      onDragOver={(event, manager) => {
        event.preventDefault();
        const source = event.operation.source;
        if (source === null) {
          prospectiveRef.current = null;
          setState((current) => ({
            ...current,
            prospective: null,
          }));
          return;
        }

        const pointer = pointerRef.current;
        const prospective =
          pointer === null
            ? targetPlacement(
                tasks,
                String(source.id),
                event.operation.target,
              )
            : pointerPlacement(
                tasks,
                String(source.id),
                pointer,
                manager.registry.droppables,
              );
        prospectiveRef.current = prospective;
        setState((current) => ({
          ...current,
          prospective,
        }));
      }}
      onDragEnd={(event) => {
        const prospective = prospectiveRef.current;
        const source = event.operation.source;
        clearDrag();

        if (
          event.canceled ||
          source === null ||
          prospective === null ||
          prospective.activeTaskId !== String(source.id)
        ) {
          return;
        }

        const task = tasks.find(
          (candidate) =>
            candidate.id === prospective.activeTaskId,
        );
        if (
          task === undefined ||
          task.completed_at !== null ||
          (task.scheduled_date === prospective.destinationDate &&
            task.position === prospective.destinationIndex)
        ) {
          return;
        }

        void onMove(
          prospective.activeTaskId,
          prospective.destinationDate,
          prospective.destinationIndex,
        );
      }}
    >
      <TaskDragContext.Provider value={state}>
        <div
          className="jig-task-drag-scope"
          data-jig-drag-active={state.activeTaskId === null ? "false" : "true"}
          data-jig-drop-date={state.prospective?.destinationDate ?? ""}
          data-jig-drop-index={state.prospective?.destinationIndex ?? ""}
        >
          {children}
        </div>
        <DragOverlay>
          {activeTask === null ? null : (
            <TaskDragOverlayCard
              task={activeTask}
              recurrenceSeries={activeRecurrence}
              now={now}
            />
          )}
        </DragOverlay>
      </TaskDragContext.Provider>
    </DragDropProvider>
  );
}

export interface SortableTaskRowProps
  extends Omit<
    TaskRowProps,
    "rowRef" | "dragHandleRef" | "isDragging"
  > {
  readonly index: number;
  readonly canonicalIndex: number;
  readonly date: string;
}

export function SortableTaskRow({
  task,
  index,
  canonicalIndex,
  date,
  ...rowProps
}: SortableTaskRowProps): React.ReactElement {
  const sortable = useSortable({
    id: task.id,
    type: "jig-task",
    accept: "jig-task",
    group: date,
    index,
    data: {
      date,
      index,
      canonical_index: canonicalIndex,
    },
    collisionPriority: 1,
  });

  const rowRef = (element: HTMLLIElement | null): void => {
    sortable.ref(element);
  };
  const dragHandleRef = (element: HTMLSpanElement | null): void => {
    sortable.handleRef(element);
  };

  return (
    <TaskRow
      {...rowProps}
      task={task}
      rowRef={rowRef}
      dragHandleRef={dragHandleRef}
      isDragging={sortable.isDragging}
    />
  );
}

export interface TaskProspectiveFootprintProps {
  readonly activeTaskId: string;
  readonly date: string;
  readonly destinationIndex: number;
  readonly blockSize: number | null;
}

export function TaskProspectiveFootprint({
  activeTaskId,
  date,
  destinationIndex,
  blockSize,
}: TaskProspectiveFootprintProps): React.ReactElement {
  return (
    <li
      className="jig-task-prospective-footprint"
      data-jig-prospective-footprint="true"
      aria-hidden="true"
      style={
        blockSize === null
          ? undefined
          : {
              blockSize: `${blockSize}px`,
              minBlockSize: `${blockSize}px`,
            }
      }
    />
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
  const isActiveDate =
    state.prospective?.destinationDate === date;
  const unavailableActive =
    isActiveDate && !isActiveScheduleDate(todayCivilDate(), date);
  const { ref, isDropTarget } = useDroppable({
    id: `jig-date-${date}`,
    type: "jig-date",
    accept: "jig-task",
    data: { date },
    collisionPriority: -1,
  });
  const { ref: tailGeometryRef } = useDroppable({
    id: `jig-date-tail-geometry-${date}`,
    type: "jig-date-tail-geometry",
    accept: "jig-task",
    data: { date },
    // Geometry probe only: the date container remains the semantic target.
    collisionPriority: -2,
  });
  return (
    <div
      ref={ref}
      className={[
        className,
        "jig-date-drop-zone",
        isActiveDate || isDropTarget
          ? "jig-date-drop-zone-active"
          : "",
        unavailableActive ? "jig-date-drop-zone-unavailable" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-jig-drop-date-container={date}
    >
      {children}
      <div
        ref={tailGeometryRef}
        className="jig-date-drop-tail"
        data-jig-drop-tail={date}
        aria-hidden="true"
      />
    </div>
  );
}
