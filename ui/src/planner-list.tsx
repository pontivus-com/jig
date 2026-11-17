import { List } from "@astryxdesign/core";
import type { Priority, Task } from "../../src/core/task";
import { outstandingForDate } from "../../src/core/planning";
import { SortableTaskRow } from "./task-row";

export interface PlannerTaskListProps {
  readonly tasks: readonly Task[];
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
  readonly index: number;
  readonly date: string;
  readonly sequenceLength: number;
  readonly isSelected: boolean;
}

function PlannerSequenceRow({
  task,
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
    <SortableTaskRow
      {...rowProps}
      index={index}
      group={date}
    />
  );
}

export function PlannerTaskList({
  tasks,
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
  if (outstanding.length === 0) {
    return null;
  }

  return (
    <List density="compact" edge="padded" className="jig-task-card-list">
      {outstanding.map((task, index) => (
        <PlannerSequenceRow
          key={task.id}
          task={task}
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
      ))}
    </List>
  );
}
