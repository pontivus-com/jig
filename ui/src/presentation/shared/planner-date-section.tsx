import { Button, IconButton } from "@astryxdesign/core";
import type { Ref } from "react";
import type { RecurrenceSeries } from "../../../../src/core/recurrence";
import type { Priority, Task } from "../../../../src/core/task";
import {
  defaultAddDate,
  isFutureAddDate,
  outstandingForDate,
} from "../../../../src/core/planning";
import { DateDropZone } from "../../drag";
import {
  formatCivilDate,
  formatPlannerDateHeader,
  todayCivilDate,
} from "../../dates";
import { JigIcon } from "../../jig-icons";
import { PlannerTaskList } from "../../planner-list";

export type WeekTransitionDirection = "today";

export interface PlannerTaskSemanticsProps {
  readonly tasks: readonly Task[];
  readonly recurrences: readonly RecurrenceSeries[];
  readonly now: Date;
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

export interface PlannerPresenterProps extends PlannerTaskSemanticsProps {
  readonly focusCurrentDayOnMount: boolean;
  readonly onInitialTodayFocusHandled: () => void;
  readonly todayScrollRequest: number | null;
  readonly onTodayScrollHandled: () => void;
  readonly weekTransitionDirection: WeekTransitionDirection | null;
  readonly displayedDates: readonly string[];
}

export interface PlannerDateSectionProps extends PlannerTaskSemanticsProps {
  readonly date: string;
  readonly today: string;
  readonly todaySectionRef?: Ref<HTMLDivElement>;
}

export function PlannerDateSection({
  tasks,
  recurrences,
  now,
  date,
  today,
  todaySectionRef,
  selectedTask,
  onSelectTask,
  onAdd,
  onEdit,
  onToggleComplete,
  onSetPriority,
  onDelete,
  onMove,
}: PlannerDateSectionProps): React.ReactElement {
  const dateTasks = outstandingForDate(tasks, date);
  const isToday = date === today;
  const canAddTask = isFutureAddDate(today, date);
  const headingId = "week-date-" + date;

  return (
    <div
      ref={isToday ? todaySectionRef : undefined}
      className={[
        "jig-week-column",
        "jig-planner-date-section",
        isToday ? "jig-week-column-today" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-date={date}
    >
      <section aria-labelledby={headingId}>
        <header className="jig-week-column-header">
          <div className="jig-week-date-signifier">
            <strong id={headingId}>{formatPlannerDateHeader(date)}</strong>
            {canAddTask ? (
              <IconButton
                label={
                  "Add task to " +
                  formatCivilDate(date, {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })
                }
                icon={<JigIcon name="add" color="inherit" />}
                variant="ghost"
                className="jig-date-add"
                onClick={() => onAdd(date)}
              />
            ) : null}
          </div>
          <span
            className="jig-task-count"
            aria-label={dateTasks.length + " outstanding tasks"}
          >
            {dateTasks.length}
          </span>
        </header>
        <DateDropZone date={date} className="jig-week-task-area">
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
    </div>
  );
}

export interface PlannerEmptyStateProps {
  readonly dates: readonly string[];
  readonly tasks: readonly Task[];
  readonly onAdd: (date: string) => void;
}

export function PlannerEmptyState({
  dates,
  tasks,
  onAdd,
}: PlannerEmptyStateProps): React.ReactElement | null {
  const isEmpty = dates.every(
    (date) => outstandingForDate(tasks, date).length === 0,
  );
  if (!isEmpty) {
    return null;
  }

  const today = todayCivilDate();
  const firstDate = dates[0] ?? today;
  const suggestedDate = defaultAddDate(firstDate, today);
  const firstTaskDate = suggestedDate > today ? suggestedDate : today;

  return (
    <div className="jig-planner-empty-state">
      <strong>Your week is clear</strong>
      <p>Add the first task you want Jig to keep in this plan.</p>
      <Button
        label="Add your first task"
        variant="primary"
        className="jig-planner-empty-primary"
        onClick={() => onAdd(firstTaskDate)}
      />
    </div>
  );
}
