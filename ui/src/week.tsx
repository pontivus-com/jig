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
  type WeekPagingDirection,
  type WeekPagingRequest,
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

interface ActiveWeekProps extends WeekPresentationProps, WeekMutationProps {
  readonly mode: "active";
}

interface PassiveWeekProps extends WeekPresentationProps {
  readonly mode: "passive";
}

export interface WeekViewProps extends WeekTaskProps {
  readonly focusCurrentDayOnMount: boolean;
  readonly todayScrollRequest: number;
  readonly weekTransitionDirection: WeekTransitionDirection | null;
  readonly weekPagingRequest: WeekPagingRequest | null;
  readonly onCommitWeek: (direction: WeekPagingDirection) => void;
  readonly displayedDates: readonly string[];
}

type DatedSectionProps =
  | (ActiveWeekProps & {
      readonly date: string;
      readonly isToday: boolean;
      readonly todaySectionRef?: Ref<HTMLDivElement> | undefined;
    })
  | (PassiveWeekProps & {
      readonly date: string;
      readonly isToday: boolean;
    });

function DatedSection(props: DatedSectionProps): React.ReactElement {
  const activeProps = props.mode === "active" ? props : null;
  const dateTasks = outstandingForDate(props.tasks, props.date);
  const columnClassName = [
    "jig-week-column",
    props.isToday ? "jig-week-column-today" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const headingId = "week-date-" + props.date;

  const taskContent =
    activeProps === null ? (
      <div className="jig-week-task-area">
        <PlannerTaskList
          mode="passive"
          tasks={props.tasks}
          recurrences={props.recurrences}
          now={props.now}
          date={props.date}
        />
      </div>
    ) : (
      <DateDropZone date={props.date} className="jig-week-task-area">
        <PlannerTaskList
          mode="active"
          tasks={props.tasks}
          recurrences={props.recurrences}
          now={props.now}
          date={props.date}
          selectedTask={activeProps.selectedTask}
          onSelectTask={activeProps.onSelectTask}
          onEdit={activeProps.onEdit}
          onToggleComplete={activeProps.onToggleComplete}
          onSetPriority={activeProps.onSetPriority}
          onDelete={activeProps.onDelete}
          onMove={activeProps.onMove}
        />
      </DateDropZone>
    );

  return (
    <div
      ref={
        activeProps !== null && props.isToday
          ? activeProps.todaySectionRef
          : undefined
      }
      className={columnClassName}
      data-date={activeProps === null ? undefined : props.date}
    >
      <section aria-labelledby={headingId}>
        <header className="jig-week-column-header">
          <div className="jig-week-date-signifier">
            <strong id={headingId}>{formatPlannerDateHeader(props.date)}</strong>
            <IconButton
              label={
                "Add task to " +
                formatCivilDate(props.date, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })
              }
              icon={<JigIcon name="add" color="inherit" />}
              variant="ghost"
              className="jig-date-add"
              {...(activeProps === null
                ? {}
                : { onClick: () => activeProps.onAdd(props.date) })}
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

type WeekBoardProps =
  | (ActiveWeekProps & {
      readonly dates: readonly string[];
      readonly transition: WeekTransitionDirection | null;
      readonly todaySectionRef?: Ref<HTMLDivElement> | undefined;
    })
  | (PassiveWeekProps & {
      readonly dates: readonly string[];
    });

function WeekBoard(props: WeekBoardProps): React.ReactElement {
  const activeProps = props.mode === "active" ? props : null;
  const today = todayCivilDate();
  const region =
    activeProps === null
      ? {}
      : ({ role: "group", "aria-label": "Planner week" } as const);

  return (
    <div
      className={[
        "jig-week-board",
        activeProps?.transition === "today" ? "jig-week-board-today" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      {...region}
    >
      {props.dates.map((date) =>
        activeProps === null ? (
          <DatedSection
            key={date}
            mode="passive"
            tasks={props.tasks}
            recurrences={props.recurrences}
            now={props.now}
            date={date}
            isToday={date === today}
          />
        ) : (
          <DatedSection
            key={date}
            mode="active"
            tasks={props.tasks}
            recurrences={props.recurrences}
            now={props.now}
            selectedTask={activeProps.selectedTask}
            onSelectTask={activeProps.onSelectTask}
            onAdd={activeProps.onAdd}
            onEdit={activeProps.onEdit}
            onToggleComplete={activeProps.onToggleComplete}
            onSetPriority={activeProps.onSetPriority}
            onDelete={activeProps.onDelete}
            onMove={activeProps.onMove}
            date={date}
            isToday={date === today}
            {...(activeProps.todaySectionRef === undefined
              ? {}
              : { todaySectionRef: activeProps.todaySectionRef })}
          />
        ),
      )}
    </div>
  );
}

type WeekPageProps =
  | (ActiveWeekProps & {
      readonly dates: readonly string[];
      readonly transition: WeekTransitionDirection | null;
      readonly todaySectionRef: Ref<HTMLDivElement>;
      readonly onDragActiveChange: (active: boolean) => void;
    })
  | (PassiveWeekProps & {
      readonly dates: readonly string[];
    });

function WeekPage(props: WeekPageProps): React.ReactElement {
  const activeProps = props.mode === "active" ? props : null;
  const firstDate = props.dates[0] ?? todayCivilDate();
  const isEmpty = props.dates.every(
    (date) => outstandingForDate(props.tasks, date).length === 0,
  );

  const weekBoard =
    activeProps === null ? (
      <WeekBoard
        mode="passive"
        tasks={props.tasks}
        recurrences={props.recurrences}
        now={props.now}
        dates={props.dates}
      />
    ) : (
      <WeekBoard
        mode="active"
        tasks={props.tasks}
        recurrences={props.recurrences}
        now={props.now}
        selectedTask={activeProps.selectedTask}
        onSelectTask={activeProps.onSelectTask}
        onAdd={activeProps.onAdd}
        onEdit={activeProps.onEdit}
        onToggleComplete={activeProps.onToggleComplete}
        onSetPriority={activeProps.onSetPriority}
        onDelete={activeProps.onDelete}
        onMove={activeProps.onMove}
        dates={props.dates}
        transition={activeProps.transition}
        todaySectionRef={activeProps.todaySectionRef}
      />
    );

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
      {weekBoard}
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
      navigationRequest={props.weekPagingRequest}
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
