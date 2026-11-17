import {
  DropdownMenu,
  List,
  ListItem,
} from "@astryxdesign/core";
import type { ReactNode } from "react";
import type { Task } from "../../src/core/task";
import { historyByCompletionDate } from "../../src/core/planning";
import { formatCivilDate } from "./dates";

export interface HistoryViewProps {
  readonly tasks: readonly Task[];
  readonly onEdit: (task: Task) => void;
  readonly onReopen: (task: Task) => Promise<boolean>;
  readonly onDelete: (task: Task) => void;
  readonly statusControl: ReactNode;
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
  onDelete: (task: Task) => void;
}>): React.ReactElement {
  return (
    <ListItem
      itemKey={task.id}
      className="jig-history-task-row"
      align="first-line"
      startContent={
        <span className="jig-history-complete-indicator" aria-hidden="true">
          ✓
        </span>
      }
      label={<span className="jig-task-title">{task.title}</span>}
      description={
        <span className="jig-task-meta">
          {task.context === null ? null : (
            <span className="jig-task-meta-item">{task.context}</span>
          )}
          <span className="jig-task-meta-item">
            Scheduled {formatCivilDate(task.scheduled_date, {
              weekday: "short",
              day: "numeric",
            })}
          </span>
        </span>
      }
      endContent={
        <div className="jig-history-end">
          <time dateTime={task.completed_at ?? undefined}>
            {completionTime(task)}
          </time>
          <div
            className="jig-task-menu"
            onClick={(event) => event.stopPropagation()}
          >
            <DropdownMenu
              button={{
                label: `Actions for ${task.title}`,
                icon: <span aria-hidden="true">•••</span>,
                isIconOnly: true,
                variant: "ghost",
                size: "sm",
                className: "jig-task-menu-trigger",
              }}
              items={[
                {
                  id: "reopen",
                  label: "Reopen",
                  onClick: () => {
                    void onReopen(task);
                  },
                },
                {
                  id: "edit",
                  label: "Edit",
                  onClick: () => onEdit(task),
                },
                {
                  id: "delete",
                  label: "Delete…",
                  onClick: () => onDelete(task),
                },
              ]}
              placement="below"
              alignment="end"
            />
          </div>
        </div>
      }
    />
  );
}

export function HistoryView({
  tasks,
  onEdit,
  onReopen,
  onDelete,
  statusControl,
}: HistoryViewProps): React.ReactElement {
  const timeZone =
    Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const groups = historyByCompletionDate(tasks, timeZone);

  return (
    <div className="jig-history-view">
      <div className="jig-reference-heading">
        <div>
          <h1>History</h1>
          <p>Completed work grouped by actual completion date</p>
        </div>
        {statusControl}
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
              <div className="jig-history-group-heading">
                <h2 id={`history-${group.completion_date}`}>
                  {formatCivilDate(group.completion_date, {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </h2>
                <span className="jig-task-count">
                  {group.tasks.length} completed
                </span>
              </div>
              <List density="compact" edge="flush">
                {group.tasks.map((task) => (
                  <HistoryTaskRow
                    key={task.id}
                    task={task}
                    onEdit={onEdit}
                    onReopen={onReopen}
                    onDelete={onDelete}
                  />
                ))}
              </List>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
