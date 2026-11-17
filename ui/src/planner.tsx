import type { Priority, Task } from "../../src/core/task";
import { WeekView } from "./week";

export interface PlannerProps {
  readonly tasks: readonly Task[];
  readonly displayedDates: readonly string[];
  readonly selectedTask: Task | null;
  readonly onSelectTask: (task: Task) => void;
  readonly onAdd: (date: string) => void;
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

export function Planner(props: PlannerProps): React.ReactElement {
  return (
    <WeekView
      tasks={props.tasks}
      displayedDates={props.displayedDates}
      selectedTask={props.selectedTask}
      onSelectTask={props.onSelectTask}
      onAdd={props.onAdd}
      onEdit={props.onEdit}
      onToggleComplete={props.onToggleComplete}
      onSetPriority={props.onSetPriority}
      onDelete={props.onDelete}
      onMove={props.onMove}
    />
  );
}
