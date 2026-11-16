import {
  AlertDialog,
  Button,
  List,
} from "@astryxdesign/core";
import { useState } from "react";
import type { Task } from "../../src/core/task";
import {
  completedForScheduledDate,
  outstandingForDate,
} from "../../src/core/planning";
import { DateDropZone, TaskDragProvider } from "./drag";
import { formatCivilDate, formatReminderTime } from "./dates";
import { DateStrip } from "./date-strip";
import { SortableTaskRow, TaskRow } from "./task-row";

export interface DayViewProps {
  readonly tasks: readonly Task[];
  readonly selectedDate: string;
  readonly onAdd: (date: string) => void;
  readonly onSelectDate: (date: string) => void;
  readonly onEdit: (task: Task) => void;
  readonly onMoveToDate: (task: Task) => void;
  readonly onToggleComplete: (task: Task) => Promise<boolean>;
  readonly onMove: (
    taskId: string,
    destinationDate: string,
    destinationIndex: number,
  ) => Promise<boolean>;
  readonly onPreviousDay: () => void;
  readonly onToday: () => void;
  readonly onNextDay: () => void;
  readonly statusControl: React.ReactNode;
  readonly selectedTask: Task | null;
  readonly onSelectTask: (task: Task) => void;
  readonly onDelete: (taskId: string) => Promise<boolean>;
}

