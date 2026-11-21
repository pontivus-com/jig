import { Button, IconButton } from "@astryxdesign/core";
import type { Ref } from "react";
import type { RecurrenceSeries } from "../../src/core/recurrence";
import type { Priority, Task } from "../../src/core/task";
import {
  defaultAddDate,
  outstandingForDate,
} from "../../src/core/planning";
import {
  DateDropZone,
  TaskDragScopePresentation,
  useTaskDragState,
} from "./drag";
import {
  formatCivilDate,
  formatPlannerDateHeader,
  todayCivilDate,
} from "./dates";
import {
  PlannerTaskList,
  type PlannerTaskListCapabilities,
} from "./planner-list";
import { JigIcon } from "./jig-icons";

export type WeekTransitionDirection = "today";

interface WeekPresentationProps {
  readonly tasks: readonly Task[];
  readonly recurrences: readonly RecurrenceSeries[];
  readonly now: Date;
  readonly selectedTask: Task | null;
}

export interface CanonicalWeekCapabilities {
  readonly kind: "canonical";
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

export interface AdjacentWeekCapabilities {
  readonly kind: "adjacent";
}

export type WeekCapabilities =
  | CanonicalWeekCapabilities
  | AdjacentWeekCapabilities;

export interface WeekPageProps extends WeekPresentationProps {
  readonly dates: readonly string[];
  readonly transition: WeekTransitionDirection | null;
  readonly todaySectionRef?: Ref<HTMLDivElement> | undefined;
  readonly capabilities: WeekCapabilities;
}

interface DatedSectionProps extends WeekPresentationProps {
  readonly date: string;
  readonly isToday: boolean;
  readonly todaySectionRef?: Ref<HTMLDivElement> | undefined;
  readonly capabilities: WeekCapabilities;
}

function taskListCapabilities(
  capabilities: WeekCapabilities,
): PlannerTaskListCapabilities {
  if (capabilities.kind === "adjacent") {
    return { kind: "adjacent" };
  }

  return {
    kind: "canonical",
    onSelectTask: capabilities.onSelectTask,
    onEdit: capabilities.onEdit,
    onToggleComplete: capabilities.onToggleComplete,
    onSetPriority: capabilities.onSetPriority,
    onDelete: capabilities.onDelete,
    onMove: capabilities.onMove,
  };
}

function DatedSection({
  tasks,
  recurrences,
  now,
  selectedTask,
  date,
  isToday,
  todaySectionRef,
  capabilities,
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
      {...(isToday && todaySectionRef !== undefined
        ? { ref: todaySectionRef }
        : {})}
      className={columnClassName}
      data-date={date}
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
              {...(capabilities.kind === "canonical"
                ? { onClick: () => capabilities.onAdd(date) }
                : {})}
            />
          </div>
          <span
            className="jig-task-count"
            aria-label={dateTasks.length + " outstanding tasks"}
          >
            {dateTasks.length}
          </span>
        </header>
        <DateDropZone
          date={date}
          isInteractive={capabilities.kind === "canonical"}
          className="jig-week-task-area"
        >
          <PlannerTaskList
            tasks={tasks}
            recurrences={recurrences}
            now={now}
            date={date}
            selectedTask={selectedTask}
            capabilities={taskListCapabilities(capabilities)}
          />
        </DateDropZone>
      </section>
    </div>
  );
}

interface WeekBoardProps extends WeekPresentationProps {
  readonly dates: readonly string[];
  readonly transition: WeekTransitionDirection | null;
  readonly todaySectionRef?: Ref<HTMLDivElement> | undefined;
  readonly capabilities: WeekCapabilities;
}

function WeekBoard({
  dates,
  transition,
  todaySectionRef,
  capabilities,
  ...presentation
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
          {...presentation}
          date={date}
          isToday={date === today}
          todaySectionRef={todaySectionRef}
          capabilities={capabilities}
        />
      ))}
    </div>
  );
}

function WeekPageContent(
  props: WeekPageProps,
): React.ReactElement {
  const firstDate = props.dates[0] ?? todayCivilDate();
  const isEmpty = props.dates.every(
    (date) => outstandingForDate(props.tasks, date).length === 0,
  );

  return (
    <>
      {isEmpty ? (
        <div className="jig-planner-empty-state">
          <strong>Your week is clear</strong>
          <p>Add the first task you want Jig to keep in this plan.</p>
          <Button
            label="Add your first task"
            variant="primary"
            className="jig-planner-empty-primary"
            {...(props.capabilities.kind === "canonical"
              ? {
                  onClick: () =>
                    props.capabilities.kind === "canonical" &&
                    props.capabilities.onAdd(
                      defaultAddDate(firstDate, todayCivilDate()),
                    ),
                }
              : {})}
          />
        </div>
      ) : null}
      <WeekBoard
        dates={props.dates}
        transition={props.transition}
        todaySectionRef={props.todaySectionRef}
        tasks={props.tasks}
        recurrences={props.recurrences}
        now={props.now}
        selectedTask={props.selectedTask}
        capabilities={props.capabilities}
      />
    </>
  );
}

export function WeekPage(
  props: WeekPageProps,
): React.ReactElement {
  const dragState = useTaskDragState();
  const isCanonical = props.capabilities.kind === "canonical";

  return (
    <TaskDragScopePresentation
      activeTaskId={isCanonical ? dragState.activeTaskId : null}
      destinationDate={
        isCanonical ? dragState.intent?.destination_date ?? null : null
      }
      destinationIndex={
        isCanonical ? dragState.intent?.destination_index ?? null : null
      }
    >
      <WeekPageContent {...props} />
    </TaskDragScopePresentation>
  );
}
