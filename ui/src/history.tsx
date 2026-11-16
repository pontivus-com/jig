import {
  AlertDialog,
  Button,
} from "@astryxdesign/core";
import { useState } from "react";
import type { Task } from "../../src/core/task";
import { historyByCompletionDate } from "../../src/core/planning";
import { formatCivilDate } from "./dates";

export interface HistoryViewProps {
  readonly tasks: readonly Task[];
  readonly onEdit: (task: Task) => void;
  readonly onReopen: (task: Task) => Promise<boolean>;
  readonly onDelete: (taskId: string) => Promise<boolean>;
}

function completionTime(task: Task): string {
  if (task.completed_at === null) {
    return "";
  }
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(task.completed_at));
}

function HistoryTaskRow({
  task,
  onEdit,
  onReopen,
  onDelete,
}: Readonly<{
  task: Task;
  onEdit: (task: Task) => void;
  onReopen: (task: Task) => Promise<boolean>;
  onDelete: (taskId: string) => Promise<boolean>;
}>): React.ReactElement {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);

  return (
    <>
      <div className="jig-history-task-row">
        <span className="jig-history-check" aria-hidden="true">✓</span>
        <div className="jig-history-task-content">
          <strong>{task.title}</strong>
          <span className="jig-secondary-copy">
            {task.context === null ? "" : `${task.context} · `}
            Scheduled {formatCivilDate(task.scheduled_date, {
              weekday: "short",
              day: "numeric",
            })}
          </span>
        </div>
        <time dateTime={task.completed_at ?? undefined}>
          {completionTime(task)}
        </time>
        <div className="jig-task-menu">
          <button
            type="button"
            className="jig-task-menu-trigger"
            aria-label={`Actions for ${task.title}`}
            aria-expanded={actionsOpen}
            onClick={() => setActionsOpen((value) => !value)}
          >
            •••
          </button>
          {actionsOpen ? (
            <div className="jig-task-menu-panel">
              <Button
                label="Reopen"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setActionsOpen(false);
                  void onReopen(task);
                }}
              />
              <Button
                label="Edit"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setActionsOpen(false);
                  onEdit(task);
                }}
              />
              <Button
                label="Delete task…"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setActionsOpen(false);
                  setDeleteOpen(true);
                }}
              />
            </div>
          ) : null}
        </div>
      </div>
      <AlertDialog
        isOpen={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete task?"
        description="This permanently removes the completed task from current Jig data."
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

export function HistoryView({
  tasks,
  onEdit,
  onReopen,
  onDelete,
}: HistoryViewProps): React.ReactElement {
  const timeZone =
    Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const groups = historyByCompletionDate(tasks, timeZone);

  return (
    <div className="jig-history-view">
      <div className="jig-view-heading">
        <div>
          <p className="jig-eyebrow">History</p>
          <h1>Completed work</h1>
          <p className="jig-secondary-copy">
            Grouped by when the task was actually completed.
          </p>
        </div>
      </div>

      {groups.length === 0 ? (
        <p className="jig-empty-state">No completed tasks yet.</p>
      ) : (
        <div className="jig-history-groups">
          {groups.map((group) => (
            <section
              key={group.completion_date}
              aria-labelledby={`history-${group.completion_date}`}
              className="jig-history-group"
            >
              <div className="jig-history-heading">
                <h2 id={`history-${group.completion_date}`}>
                  {formatCivilDate(group.completion_date, {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </h2>
                <span className="jig-secondary-copy">
                  {group.tasks.length} completed
                </span>
              </div>
              <div className="jig-history-task-list">
                {group.tasks.map((task) => (
                  <HistoryTaskRow
                    key={task.id}
                    task={task}
                    onEdit={onEdit}
                    onReopen={onReopen}
                    onDelete={onDelete}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
