import { IconButton } from "@astryxdesign/core";
import type { RecurrenceSeries } from "../../src/core/recurrence";
import type { Priority, Task } from "../../src/core/task";
import { outstandingForDate } from "../../src/core/planning";
import { DateDropZone, TaskDragProvider } from "./drag";
import {
  formatCivilDate,
  formatPlannerDateHeader,
  todayCivilDate,
} from "./dates";
import { PlannerTaskList } from "./planner-list";
import { JigIcon } from "./jig-icons";

export interface WeekViewProps {
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

interface DatedSectionProps extends Omit<WeekViewProps, "displayedDates"> {
  readonly date: string;
  readonly isToday: boolean;
}

function DatedSection({
  tasks,
  recurrences,
  now,
  date,
  isToday,
  selectedTask,
  onSelectTask,
  onAdd,
  onEdit,
  onToggleComplete,
  onSetPriority,
  onDelete,
  onMove,
}: DatedSectionProps): React.ReactElement {
  const dateTasks = outstandingForDate(tasks, date);
  const className = [
    "jig-week-column",
    isToday ? "jig-week-column-today" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const content = (
    <section aria-labelledby={`week-date-${date}`}>
      <header className="jig-week-column-header">
        <div className="jig-week-date-signifier">
          <strong id={`week-date-${date}`}>
            {formatPlannerDateHeader(date)}
          </strong>
          <IconButton
            label={`Add task to ${formatCivilDate(date, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}`}
            icon={<JigIcon name="add" color="inherit" />}
            variant="ghost"
            className="jig-date-add"
            onClick={() => onAdd(date)}
          />
        </div>
        <span
          className="jig-task-count"
          aria-label={`${dateTasks.length} outstanding tasks`}
        >
          {dateTasks.length}
        </span>
      </header>

      <DateDropZone
        date={date}
        className="jig-week-task-area"
      >
        <PlannerTaskList
          tasks={tasks}
          recurrences={recurrences}
          now={now}
          date={date}
          selectedTask={selectedTask}
          onSelectTask={onSelectTask}
          onEdit={onEdit}
          onToggleComplete={onToggleComplete}
          onSetPriority={onSetPriority}
          onDelete={onDelete}
          onMove={onMove}
        />
      </DateDropZone>
    </section>
  );

  return <div className={className} data-date={date}>{content}</div>;
}

function WeekBoard(props: WeekViewProps): React.ReactElement {
  const today = todayCivilDate();

  return (
    <div className="jig-week-board" role="group" aria-label="Planner week">
      {props.displayedDates.map((date) => (
        <DatedSection
          key={date}
          {...props}
          date={date}
          isToday={date === today}
        />
      ))}
    </div>
  );
}

export function WeekView(props: WeekViewProps): React.ReactElement {
  return (
    <TaskDragProvider tasks={props.tasks} onMove={props.onMove}>
      <WeekBoard {...props} />
    </TaskDragProvider>
  );
}
