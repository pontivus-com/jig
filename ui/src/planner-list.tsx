import { List, useAnimatedLayout } from "@astryxdesign/core";
import { Fragment, useRef, type Ref } from "react";
import type { RecurrenceSeries } from "../../src/core/recurrence";
import type { Priority, Task } from "../../src/core/task";
import { outstandingForDate } from "../../src/core/planning";
import { todayCivilDate } from "./dates";
import {
  DraggableTaskRow,
  TaskInsertionSlot,
  TaskInsertionSlotPresentation,
} from "./drag";
import { TaskRow } from "./task-row";

interface PlannerTaskListBaseProps {
  readonly tasks: readonly Task[];
  readonly recurrences: readonly RecurrenceSeries[];
  readonly now: Date;
  readonly date: string;
}

export interface ActivePlannerTaskListProps extends PlannerTaskListBaseProps {
  readonly mode: "active";
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

export interface PassivePlannerTaskListProps extends PlannerTaskListBaseProps {
  readonly mode: "passive";
}

export type PlannerTaskListProps =
  | ActivePlannerTaskListProps
  | PassivePlannerTaskListProps;

interface PlannerSequenceRowProps
  extends Omit<
    ActivePlannerTaskListProps,
    "mode" | "tasks" | "recurrences" | "date" | "selectedTask"
  > {
  readonly task: Task;
  readonly recurrenceSeries: RecurrenceSeries | null;
  readonly index: number;
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

interface PlannerTaskSequenceProps {
  readonly items: readonly PlannerTaskPresentationItem[];
  readonly listRef?: Ref<HTMLUListElement> | undefined;
  readonly animatedLayout?: ReturnType<typeof useAnimatedLayout> | undefined;
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
      {...(listRef === undefined ? {} : { ref: listRef })}
      {...(animatedLayout === undefined ? {} : { animatedLayout })}
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
  task,
  recurrenceSeries,
  now,
  index,
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
  const rowProps = {
    task,
    isSelected,
    onSelect: () => onSelectTask(task),
    onToggleComplete: () => {
      void onToggleComplete(task);
    },
    onEdit: () => onEdit(task),
    onSetPriority: (priority: Priority) => {
      void onSetPriority(task, priority);
    },
    onDelete: () => onDelete(task),
    ...(index > 0
      ? {
          onMoveUp: () => {
            void onMove(task.id, date, index - 1);
          },
        }
      : {}),
    ...(index < sequenceLength - 1
      ? {
          onMoveDown: () => {
            void onMove(task.id, date, index + 1);
          },
        }
      : {}),
  };

  return (
    <DraggableTaskRow
      {...rowProps}
      recurrenceSeries={recurrenceSeries}
      now={now}
      index={index}
    />
  );
}

function ActivePlannerTaskList(
  props: ActivePlannerTaskListProps,
): React.ReactElement {
  const items = plannerTaskPresentationItems(
    props.tasks,
    props.recurrences,
    props.date,
  );
  const listRef = useRef<HTMLUListElement>(null);
  const animatedLayout = useAnimatedLayout({ containerRef: listRef });

  return (
    <PlannerTaskSequence
      items={items}
      listRef={listRef}
      animatedLayout={animatedLayout}
      renderInsertionSlot={(slotIndex) => (
        <TaskInsertionSlot date={props.date} slotIndex={slotIndex} />
      )}
      renderTaskRow={(item) => (
        <PlannerSequenceRow
          task={item.task}
          recurrenceSeries={item.recurrenceSeries}
          now={props.now}
          index={item.index}
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

function PassivePlannerTaskList(
  props: PassivePlannerTaskListProps,
): React.ReactElement {
  const items = plannerTaskPresentationItems(
    props.tasks,
    props.recurrences,
    props.date,
  );
  const isPastDate = props.date < todayCivilDate();

  return (
    <PlannerTaskSequence
      items={items}
      renderInsertionSlot={() => (
        <TaskInsertionSlotPresentation isPastDate={isPastDate} />
      )}
      renderTaskRow={(item) => (
        <TaskRow
          mode="passive"
          task={item.task}
          recurrenceSeries={item.recurrenceSeries}
          now={props.now}
        />
      )}
    />
  );
}

export function PlannerTaskList(
  props: PlannerTaskListProps,
): React.ReactElement {
  return props.mode === "active" ? (
    <ActivePlannerTaskList {...props} />
  ) : (
    <PassivePlannerTaskList {...props} />
  );
}
