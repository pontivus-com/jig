import { Button } from "@astryxdesign/core";
import type { RecurrenceSeries } from "../../src/core/recurrence";
import {
  defaultAddDate,
  outstandingForDate,
} from "../../src/core/planning";
import type { Priority, Task } from "../../src/core/task";
import { todayCivilDate } from "./dates";
import { WeekView } from "./week";

export interface PlannerProps {
  readonly tasks: readonly Task[];
  readonly recurrences: readonly RecurrenceSeries[];
  readonly now: Date;
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
  const firstDate = props.displayedDates[0] ?? todayCivilDate();
  const isEmpty = props.displayedDates.every(
    (date) => outstandingForDate(props.tasks, date).length === 0,
  );

  return (
    <div className="jig-planner-surface">
      {isEmpty ? (
        <div className="jig-planner-empty-state">
          <strong>Your week is clear</strong>
          <p>Add the first task you want Jig to keep in this plan.</p>
          <Button
            label="Add your first task"
            variant="primary"
            onClick={() =>
              props.onAdd(defaultAddDate(firstDate, todayCivilDate()))
            }
          />
        </div>
      ) : null}
      <WeekView
        tasks={props.tasks}
        recurrences={props.recurrences}
        now={props.now}
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
    </div>
  );
}
