import {
  List,
} from "@astryxdesign/core";
import type { Task } from "../../src/core/task";
import { outstandingForDate } from "../../src/core/planning";
import { TaskRow } from "./task-row";

export interface PlannerTaskListProps {
  readonly tasks: readonly Task[];
  readonly selectedDate: string;
  readonly selectedTask: Task | null;
  readonly onSelectTask: (task: Task) => void;
  readonly onEdit: (task: Task) => void;
  readonly onToggleComplete: (task: Task) => Promise<boolean>;
  readonly onMove: (
    taskId: string,
    destinationDate: string,
    destinationIndex: number,
  ) => Promise<boolean>;
}

export function PlannerTaskList({
  tasks,
  selectedDate,
  selectedTask,
  onSelectTask,
  onEdit,
  onToggleComplete,
  onMove,
}: PlannerTaskListProps): React.ReactElement {
  const outstanding = outstandingForDate(tasks, selectedDate);

  if (outstanding.length === 0) {
    return <p className="jig-empty-state">Nothing scheduled for this date.</p>;
  }

  return (
    <List density="compact" edge="padded" className="jig-task-card-list">
      {outstanding.map((task, index) => (
        <TaskRow
          key={task.id}
          task={task}
          isSelected={selectedTask?.id === task.id}
          onSelect={() => onSelectTask(task)}
          onToggleComplete={() => {
            void onToggleComplete(task);
          }}
          onEdit={() => onEdit(task)}
          {...(index > 0
            ? {
                onMoveUp: () => {
                  void onMove(task.id, selectedDate, index - 1);
                },
              }
            : {})}
          {...(index < outstanding.length - 1
            ? {
                onMoveDown: () => {
                  void onMove(task.id, selectedDate, index + 1);
                },
              }
            : {})}
        />
      ))}
    </List>
  );
}
