import { Button, IconButton } from "@astryxdesign/core";
import { useEffect, useRef, useState, type Ref } from "react";
import type { RecurrenceSeries } from "../../src/core/recurrence";
import type { Priority, Task } from "../../src/core/task";
import {
  defaultAddDate,
  outstandingForDate,
  startOfWeekMonday,
} from "../../src/core/planning";
import { DateDropZone, TaskDragProvider } from "./drag";
import {
  formatCivilDate,
  formatPlannerDateHeader,
  todayCivilDate,
} from "./dates";
import {
  PlannerTaskList,
  PlannerTaskPreviewList,
} from "./planner-list";
import { JigIcon } from "./jig-icons";
import type { WeekTransitionDirection } from "./planner";
import {
  WeekPager,
  type WeekPagingDirection,
  type WeekPagingRequest,
} from "./week-pager";

interface WeekTaskProps {
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

export interface WeekViewProps extends WeekTaskProps {
  readonly focusCurrentDayOnMount: boolean;
  readonly todayScrollRequest: number;
  readonly weekTransitionDirection: WeekTransitionDirection | null;
  readonly weekPagingRequest: WeekPagingRequest | null;
  readonly onCommitWeek: (direction: WeekPagingDirection) => void;
  readonly displayedDates: readonly string[];
}

interface DatedSectionProps extends WeekTaskProps {
  readonly date: string;
  readonly isToday: boolean;
  readonly interactive: boolean;
  readonly todaySectionRef?: Ref<HTMLDivElement> | undefined;
}

function DatedSection({
  tasks,
  recurrences,
  now,
  date,
  isToday,
  interactive,
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
  const columnClassName = interactive
    ? ["jig-week-column", isToday ? "jig-week-column-today" : ""]
        .filter(Boolean)
        .join(" ")
    : "jig-week-preview-column";
  const headerClassName = interactive
    ? "jig-week-column-header"
    : "jig-week-preview-column-header";
  const signifierClassName = interactive
    ? "jig-week-date-signifier"
    : "jig-week-preview-date-signifier";
  const headingId = (interactive ? "week-date-" : "week-preview-date-") + date;

  const taskContent = interactive ? (
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
  ) : (
    <div className="jig-week-preview-task-area">
      <PlannerTaskPreviewList
        tasks={tasks}
        recurrences={recurrences}
        date={date}
      />
    </div>
  );

  return (
    <div
      ref={interactive && isToday ? todaySectionRef : undefined}
      className={columnClassName}
      data-date={interactive ? date : undefined}
    >
      <section aria-labelledby={headingId}>
        <header className={headerClassName}>
          <div className={signifierClassName}>
            <strong id={headingId}>{formatPlannerDateHeader(date)}</strong>
            {interactive ? (
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
        {taskContent}
      </section>
    </div>
  );
}

interface WeekBoardProps extends WeekTaskProps {
  readonly dates: readonly string[];
  readonly interactive: boolean;
  readonly transition: WeekTransitionDirection | null;
  readonly todaySectionRef?: Ref<HTMLDivElement> | undefined;
}

function WeekBoard({
  dates,
  interactive,
  transition,
  todaySectionRef,
  ...props
}: WeekBoardProps): React.ReactElement {
  const today = todayCivilDate();
  const region = interactive
    ? ({ role: "group", "aria-label": "Planner week" } as const)
    : {};

  return (
    <div
      className={
        interactive
          ? [
              "jig-week-board",
              transition === "today" ? "jig-week-board-today" : "",
            ]
              .filter(Boolean)
              .join(" ")
          : "jig-week-preview-board"
      }
      {...region}
    >
      {dates.map((date) => (
        <DatedSection
          key={date}
          {...props}
          date={date}
          isToday={date === today}
          interactive={interactive}
          todaySectionRef={todaySectionRef}
        />
      ))}
    </div>
  );
}

interface WeekPageProps extends WeekTaskProps {
  readonly dates: readonly string[];
  readonly interactive: boolean;
  readonly transition: WeekTransitionDirection | null;
  readonly todaySectionRef: Ref<HTMLDivElement>;
  readonly onDragActiveChange: (active: boolean) => void;
}

function WeekPage({
  dates,
  interactive,
  transition,
  todaySectionRef,
  onDragActiveChange,
  ...props
}: WeekPageProps): React.ReactElement {
  const firstDate = dates[0] ?? todayCivilDate();
  const isEmpty = dates.every(
    (date) => outstandingForDate(props.tasks, date).length === 0,
  );

  const content = (
    <>
      {isEmpty ? (
        interactive ? (
          <div className="jig-planner-empty-state">
            <strong>Your week is clear</strong>
            <p>Add the first task you want Jig to keep in this plan.</p>
            <Button
              label="Add your first task"
              variant="primary"
              className="jig-planner-empty-primary"
              onClick={() =>
                props.onAdd(defaultAddDate(firstDate, todayCivilDate()))
              }
            />
          </div>
        ) : (
          <div className="jig-week-preview-empty-state" aria-hidden="true">
            <strong>Your week is clear</strong>
          </div>
        )
      ) : null}
      <WeekBoard
        {...props}
        dates={dates}
        interactive={interactive}
        transition={transition}
        todaySectionRef={interactive ? todaySectionRef : undefined}
      />
    </>
  );

  return interactive ? (
    <TaskDragProvider
      tasks={props.tasks}
      onMove={props.onMove}
      onDragActiveChange={onDragActiveChange}
    >
      {content}
    </TaskDragProvider>
  ) : (
    content
  );
}

export function WeekView(props: WeekViewProps): React.ReactElement {
  const today = todayCivilDate();
  const todaySectionRef = useRef<HTMLDivElement>(null);
  const [isTaskDragging, setIsTaskDragging] = useState(false);
  const displayedWeekKey = props.displayedDates.join("|");
  const weekStart =
    props.displayedDates[0] ?? startOfWeekMonday(todayCivilDate());

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
    <WeekPager
      weekStart={weekStart}
      navigationRequest={props.weekPagingRequest}
      isPagingDisabled={isTaskDragging}
      onCommit={props.onCommitWeek}
      renderWeek={(dates, isActive) => (
        <WeekPage
          dates={dates}
          interactive={isActive}
          transition={isActive ? props.weekTransitionDirection : null}
          todaySectionRef={todaySectionRef}
          onDragActiveChange={setIsTaskDragging}
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
      )}
    />
  );
}
