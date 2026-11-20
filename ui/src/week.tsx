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
import { PlannerTaskList } from "./planner-list";
import { JigIcon } from "./jig-icons";
import type { WeekTransitionDirection } from "./planner";
import {
  WeekPager,
  type WeekPagerHandle,
  type WeekPagingDirection,
} from "./week-pager";

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

interface ActiveWeekInteraction extends WeekMutationProps {
  readonly mode: "active";
  readonly todaySectionRef: Ref<HTMLDivElement>;
}

interface PassiveWeekInteraction {
  readonly mode: "passive";
}

type WeekInteraction = ActiveWeekInteraction | PassiveWeekInteraction;

export interface WeekViewProps extends WeekTaskProps {
  readonly focusCurrentDayOnMount: boolean;
  readonly todayScrollRequest: number;
  readonly weekTransitionDirection: WeekTransitionDirection | null;
  readonly weekPagerRef: Ref<WeekPagerHandle>;
  readonly onCommitWeek: (direction: WeekPagingDirection) => void;
  readonly displayedDates: readonly string[];
}

interface DatedSectionProps extends WeekPresentationProps {
  readonly date: string;
  readonly isToday: boolean;
  readonly interaction: WeekInteraction;
}

function DatedSection({
  tasks,
  recurrences,
  now,
  date,
  isToday,
  interaction,
}: DatedSectionProps): React.ReactElement {
  const activeInteraction = interaction.mode === "active" ? interaction : null;
  const dateTasks = outstandingForDate(tasks, date);
  const columnClassName = [
    "jig-week-column",
    isToday ? "jig-week-column-today" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const headingId = "week-date-" + date;

  const taskContent =
    activeInteraction === null ? (
      <div className="jig-week-task-area">
        <PlannerTaskList
          mode="passive"
          tasks={tasks}
          recurrences={recurrences}
          now={now}
          date={date}
        />
      </div>
    ) : (
      <DateDropZone date={date} className="jig-week-task-area">
        <PlannerTaskList
          mode="active"
          tasks={tasks}
          recurrences={recurrences}
          now={now}
          date={date}
          selectedTask={activeInteraction.selectedTask}
          onSelectTask={activeInteraction.onSelectTask}
          onEdit={activeInteraction.onEdit}
          onToggleComplete={activeInteraction.onToggleComplete}
          onSetPriority={activeInteraction.onSetPriority}
          onDelete={activeInteraction.onDelete}
          onMove={activeInteraction.onMove}
        />
      </DateDropZone>
    );

  return (
    <div
      ref={
        activeInteraction !== null && isToday
          ? activeInteraction.todaySectionRef
          : undefined
      }
      className={columnClassName}
      data-date={activeInteraction === null ? undefined : date}
    >
      <section aria-labelledby={headingId}>
        <header className="jig-week-column-header">
          <div className="jig-week-date-signifier">
            <strong id={headingId}>{formatPlannerDateHeader(date)}</strong>
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
              {...(activeInteraction === null
                ? {}
                : { onClick: () => activeInteraction.onAdd(date) })}
            />
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

interface WeekBoardProps extends WeekPresentationProps {
  readonly dates: readonly string[];
  readonly interaction: WeekInteraction;
  readonly transition: WeekTransitionDirection | null;
}

function WeekBoard({
  dates,
  interaction,
  transition,
  ...presentation
}: WeekBoardProps): React.ReactElement {
  const today = todayCivilDate();
  const isActive = interaction.mode === "active";
  const region = isActive
    ? ({ role: "group", "aria-label": "Planner week" } as const)
    : {};

  return (
    <div
      className={[
        "jig-week-board",
        isActive && transition === "today" ? "jig-week-board-today" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      {...region}
    >
      {dates.map((date) => (
        <DatedSection
          key={date}
          {...presentation}
          date={date}
          isToday={date === today}
          interaction={interaction}
        />
      ))}
    </div>
  );
}

interface ActiveWeekPageProps extends WeekPresentationProps, WeekMutationProps {
  readonly mode: "active";
  readonly dates: readonly string[];
  readonly transition: WeekTransitionDirection | null;
  readonly todaySectionRef: Ref<HTMLDivElement>;
  readonly onDragActiveChange: (active: boolean) => void;
}

interface PassiveWeekPageProps extends WeekPresentationProps {
  readonly mode: "passive";
  readonly dates: readonly string[];
}

type WeekPageProps = ActiveWeekPageProps | PassiveWeekPageProps;

function WeekPage(props: WeekPageProps): React.ReactElement {
  const activeProps = props.mode === "active" ? props : null;
  const firstDate = props.dates[0] ?? todayCivilDate();
  const isEmpty = props.dates.every(
    (date) => outstandingForDate(props.tasks, date).length === 0,
  );
  const interaction: WeekInteraction =
    activeProps === null
      ? { mode: "passive" }
      : {
          mode: "active",
          todaySectionRef: activeProps.todaySectionRef,
          selectedTask: activeProps.selectedTask,
          onSelectTask: activeProps.onSelectTask,
          onAdd: activeProps.onAdd,
          onEdit: activeProps.onEdit,
          onToggleComplete: activeProps.onToggleComplete,
          onSetPriority: activeProps.onSetPriority,
          onDelete: activeProps.onDelete,
          onMove: activeProps.onMove,
        };

  const content = (
    <>
      {isEmpty ? (
        <div className="jig-planner-empty-state">
          <strong>Your week is clear</strong>
          <p>Add the first task you want Jig to keep in this plan.</p>
          <Button
            label="Add your first task"
            variant="primary"
            className="jig-planner-empty-primary"
            {...(activeProps === null
              ? {}
              : {
                  onClick: () =>
                    activeProps.onAdd(
                      defaultAddDate(firstDate, todayCivilDate()),
                    ),
                })}
          />
        </div>
      ) : null}
      <WeekBoard
        tasks={props.tasks}
        recurrences={props.recurrences}
        now={props.now}
        dates={props.dates}
        interaction={interaction}
        transition={activeProps?.transition ?? null}
      />
    </>
  );

  return activeProps === null ? (
    content
  ) : (
    <TaskDragProvider
      tasks={props.tasks}
      onMove={activeProps.onMove}
      onDragActiveChange={activeProps.onDragActiveChange}
    >
      {content}
    </TaskDragProvider>
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
      handleRef={props.weekPagerRef}
      isPagingDisabled={isTaskDragging}
      onCommit={props.onCommitWeek}
      renderWeek={(dates, isActive) =>
        isActive ? (
          <WeekPage
            mode="active"
            dates={dates}
            transition={props.weekTransitionDirection}
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
        ) : (
          <WeekPage
            mode="passive"
            dates={dates}
            tasks={props.tasks}
            recurrences={props.recurrences}
            now={props.now}
          />
        )
      }
    />
  );
}
