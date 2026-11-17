import { Button } from "@astryxdesign/core";
import type { Priority, Task } from "../../src/core/task";
import { outstandingForDate } from "../../src/core/planning";
import { DateDropZone, TaskDragProvider } from "./drag";
import {
  formatCivilDate,
  formatPlannerDateHeader,
  todayCivilDate,
} from "./dates";
import { PlannerTaskList } from "./planner-list";

export interface WeekViewProps {
  readonly tasks: readonly Task[];
  readonly displayedDates: readonly string[];
  readonly enableDrag: boolean;
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
  date,
  isToday,
  enableDrag,
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
          <Button
            label={`Add task to ${formatCivilDate(date, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}`}
            variant="ghost"
            size="sm"
            className="jig-date-add"
            onClick={() => onAdd(date)}
          >
            <span aria-hidden="true">+</span>
          </Button>
        </div>
        <span
          className="jig-task-count"
          aria-label={`${dateTasks.length} outstanding tasks`}
        >
          {dateTasks.length}
        </span>
      </header>

      <div className="jig-week-task-area">
        <PlannerTaskList
          tasks={tasks}
          date={date}
          isSortable={enableDrag}
          selectedTask={selectedTask}
          onSelectTask={onSelectTask}
          onEdit={onEdit}
          onToggleComplete={onToggleComplete}
          onSetPriority={onSetPriority}
          onDelete={onDelete}
          onMove={onMove}
        />
      </div>
    </section>
  );

  return enableDrag ? (
    <DateDropZone date={date} className={className}>
      {content}
    </DateDropZone>
  ) : (
    <div className={className}>{content}</div>
  );
}

function WeekBoard(props: WeekViewProps): React.ReactElement {
  const today = todayCivilDate();

  return (
    <div
      className={props.enableDrag ? "jig-week-board" : "jig-planner-narrow"}
      role="group"
      aria-label="Planner week"
    >
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
  return props.enableDrag ? (
    <TaskDragProvider tasks={props.tasks} onMove={props.onMove}>
      <WeekBoard {...props} />
    </TaskDragProvider>
  ) : (
    <WeekBoard {...props} />
  );
}
