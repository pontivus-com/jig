import { List, useAnimatedLayout } from "@astryxdesign/core";
import { Fragment, useRef, useState, type Ref } from "react";
import type { RecurrenceSeries } from "../../src/core/recurrence";
import type { Priority, Task } from "../../src/core/task";
import { outstandingForDate } from "../../src/core/planning";
import {
  TaskDraggableRegistration,
  TaskInsertionSlot,
  type TaskDragBinding,
} from "./drag";
import { TaskRow } from "./task-row";

export interface PlannerTaskListCanonicalCapabilities {
  readonly kind: "canonical";
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

export interface PlannerTaskListAdjacentCapabilities {
  readonly kind: "adjacent";
}

export type PlannerTaskListCapabilities =
  | PlannerTaskListCanonicalCapabilities
  | PlannerTaskListAdjacentCapabilities;

export interface PlannerTaskListProps {
  readonly tasks: readonly Task[];
  readonly recurrences: readonly RecurrenceSeries[];
  readonly now: Date;
  readonly date: string;
  readonly selectedTask: Task | null;
  readonly capabilities: PlannerTaskListCapabilities;
}

interface PlannerTaskPresentationItem {
  readonly task: Task;
  readonly recurrenceSeries: RecurrenceSeries | null;
  readonly index: number;
  readonly sequenceLength: number;
}

interface PlannerTaskSequenceProps {
  readonly items: readonly PlannerTaskPresentationItem[];
  readonly listRef: Ref<HTMLUListElement>;
  readonly animatedLayout: ReturnType<typeof useAnimatedLayout>;
  readonly renderInsertionSlot: (slotIndex: number) => React.ReactNode;
  readonly renderTaskRow: (
    item: PlannerTaskPresentationItem,
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

function PlannerTaskSequence({
  items,
  listRef,
  animatedLayout,
  renderInsertionSlot,
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
      {items.map((item) => (
        <Fragment key={item.task.id}>
          {renderInsertionSlot(item.index)}
          {renderTaskRow(item)}
        </Fragment>
      ))}
      {renderInsertionSlot(items.length)}
    </List>
  );
}

function PlannerSequenceRow({
  item,
  date,
  now,
  selectedTask,
  capabilities,
}: Readonly<{
  item: PlannerTaskPresentationItem;
  date: string;
  now: Date;
  selectedTask: Task | null;
  capabilities: PlannerTaskListCapabilities;
}>): React.ReactElement {
  const [dragBinding, setDragBinding] =
    useState<TaskDragBinding | null>(null);
  const isCanonical = capabilities.kind === "canonical";

  return (
    <>
      {isCanonical ? (
        <TaskDraggableRegistration
          key="registration"
          task={item.task}
          index={item.index}
          onBindingChange={setDragBinding}
        />
      ) : null}
      <TaskRow
        key="presentation"
        task={item.task}
        recurrenceSeries={item.recurrenceSeries}
        now={now}
        isSelected={selectedTask?.id === item.task.id}
        interaction={
          isCanonical
            ? {
                kind: "canonical",
                ...(dragBinding === null
                  ? {}
                  : {
                      rowRef: dragBinding.rowRef,
                      dragHandleRef: dragBinding.dragHandleRef,
                    }),
                isDragging: dragBinding?.isDragging ?? false,
                onSelect: () => capabilities.onSelectTask(item.task),
                onToggleComplete: () => {
                  void capabilities.onToggleComplete(item.task);
                },
                onEdit: () => capabilities.onEdit(item.task),
                onSetPriority: (priority: Priority) => {
                  void capabilities.onSetPriority(item.task, priority);
                },
                onDelete: () => capabilities.onDelete(item.task),
                ...(item.index > 0
                  ? {
                      onMoveUp: () => {
                        void capabilities.onMove(
                          item.task.id,
                          date,
                          item.index - 1,
                        );
                      },
                    }
                  : {}),
                ...(item.index < item.sequenceLength - 1
                  ? {
                      onMoveDown: () => {
                        void capabilities.onMove(
                          item.task.id,
                          date,
                          item.index + 1,
                        );
                      },
                    }
                  : {}),
              }
            : { kind: "adjacent" }
        }
      />
    </>
  );
}

export function PlannerTaskList(
  props: PlannerTaskListProps,
): React.ReactElement {
  const items = plannerTaskPresentationItems(
    props.tasks,
    props.recurrences,
    props.date,
  );
  const listRef = useRef<HTMLUListElement>(null);
  const animatedLayout = useAnimatedLayout({ containerRef: listRef });
  const isCanonical = props.capabilities.kind === "canonical";

  return (
    <PlannerTaskSequence
      items={items}
      listRef={listRef}
      animatedLayout={animatedLayout}
      renderInsertionSlot={(slotIndex) => (
        <TaskInsertionSlot
          date={props.date}
          slotIndex={slotIndex}
          isInteractive={isCanonical}
        />
      )}
      renderTaskRow={(item) => (
        <PlannerSequenceRow
          item={item}
          date={props.date}
          now={props.now}
          selectedTask={props.selectedTask}
          capabilities={props.capabilities}
        />
      )}
    />
  );
}
