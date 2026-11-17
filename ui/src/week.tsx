import {
  Button,
  List,
} from "@astryxdesign/core";
import type { ReactNode } from "react";
import type { Task } from "../../src/core/task";
import {
  outstandingForDate,
  weekDates,
} from "../../src/core/planning";
import { DateDropZone, TaskDragProvider } from "./drag";
import { DayTaskLists } from "./day";
import { formatCivilDate, todayCivilDate } from "./dates";

function weekHeading(dates: readonly string[], fallback: string): string {
  const first = dates[0] ?? fallback;
  const last = dates[6] ?? fallback;
  const firstMonth = formatCivilDate(first, { month: "long" });
  const lastMonth = formatCivilDate(last, { month: "long" });
  const firstYear = formatCivilDate(first, { year: "numeric" });
  const lastYear = formatCivilDate(last, { year: "numeric" });
  const firstDay = formatCivilDate(first, { day: "numeric" });
  const lastDay = formatCivilDate(last, { day: "numeric" });

  if (firstMonth === lastMonth && firstYear === lastYear) {
    return `Week of ${firstDay}–${lastDay} ${lastMonth}`;
  }

  const firstLabel = formatCivilDate(first, {
    month: "short",
    day: "numeric",
  });
  const lastLabel =
    firstYear === lastYear
      ? formatCivilDate(last, {
          month: "short",
          day: "numeric",
        })
      : formatCivilDate(last, {
          month: "short",
          day: "numeric",
          year: "numeric",
        });

  return `Week of ${firstLabel} – ${lastLabel}`;
}
import { DateStrip } from "./date-strip";
import { SortableTaskRow } from "./task-row";

export interface WeekViewProps {
  readonly tasks: readonly Task[];
  readonly selectedDate: string;
  readonly isNarrow: boolean;
  readonly onSelectDate: (date: string) => void;
  readonly onPrevious: () => void;
  readonly onToday: () => void;
  readonly onNext: () => void;
  readonly statusControl: ReactNode;
  readonly selectedTask: Task | null;
  readonly onSelectTask: (task: Task) => void;
  readonly onAdd: (date: string) => void;
  readonly onEdit: (task: Task) => void;
  readonly onToggleComplete: (task: Task) => Promise<boolean>;
  readonly onMove: (
    taskId: string,
    destinationDate: string,
    destinationIndex: number,
  ) => Promise<boolean>;
}

function WeekTaskRow({
  task,
  tasks,
  isSelected,
  onSelect,
  onEdit,
  onToggleComplete,
  onMove,
}: Readonly<{
  task: Task;
  tasks: readonly Task[];
  isSelected: boolean;
  onSelect: (task: Task) => void;
  onEdit: (task: Task) => void;
  onToggleComplete: (task: Task) => Promise<boolean>;
  onMove: WeekViewProps["onMove"];
}>): React.ReactElement {
  const position = task.position ?? 0;
  const sequence = outstandingForDate(tasks, task.scheduled_date);

  return (
    <SortableTaskRow
      task={task}
      index={position}
      group={task.scheduled_date}
      isSelected={isSelected}
      onSelect={() => onSelect(task)}
      onToggleComplete={() => {
        void onToggleComplete(task);
      }}
      onEdit={() => onEdit(task)}
      {...(position > 0
        ? {
            onMoveUp: () => {
              void onMove(
                task.id,
                task.scheduled_date,
                position - 1,
              );
            },
          }
        : {})}
      {...(position < sequence.length - 1
        ? {
            onMoveDown: () => {
              void onMove(
                task.id,
                task.scheduled_date,
                position + 1,
              );
            },
          }
        : {})}
    />
  );
}


