import { IconButton } from "@astryxdesign/core";
import { useEffect, useRef, type Ref } from "react";
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
import type { WeekTransitionDirection } from "./planner";
import { WeekPager, type WeekPagingDirection } from "./week-pager";

export interface WeekViewProps {
  readonly focusCurrentDayOnMount: boolean;
  readonly todayScrollRequest: number;
  readonly weekTransitionDirection: WeekTransitionDirection | null;
  readonly enableWeekPaging: boolean;
  readonly onCommitWeek: (direction: WeekPagingDirection) => void;
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
  readonly todaySectionRef: Ref<HTMLDivElement>;
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
  todaySectionRef,
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

  return (
    <div
      ref={isToday ? todaySectionRef : undefined}
      className={className}
      data-date={date}
    >
      {content}
    </div>
  );
}

function WeekBoard({
  dates,
  labelled,
  todaySectionRef,
  ...props
}: WeekViewProps & {
  readonly dates: readonly string[];
  readonly labelled: boolean;
  readonly todaySectionRef: Ref<HTMLDivElement>;
}): React.ReactElement {
  const today = todayCivilDate();
  const region = labelled
    ? ({ role: "group", "aria-label": "Planner week" } as const)
    : {};

  return (
    <div
      className={[
        "jig-week-board",
        props.weekTransitionDirection === "previous"
          ? "jig-week-board-previous"
          : props.weekTransitionDirection === "next"
            ? "jig-week-board-next"
            : props.weekTransitionDirection === "today"
              ? "jig-week-board-today"
              : "",
      ]
        .filter(Boolean)
        .join(" ")}
      {...region}
    >
      {dates.map((date) => (
        <DatedSection
          key={date}
          {...props}
          date={date}
          isToday={date === today}
          todaySectionRef={todaySectionRef}
        />
      ))}
    </div>
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
    <TaskDragProvider tasks={props.tasks} onMove={props.onMove}>
      <WeekBoard
        key={displayedWeekKey}
        {...props}
        todaySectionRef={todaySectionRef}
        swipeHandlers={swipeHandlers}
      />
    </TaskDragProvider>
  );
}
