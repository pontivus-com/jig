import { Button, Link } from "@astryxdesign/core";
import type { Task } from "../../src/core/task";
import { formatCivilDate, formatReminderTime } from "./dates";

export interface TaskInspectorProps {
  readonly task: Task | null;
  readonly onToggleComplete: (task: Task) => Promise<boolean>;
  readonly onEdit: (task: Task) => void;
  readonly onMoveToDate: (task: Task) => void;
  readonly onDelete: (task: Task) => void;
  readonly showHeading?: boolean;
  readonly surface?: "docked" | "drawer";
}

function isSafeWebReference(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function TaskInspector({
  task,
  onToggleComplete,
  onEdit,
  onMoveToDate,
  onDelete,
  showHeading = true,
  surface = "docked",
}: TaskInspectorProps): React.ReactElement {
  if (task === null) {
    return (
      <aside
        className={[
          "jig-task-inspector",
          "jig-task-inspector-empty",
          surface === "drawer" ? "jig-task-inspector-drawer" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <p>Select a task to inspect its details.</p>
      </aside>
    );
  }

  return (
    <aside
      className={[
        "jig-task-inspector",
        surface === "drawer" ? "jig-task-inspector-drawer" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={`Task details for ${task.title}`}
    >
      {showHeading ? (
        <div className="jig-task-inspector-heading">
          <div>
            <p className="jig-eyebrow">Selected task</p>
            <h2>{task.title}</h2>
          </div>
        </div>
      ) : null}

      <div className="jig-task-inspector-actions">
        <Button
          label={task.completed_at === null ? "✓ Mark complete" : "Reopen"}
          variant={task.completed_at === null ? "primary" : "secondary"}
          size="sm"
          onClick={() => {
            void onToggleComplete(task);
          }}
        />
        <Button
          label="Edit"
          variant="ghost"
          size="sm"
          onClick={() => onEdit(task)}
        />
        <Button
          label="Move to date"
          variant="ghost"
          size="sm"
          onClick={() => onMoveToDate(task)}
        />
        <Button
          label="Delete…"
          variant="ghost"
          size="sm"
          className="jig-inspector-delete"
          onClick={() => onDelete(task)}
        />
      </div>

      <dl className="jig-task-inspector-details">
        {task.context === null ? null : (
          <div>
            <dt>Context</dt>
            <dd>{task.context}</dd>
          </div>
        )}
        <div>
          <dt>Priority</dt>
          <dd>{task.priority.toLowerCase()}</dd>
        </div>
        {task.reminder_time === null ? null : (
          <div>
            <dt>Reminder</dt>
            <dd>{formatReminderTime(task.reminder_time)}</dd>
          </div>
        )}
        {task.reference === null ? null : (
          <div>
            <dt>Reference</dt>
            <dd>
              {isSafeWebReference(task.reference) ? (
                <Link
                  href={task.reference}
                  target="_blank"
                  type="inherit"
                  hasUnderline
                >
                  Open reference
                </Link>
              ) : (
                <Button
                  label="Copy reference"
                  variant="ghost"
                  size="sm"
                  className="jig-copy-reference"
                  onClick={() => {
                    void navigator.clipboard.writeText(task.reference ?? "");
                  }}
                />
              )}
            </dd>
          </div>
        )}
        {task.note === null ? null : (
          <div>
            <dt>Notes</dt>
            <dd>{task.note}</dd>
          </div>
        )}
      </dl>

      <div className="jig-task-inspector-summary">
        <strong>
          Scheduled{" "}
          {formatCivilDate(task.scheduled_date, { weekday: "short" })}{" "}
          {formatCivilDate(task.scheduled_date, { day: "numeric" })}
          {task.reminder_time === null
            ? ""
            : ` · ${formatReminderTime(task.reminder_time)}`}
        </strong>
        <span>Rolled-forward cards use their current scheduled date</span>
      </div>
    </aside>
  );
}
