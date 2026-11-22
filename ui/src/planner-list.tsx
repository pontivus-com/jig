import { List, useAnimatedLayout } from "@astryxdesign/core";
import { useRef, type Ref } from "react";
import type { RecurrenceSeries } from "../../src/core/recurrence";
import type { Priority, Task } from "../../src/core/task";
import { outstandingForDate } from "../../src/core/planning";
import {
  SortableTaskRow,
  TaskProspectiveFootprint,
  useTaskDragState,
} from "./drag";

export interface PlannerTaskListProps {
  readonly tasks: readonly Task[];
  readonly recurrences: readonly RecurrenceSeries[];
  readonly now: Date;
  readonly date: string;
  readonly selectedTask: Task | null;
  readonly onSelectTask: (task: Task) => void;
  readonly onEdit: (task: Task) => void;
  readonly onToggleComplete: (task: Task) => Promise<boolean>;
  readonly onSetPriority: (task: Task, priority: Priority) => Promise<boolean>;
  readonly onDelete: (task: Task) => void;
  readonly onMove: (
    taskId: string,
    destinationDate: string,
    destinationIndex: number,
  ) => Promise<boolean>;
}

interface PlannerSequenceRowProps
  extends Omit<
    PlannerTaskListProps,
    "tasks" | "recurrences" | "date" | "selectedTask"
  > {
  readonly task: Task;
  readonly recurrenceSeries: RecurrenceSeries | null;
  readonly index: number;
  readonly sortableIndex: number;
  readonly date: string;
  readonly sequenceLength: number;
  readonly isSelected: boolean;
}

interface PlannerTaskPresentationItem {
  readonly task: Task;
  readonly recurrenceSeries: RecurrenceSeries | null;
  readonly index: number;
  readonly sequenceLength: number;
}

type PlannerVisibleItem =
  | {
      readonly kind: "task";
      readonly item: PlannerTaskPresentationItem;
      readonly sortableIndex: number;
    }
  | {
      readonly kind: "prospective";
      readonly activeTaskId: string;
      readonly blockSize: number | null;
    };

interface PlannerTaskSequenceProps {
  readonly items: readonly PlannerVisibleItem[];
  readonly listRef: Ref<HTMLUListElement>;
  readonly animatedLayout: ReturnType<typeof useAnimatedLayout>;
  readonly renderTaskRow: (
    item: PlannerTaskPresentationItem,
    sortableIndex: number,
  ) => React.ReactNode;
}

function plannerTaskPresentationItems(
  tasks: readonly Task[],
  recurrences: readonly RecurrenceSeries[],
  date: string,
): readonly PlannerTaskPresentationItem[] {
  const outstanding = outstandingForDate(tasks, date);
  return outstanding.map((task, index) => ({
    task,
    recurrenceSeries:
      task.recurrence_series_id === null
        ? null
        : recurrences.find(
            (series) => series.id === task.recurrence_series_id,
          ) ?? null,
    index,
    sequenceLength: outstanding.length,
  }));
}

function projectedPlannerItems(
  items: readonly PlannerTaskPresentationItem[],
  date: string,
  drag: ReturnType<typeof useTaskDragState>,
): readonly PlannerVisibleItem[] {
  if (drag.prospective === null) {
    return items.map((item) => ({
      kind: "task" as const,
      item,
      sortableIndex: item.index,
    }));
  }

  const remaining = items
    .filter((item) => item.task.id !== drag.prospective?.activeTaskId)
    .map((item, index, sequence) => ({
      ...item,
      index,
      sequenceLength: sequence.length,
    }));

  const visible: PlannerVisibleItem[] = remaining.map((item, index) => ({
    kind: "task",
    item,
    sortableIndex: index,
  }));

  if (drag.prospective.destinationDate !== date) {
    return visible;
  }

  const destinationIndex = Math.min(
    drag.prospective.destinationIndex,
    visible.length,
  );
  visible.splice(destinationIndex, 0, {
    kind: "prospective",
    activeTaskId: drag.prospective.activeTaskId,
    blockSize: drag.activeBlockSize,
  });

  return visible.map((item, visualIndex) =>
    item.kind === "task"
      ? {
          ...item,
          sortableIndex: visualIndex,
        }
      : item,
  );
}

function PlannerTaskSequence({
  items,
  listRef,
  animatedLayout,
  renderTaskRow,
}: PlannerTaskSequenceProps): React.ReactElement {
  return (
    <List
      ref={listRef}
      animatedLayout={animatedLayout}
      density="compact"
      edge="padded"
      className="jig-task-card-list"
    >
      {items.map((visible) =>
        visible.kind === "prospective" ? (
          <TaskProspectiveFootprint
            key={`prospective-${visible.activeTaskId}`}
            blockSize={visible.blockSize}
          />
        ) : (
          <span key={visible.item.task.id} style={{ display: "contents" }}>
            {renderTaskRow(visible.item, visible.sortableIndex)}
          </span>
        ),
      )}
    </List>
  );
}

function PlannerSequenceRow({
  task,
  recurrenceSeries,
  now,
  index,
  sortableIndex,
  date,
  sequenceLength,
  isSelected,
  onSelectTask,
  onEdit,
  onToggleComplete,
  onSetPriority,
  onDelete,
  onMove,
}: PlannerSequenceRowProps): React.ReactElement {
  return (
    <SortableTaskRow
      task={task}
      recurrenceSeries={recurrenceSeries}
      now={now}
      index={sortableIndex}
      date={date}
      isSelected={isSelected}
      onSelect={() => onSelectTask(task)}
      onToggleComplete={() => {
        void onToggleComplete(task);
      }}
      onEdit={() => onEdit(task)}
      onSetPriority={(priority: Priority) => {
        void onSetPriority(task, priority);
      }}
      onDelete={() => onDelete(task)}
      {...(index > 0
        ? {
            onMoveUp: () => {
              void onMove(task.id, date, index - 1);
            },
          }
        : {})}
      {...(index < sequenceLength - 1
        ? {
            onMoveDown: () => {
              void onMove(task.id, date, index + 1);
            },
          }
        : {})}
    />
  );
}

export function PlannerTaskList(
  props: PlannerTaskListProps,
): React.ReactElement {
  const drag = useTaskDragState();
  const canonicalItems = plannerTaskPresentationItems(
    props.tasks,
    props.recurrences,
    props.date,
  );
  const items = projectedPlannerItems(
    canonicalItems,
    props.date,
    drag,
  );
  const listRef = useRef<HTMLUListElement>(null);
  const animatedLayout = useAnimatedLayout({ containerRef: listRef });

  return (
    <PlannerTaskSequence
      items={items}
      listRef={listRef}
      animatedLayout={animatedLayout}
      renderTaskRow={(item, sortableIndex) => (
        <PlannerSequenceRow
          task={item.task}
          recurrenceSeries={item.recurrenceSeries}
          now={props.now}
          index={item.index}
          sortableIndex={sortableIndex}
          date={props.date}
          sequenceLength={item.sequenceLength}
          isSelected={props.selectedTask?.id === item.task.id}
          onSelectTask={props.onSelectTask}
          onEdit={props.onEdit}
          onToggleComplete={props.onToggleComplete}
          onSetPriority={props.onSetPriority}
          onDelete={props.onDelete}
          onMove={props.onMove}
        />
      )}
    />
  );
}
