import {
  Button,
  List,
} from "@astryxdesign/core";
import type { ReactNode } from "react";
import type { Task } from "../../src/core/task";
import {
  completedForScheduledDate,
  outstandingForDate,
} from "../../src/core/planning";
import { DateDropZone, TaskDragProvider } from "./drag";
import { formatCivilDate } from "./dates";
import { DateStrip } from "./date-strip";
import { SortableTaskRow, TaskRow } from "./task-row";

export interface DayViewProps {
  readonly tasks: readonly Task[];
  readonly selectedDate: string;
  readonly onAdd: (date: string) => void;
  readonly onSelectDate: (date: string) => void;
  readonly onPrevious: () => void;
  readonly onToday: () => void;
  readonly onNext: () => void;
  readonly statusControl: ReactNode;
  readonly onEdit: (task: Task) => void;
  readonly onMoveToDate: (task: Task) => void;
  readonly onToggleComplete: (task: Task) => Promise<boolean>;
  readonly onMove: (
    taskId: string,
    destinationDate: string,
    destinationIndex: number,
  ) => Promise<boolean>;
}

function ActiveRow({
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
  onMove: DayViewProps["onMove"];
}>): React.ReactElement {
  const sequence = outstandingForDate(tasks, task.scheduled_date);
  const position = task.position ?? 0;

  return (
    <SortableTaskRow
      task={task}
      index={position}
      group={task.scheduled_date}
      onToggleComplete={() => {
        void onToggleComplete(task);
      }}
      onEdit={() => onEdit(task)}
      onMoveUp={
        position <= 0
          ? undefined
          : () => {
              void onMove(
                task.id,
                task.scheduled_date,
                position - 1,
              );
            }
      }
      onMoveDown={
        position >= sequence.length - 1
          ? undefined
          : () => {
              void onMove(
                task.id,
                task.scheduled_date,
                position + 1,
              );
            }
      }
      onMoveToDate={() => onMoveToDate(task)}
    />
  );
}

export function DayTaskLists({
  tasks,
  selectedDate,
  onEdit,
  onMoveToDate,
  onToggleComplete,
  onMove,
}: Omit<
  DayViewProps,
  "onAdd" | "onSelectDate" | "onPrevious" | "onToday" | "onNext" | "statusControl"
>): React.ReactElement {
  const active = outstandingForDate(tasks, selectedDate);
  const completed = completedForScheduledDate(tasks, selectedDate);

  return (
    <TaskDragProvider tasks={tasks} onMove={onMove}>
      <div className="jig-day-lists">
        <DateDropZone
          date={selectedDate}
          className="jig-day-scheduled-section"
        >
          <section aria-labelledby="day-attention-heading">
            <div className="jig-section-heading">
              <h2 id="day-attention-heading">Attention</h2>
              <span className="jig-task-count">
                {active.length} {active.length === 1 ? "task" : "tasks"}
              </span>
            </div>
            {active.length === 0 ? (
              <p className="jig-empty-state">
                Nothing scheduled for this date.
              </p>
            ) : (
              <List density="balanced" edge="flush" className="jig-task-card-list">
                {active.map((task) => (
                  <ActiveRow
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
          </section>
        </DateDropZone>

        {completed.length === 0 ? null : (
          <details className="jig-completed-section">
            <summary>Completed ({completed.length})</summary>
            <List density="compact" edge="flush" className="jig-task-card-list">
              {completed.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onToggleComplete={() => {
                    void onToggleComplete(task);
                  }}
                  onEdit={() => onEdit(task)}
                />
              ))}
            </List>
          </details>
        )}
      </div>
    </TaskDragProvider>
  );
}

export function DayView({
  tasks,
  selectedDate,
  onAdd,
  onSelectDate,
  onPrevious,
  onToday,
  onNext,
  statusControl,
  ...listProps
}: DayViewProps): React.ReactElement {
  return (
    <div className="jig-day-view">
      <div className="jig-view-heading">
        <div>
          <p className="jig-eyebrow">Day</p>
          <h1>
            {formatCivilDate(selectedDate, {
              weekday: "long",
              month: "long",
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

      <DateStrip
        selectedDate={selectedDate}
        onSelectDate={onSelectDate}
      />

      <DayTaskLists
        tasks={tasks}
        selectedDate={selectedDate}
        {...listProps}
      />
    </div>
  );
}
