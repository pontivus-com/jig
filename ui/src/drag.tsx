import {
  DragDropProvider,
  DragOverlay,
  useDroppable,
} from "@dnd-kit/react";
import { isSortable } from "@dnd-kit/react/sortable";
import {
  useState,
  type ReactNode,
  type Ref,
} from "react";
import type { Task } from "../../src/core/task";

export interface TaskDragProviderProps {
  readonly tasks: readonly Task[];
  readonly children: ReactNode;
  readonly onMove: (
    taskId: string,
    destinationDate: string,
    destinationIndex: number,
  ) => Promise<boolean>;
}

export function TaskDragProvider({
  tasks,
  children,
  onMove,
}: TaskDragProviderProps): React.ReactElement {
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const activeTask =
    activeTaskId === null
      ? null
      : tasks.find((task) => task.id === activeTaskId) ?? null;

  return (
    <DragDropProvider
      onDragStart={({ operation }) => {
        setActiveTaskId(
          operation.source === null
            ? null
            : String(operation.source.id),
        );
      }}
      onDragEnd={(event) => {
        const { source, target } = event.operation;
        setActiveTaskId(null);

        if (event.canceled || source === null || target === null) {
          return;
        }

        const taskId = String(source.id);
        const task = tasks.find((candidate) => candidate.id === taskId);
        if (task === undefined || task.completed_at !== null) {
          return;
        }

        let destinationDate: string | null = null;
        let destinationIndex: number | null = null;

        if (
          isSortable(source) &&
          (source.group !== source.initialGroup ||
            source.index !== source.initialIndex)
        ) {
          destinationDate = String(source.group);
          destinationIndex = source.index;
        } else if (isSortable(target)) {
          destinationDate = String(target.group);
          destinationIndex = target.index;
        } else if (
          target.type === "jig-date-column" &&
          typeof target.data?.date === "string"
        ) {
          destinationDate = target.data.date;
          destinationIndex = tasks.filter(
            (candidate) =>
              candidate.completed_at === null &&
              candidate.scheduled_date === destinationDate &&
              candidate.id !== taskId,
          ).length;
        }

        if (
          destinationDate === null ||
          destinationIndex === null ||
          (destinationDate === task.scheduled_date &&
            destinationIndex === task.position)
        ) {
          return;
        }

        void onMove(taskId, destinationDate, destinationIndex);
      }}
    >
      {children}
      <DragOverlay>
        {activeTask === null ? null : (
          <div className="jig-drag-overlay" aria-hidden="true">
            {activeTask.title}
          </div>
        )}
      </DragOverlay>
    </DragDropProvider>
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
  const { ref, isDropTarget } = useDroppable({
    id: `jig-date-${date}`,
    type: "jig-date-column",
    accept: "jig-task",
    data: { date },
  });

  return (
    <div
      ref={ref as Ref<HTMLDivElement>}
      className={[
        className,
        "jig-date-drop-zone",
        isDropTarget ? "jig-date-drop-zone-active" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-date={date}
    >
      {children}
    </div>
  );
}