function ActiveRow({
  task,
  tasks,
  onEdit,
  onMoveToDate,
  onToggleComplete,
  onMove,
  onSelectTask,
  selectedTaskId,
}: Readonly<{
  task: Task;
  tasks: readonly Task[];
  onEdit: (task: Task) => void;
  onMoveToDate: (task: Task) => void;
  onToggleComplete: (task: Task) => Promise<boolean>;
  onMove: DayViewProps["onMove"];
  onSelectTask?: ((task: Task) => void) | undefined;
  selectedTaskId?: string | null | undefined;
}>): React.ReactElement {
  const sequence = outstandingForDate(tasks, task.scheduled_date);
  const position = task.position ?? 0;

  return (
    <SortableTaskRow
      task={task}
      index={position}
      group={task.scheduled_date}
      isSelected={selectedTaskId === task.id}
      {...(onSelectTask === undefined
        ? {}
        : { onSelect: () => onSelectTask(task) })}
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
  onSelectTask,
  selectedTaskId,
}: Omit<
  DayViewProps,
  "onAdd" | "onSelectDate" | "onPreviousDay" | "onToday" | "onNextDay" | "statusControl" | "selectedTask" | "onSelectTask" | "onDelete"
> & {
  readonly onSelectTask?: ((task: Task) => void) | undefined;
  readonly selectedTaskId?: string | null | undefined;
}): React.ReactElement {
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
            <h2 id="day-attention-heading">
              Attention <span className="jig-task-count">({active.length})</span>
            </h2>
            {active.length === 0 ? (
              <p className="jig-empty-state">
                Nothing scheduled for this date.
              </p>
            ) : (
              <List density="balanced" edge="flush">
                {active.map((task) => (
                  <ActiveRow
                    key={task.id}
                    task={task}
                    tasks={tasks}
                    onEdit={onEdit}
                    onMoveToDate={onMoveToDate}
                    onToggleComplete={onToggleComplete}
                    onMove={onMove}
                    onSelectTask={onSelectTask}
                    selectedTaskId={selectedTaskId}
                  />
                ))}
              </List>
            )}
          </section>
        </DateDropZone>

        {completed.length === 0 ? null : (
          <details className="jig-completed-section">
            <summary>Completed ({completed.length})</summary>
            <List density="compact" edge="flush">
              {completed.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  isSelected={selectedTaskId === task.id}
                  {...(onSelectTask === undefined
                    ? {}
                    : { onSelect: () => onSelectTask(task) })}
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

function isSafeWebReference(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function TaskInspector({
  task,
  onEdit,
  onMoveToDate,
  onToggleComplete,
  onDelete,
}: Readonly<{
  task: Task | null;
  onEdit: (task: Task) => void;
  onMoveToDate: (task: Task) => void;
  onToggleComplete: (task: Task) => Promise<boolean>;
  onDelete: (taskId: string) => Promise<boolean>;
}>): React.ReactElement {
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (task === null) {
    return (
      <aside className="jig-task-inspector jig-task-inspector-empty">
        <p className="jig-secondary-copy">Select a task to inspect it.</p>
      </aside>
    );
  }

  return (
    <>
      <aside className="jig-task-inspector" aria-label={`Details for ${task.title}`}>
        <div className="jig-task-inspector-heading">
          <h2>{task.title}</h2>
          <div className="jig-view-actions">
            <Button
              label={task.completed_at === null ? "Complete" : "Reopen"}
              variant="secondary"
              size="sm"
              onClick={() => {
                void onToggleComplete(task);
              }}
            />
            <Button label="Edit" variant="secondary" size="sm" onClick={() => onEdit(task)} />
          </div>
        </div>
        <dl className="jig-task-inspector-details">
          {task.context === null ? null : <><dt>Context</dt><dd>{task.context}</dd></>}
          <dt>Priority</dt><dd>{task.priority.toLowerCase()}</dd>
          {task.reminder_time === null ? null : (
            <>
              <dt>Reminder</dt>
              <dd>{formatReminderTime(task.reminder_time)}</dd>
            </>
          )}
          {task.reference === null ? null : (
            <>
              <dt>Reference</dt>
              <dd>
                {isSafeWebReference(task.reference) ? (
                  <a
                    href={task.reference}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open reference
                  </a>
                ) : (
                  <button
                    type="button"
                    className="jig-copy-reference"
                    onClick={() => {
                      void navigator.clipboard.writeText(task.reference ?? "");
                    }}
                  >
                    Copy reference
                  </button>
                )}
              </dd>
            </>
          )}
          {task.note === null ? null : <><dt>Notes</dt><dd>{task.note}</dd></>}
        </dl>
        <div className="jig-task-inspector-actions">
          <Button
            label="Move to date…"
            variant="ghost"
            size="sm"
            onClick={() => onMoveToDate(task)}
          />
          <Button
            label="Delete task…"
            variant="ghost"
            size="sm"
            onClick={() => setDeleteOpen(true)}
          />
        </div>
      </aside>
      <AlertDialog
        isOpen={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete task?"
        description="This permanently removes the task from current Jig data."
        actionLabel="Delete task"
        cancelLabel="Cancel"
        actionVariant="destructive"
        onAction={async () => {
          const deleted = await onDelete(task.id);
          if (deleted) {
            setDeleteOpen(false);
          }
        }}
      />
    </>
  );
}

export function DayView({
  tasks,
  selectedDate,
  onAdd,
  onSelectDate,
  onPreviousDay,
  onToday,
  onNextDay,
  statusControl,
  selectedTask,
  onSelectTask,
  onDelete,
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
          <Button label="Previous" variant="ghost" size="sm" onClick={onPreviousDay} />
          <Button label="Today" variant="ghost" size="sm" onClick={onToday} />
          <Button label="Next" variant="ghost" size="sm" onClick={onNextDay} />
          {statusControl}
          <span className="jig-header-add">
            <Button
              label="Add task"
              variant="primary"
              onClick={() => onAdd(selectedDate)}
            />
          </span>
        </div>
      </div>

      <DateStrip
        selectedDate={selectedDate}
        onSelectDate={onSelectDate}
      />

      <div className="jig-day-layout">
        <DayTaskLists
          tasks={tasks}
          selectedDate={selectedDate}
          onSelectTask={onSelectTask}
          selectedTaskId={selectedTask?.id ?? null}
          {...listProps}
        />
        <TaskInspector
          task={selectedTask}
          onEdit={listProps.onEdit}
          onMoveToDate={listProps.onMoveToDate}
          onToggleComplete={listProps.onToggleComplete}
          onDelete={onDelete}
        />
      </div>
      <div className="jig-mobile-quick-add">
        <Button
          label="+"
          aria-label="Add task"
          variant="primary"
          onClick={() => onAdd(selectedDate)}
        />
      </div>
    </div>
  );
}
