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
  readonly onAdd: (date: string) => void;
  readonly onEdit: (task: Task) => void;
  readonly onMoveToDate: (task: Task) => void;
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
  onEdit,
  onMoveToDate,
  onToggleComplete,
  onMove,
}: Readonly<{
  task: Task;
  tasks: readonly Task[];
  onEdit: (task: Task) => void;
  onMoveToDate: (task: Task) => void;
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
      onMoveToDate={() => onMoveToDate(task)}
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
  onAdd,
  onEdit,
  onMoveToDate,
  onToggleComplete,
  onMove,
}: WeekViewProps): React.ReactElement {
  const dates = weekDates(selectedDate);
  const today = todayCivilDate();

  if (isNarrow) {
    return (
      <div className="jig-week-view jig-week-view-narrow">
        <div className="jig-view-heading">
          <div>
            <p className="jig-eyebrow">Week</p>
            <h1>Plan the week</h1>
          </div>
          <div className="jig-view-actions">
            <Button label="Previous" variant="ghost" size="sm" onClick={onPrevious} />
            <Button label="Today" variant="ghost" size="sm" onClick={onToday} />
            <Button label="Next" variant="ghost" size="sm" onClick={onNext} />
            {statusControl}
            <Button
              label="Add task"
              variant="primary"
              onClick={() => onAdd(selectedDate)}
            />
          </div>
        </div>
        <DateStrip
          selectedDate={selectedDate}
          onSelectDate={onSelectDate}
        />
        <DayTaskLists
          tasks={tasks}
          selectedDate={selectedDate}
          onEdit={onEdit}
          onMoveToDate={onMoveToDate}
          onToggleComplete={onToggleComplete}
          onMove={onMove}
        />
      </div>
    );
  }

  return (
    <div className="jig-week-view">
      <div className="jig-view-heading">
        <div>
          <p className="jig-eyebrow">Week</p>
          <h1>
            {formatCivilDate(dates[0] ?? selectedDate, {
              month: "short",
              day: "numeric",
            })}
            {" – "}
            {formatCivilDate(dates[6] ?? selectedDate, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </h1>
        </div>
        <div className="jig-view-actions">
          <Button label="Previous" variant="ghost" size="sm" onClick={onPrevious} />
          <Button label="Today" variant="ghost" size="sm" onClick={onToday} />
          <Button label="Next" variant="ghost" size="sm" onClick={onNext} />
          {statusControl}
          <Button
            label="Add task"
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
                    <button
                      type="button"
                      className="jig-date-heading-button"
                      onClick={() => onSelectDate(date)}
                      aria-current={date === selectedDate ? "date" : undefined}
                    >
                      <span className="jig-weekday-line">
                        <span>{formatCivilDate(date, { weekday: "short" })}</span>
                        {date === today ? <small>Today</small> : null}
                      </span>
                      <strong id={`week-date-${date}`}>
                        {formatCivilDate(date, {
                          month: "short",
                          day: "numeric",
                        })}
                      </strong>
                    </button>
                    <span className="jig-task-count" aria-label={`${dateTasks.length} outstanding tasks`}>
                      {dateTasks.length}
                    </span>
                  </header>

                  {dateTasks.length === 0 ? (
                    <p className="jig-empty-column">Drop or add a task</p>
                  ) : (
                    <List density="compact" edge="flush" className="jig-task-card-list">
                      {dateTasks.map((task) => (
                        <WeekTaskRow
                          key={task.id}
                          task={task}
                          tasks={tasks}
                          onEdit={onEdit}
                          onMoveToDate={onMoveToDate}
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