export function WeekView({
  tasks,
  selectedDate,
  isNarrow,
  onSelectDate,
  onPrevious,
  onToday,
  onNext,
  statusControl,
  selectedTask,
  onSelectTask,
  onAdd,
  onEdit,
  onToggleComplete,
  onMove,
}: WeekViewProps): React.ReactElement {
  const dates = weekDates(selectedDate);
  const today = todayCivilDate();

  if (isNarrow) {
    return (
      <div className="jig-week-view jig-week-view-narrow">
        <DateStrip
          selectedDate={selectedDate}
          onSelectDate={onSelectDate}
        />

        <div className="jig-mobile-day-heading">
          <h1>
            {formatCivilDate(selectedDate, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </h1>
          <p>Weekly planning context · one selected date</p>
        </div>

        <DayTaskLists
          tasks={tasks}
          selectedDate={selectedDate}
          selectedTask={selectedTask}
          onSelectTask={onSelectTask}
          onEdit={onEdit}
          onToggleComplete={onToggleComplete}
          onMove={onMove}
        />
        <Button
          label="+"
          aria-label="Add task"
          variant="primary"
          size="lg"
          elevation="med"
          className="jig-mobile-quick-add"
          onClick={() => onAdd(selectedDate)}
        />
      </div>
    );
  }

  return (
    <div className="jig-week-view">
      <div className="jig-reference-heading">
        <div>
          <h1>{weekHeading(dates, selectedDate)}</h1>
          <p>Plan attention across the week · drag to an exact position</p>
        </div>
        {statusControl}
      </div>

      <div className="jig-week-toolbar">
        <div className="jig-month-navigation">
          <Button
            label="‹"
            aria-label="Previous week"
            variant="ghost"
            size="sm"
            className="jig-date-step"
            onClick={onPrevious}
          />
          <strong>
            {formatCivilDate(selectedDate, {
              month: "long",
              year: "numeric",
            })}
          </strong>
          <Button
            label="›"
            aria-label="Next week"
            variant="ghost"
            size="sm"
            className="jig-date-step"
            onClick={onNext}
          />
        </div>
        <div className="jig-reference-toolbar-actions">
          <Button
            label="Today"
            variant="secondary"
            size="md"
            className="jig-today-control"
            onClick={onToday}
          />
          <Button
            label="+ Quick add"
            variant="primary"
            onClick={() => onAdd(selectedDate)}
          />
        </div>
      </div>

      <TaskDragProvider tasks={tasks} onMove={onMove}>
        <div className="jig-week-board" role="group" aria-label="Week planner">
          {dates.map((date) => {
            const dateTasks = outstandingForDate(tasks, date);
            return (
              <DateDropZone
                key={date}
                date={date}
                className={[
                  "jig-week-column",
                  date === selectedDate ? "jig-week-column-selected" : "",
                  date === today ? "jig-week-column-today" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <section aria-labelledby={`week-date-${date}`}>
                  <header className="jig-week-column-header">
                    <Button
                      label={formatCivilDate(date, {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                      })}
                      variant="ghost"
                      size="sm"
                      className="jig-date-heading-button"
                      onClick={() => onSelectDate(date)}
                      aria-current={date === selectedDate ? "date" : undefined}
                    >
                      <strong id={`week-date-${date}`}>
                        {formatCivilDate(date, { weekday: "short" })}{" "}
                        {formatCivilDate(date, { day: "numeric" })}
                      </strong>
                    </Button>
                    <span className="jig-task-count" aria-label={`${dateTasks.length} outstanding tasks`}>
                      {dateTasks.length}
                    </span>
                  </header>

                  {dateTasks.length === 0 ? null : (
                    <List density="compact" edge="padded" className="jig-task-card-list">
                      {dateTasks.map((task) => (
                        <WeekTaskRow
                          key={task.id}
                          task={task}
                          tasks={tasks}
                          isSelected={selectedTask?.id === task.id}
                          onSelect={onSelectTask}
                          onEdit={onEdit}
                                          onToggleComplete={onToggleComplete}
                          onMove={onMove}
                        />
                      ))}
                    </List>
                  )}
                  <Button
                    label="+ Add task"
                    variant="ghost"
                    size="sm"
                    onClick={() => onAdd(date)}
                    aria-label={`Add task on ${formatCivilDate(date)}`}
                    className="jig-week-add-task"
                  />
                </section>
              </DateDropZone>
            );
          })}
        </div>
      </TaskDragProvider>
    </div>
  );
}
