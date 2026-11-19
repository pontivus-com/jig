import { List } from "@astryxdesign/core";
import { Fragment } from "react";
import type { RecurrenceSeries } from "../../src/core/recurrence";
import type { Priority, Task } from "../../src/core/task";
import { outstandingForDate } from "../../src/core/planning";
import {
  DraggableTaskRow,
  TaskInsertionSlot,
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
  extends Omit<PlannerTaskListProps, "tasks" | "date" | "selectedTask"> {
  readonly task: Task;
  readonly recurrenceSeries: RecurrenceSeries | null;
  readonly index: number;
  readonly date: string;
  readonly sequenceLength: number;
  readonly isSelected: boolean;
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

export function PlannerTaskList({
  tasks,
  recurrences,
  now,
  date,
  selectedTask,
  onSelectTask,
  onEdit,
  onToggleComplete,
  onSetPriority,
  onDelete,
  onMove,
}: PlannerTaskListProps): React.ReactElement | null {
  const outstanding = outstandingForDate(tasks, date);

  return (
    <List density="compact" edge="padded" className="jig-task-card-list">
      {outstanding.map((task, index) => (
        <Fragment key={task.id}>
          <TaskInsertionSlot date={date} slotIndex={index} />
          <PlannerSequenceRow
            task={task}
            recurrenceSeries={
              task.recurrence_series_id === null
                ? null
                : recurrences.find(
                    (series) => series.id === task.recurrence_series_id,
                  ) ?? null
            }
            now={now}
            index={index}
            date={date}
            sequenceLength={outstanding.length}
            isSelected={selectedTask?.id === task.id}
            onSelectTask={onSelectTask}
            onEdit={onEdit}
            onToggleComplete={onToggleComplete}
            onSetPriority={onSetPriority}
            onDelete={onDelete}
            onMove={onMove}
          />
        </Fragment>
      ))}
      <TaskInsertionSlot date={date} slotIndex={outstanding.length} />
    </List>
  );
}
