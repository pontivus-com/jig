import { Button, IconButton } from "@astryxdesign/core";
import { useEffect, useRef, type Ref } from "react";
import type { RecurrenceSeries } from "../../src/core/recurrence";
import type { Priority, Task } from "../../src/core/task";
import {
  defaultAddDate,
  isFutureAddDate,
  outstandingForDate,
} from "../../src/core/planning";
import { DateDropZone, TaskDragProvider } from "./drag";
import {
  formatCivilDate,
  formatPlannerDateHeader,
  todayCivilDate,
} from "./dates";
import { PlannerTaskList } from "./planner-list";
import { JigIcon } from "./jig-icons";
import type { WeekTransitionDirection } from "./planner";

interface WeekPresentationProps {
  readonly tasks: readonly Task[];
  readonly recurrences: readonly RecurrenceSeries[];
  readonly now: Date;
}

interface WeekMutationProps {
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

interface WeekTaskProps extends WeekPresentationProps, WeekMutationProps {}

export interface WeekViewProps extends WeekTaskProps {
  readonly focusCurrentDayOnMount: boolean;
  readonly todayScrollRequest: number;
  readonly weekTransitionDirection: WeekTransitionDirection | null;
  readonly displayedDates: readonly string[];
}

interface DatedSectionProps extends WeekTaskProps {
  readonly date: string;
  readonly isToday: boolean;
  readonly canAddTask: boolean;
  readonly todaySectionRef: Ref<HTMLDivElement>;
}

function DatedSection({
  tasks,
  recurrences,
  now,
  date,
  isToday,
  canAddTask,
  todaySectionRef,
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
  const columnClassName = [
    "jig-week-column",
    isToday ? "jig-week-column-today" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const headingId = "week-date-" + date;

  return (
    <div
      ref={isToday ? todaySectionRef : undefined}
      className={columnClassName}
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

interface WeekBoardProps extends WeekTaskProps {
  readonly dates: readonly string[];
  readonly transition: WeekTransitionDirection | null;
  readonly todaySectionRef: Ref<HTMLDivElement>;
}

function WeekBoard({
  dates,
  transition,
  todaySectionRef,
  ...taskProps
}: WeekBoardProps): React.ReactElement {
  const today = todayCivilDate();

  return (
    <div
      className={[
        "jig-week-board",
        transition === "today" ? "jig-week-board-today" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      role="group"
      aria-label="Planner week"
    >
      {dates.map((date) => (
        <DatedSection
          key={date}
          {...taskProps}
          date={date}
          isToday={date === today}
          canAddTask={isFutureAddDate(today, date)}
          todaySectionRef={todaySectionRef}
        />
      ))}
    </div>
  );
}

interface WeekPageProps extends WeekTaskProps {
  readonly dates: readonly string[];
  readonly transition: WeekTransitionDirection | null;
  readonly todaySectionRef: Ref<HTMLDivElement>;
}

function WeekPage({
  dates,
  transition,
  todaySectionRef,
  ...taskProps
}: WeekPageProps): React.ReactElement {
  const firstDate = dates[0] ?? todayCivilDate();
  const isEmpty = dates.every(
    (date) => outstandingForDate(taskProps.tasks, date).length === 0,
  );
  const today = todayCivilDate();
  const suggestedDate = defaultAddDate(firstDate, today);
  const firstTaskDate = suggestedDate > today ? suggestedDate : today;

  return (
    <TaskDragProvider tasks={taskProps.tasks} onMove={taskProps.onMove}>
      {isEmpty ? (
        <div className="jig-planner-empty-state">
          <strong>Your week is clear</strong>
          <p>Add the first task you want Jig to keep in this plan.</p>
          <Button
            label="Add your first task"
            variant="primary"
            className="jig-planner-empty-primary"
            onClick={() => taskProps.onAdd(firstTaskDate)}
          />
        </div>
      ) : null}
      <WeekBoard
        {...taskProps}
        dates={dates}
        transition={transition}
        todaySectionRef={todaySectionRef}
      />
    </TaskDragProvider>
  );
}

export function WeekView(props: WeekViewProps): React.ReactElement {
  const today = todayCivilDate();
  const todaySectionRef = useRef<HTMLDivElement>(null);
  const displayedWeekKey = props.displayedDates.join("|");

  useEffect(() => {
    if (
      !props.focusCurrentDayOnMount ||
      !props.displayedDates.includes(today)
    ) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      todaySectionRef.current?.scrollIntoView({
        block: "start",
        inline: "nearest",
        behavior: "auto",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [displayedWeekKey, props.focusCurrentDayOnMount, today]);

  useEffect(() => {
    if (
      props.todayScrollRequest === 0 ||
      !props.displayedDates.includes(today)
    ) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      todaySectionRef.current?.scrollIntoView({
        block: "start",
        inline: "nearest",
        behavior: "auto",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [displayedWeekKey, props.todayScrollRequest, today]);

  return (
    <WeekPage
      dates={props.displayedDates}
      transition={props.weekTransitionDirection}
      todaySectionRef={todaySectionRef}
      tasks={props.tasks}
      recurrences={props.recurrences}
      now={props.now}
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
