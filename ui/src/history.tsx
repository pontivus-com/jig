import { List } from "@astryxdesign/core";
import type { Task } from "../../src/core/task";
import { historyByCompletionDate } from "../../src/core/planning";
import { formatCivilDate } from "./dates";
import { TaskRow } from "./task-row";

export interface HistoryViewProps {
  readonly tasks: readonly Task[];
  readonly onEdit: (task: Task) => void;
  readonly onReopen: (task: Task) => Promise<boolean>;
}

export function HistoryView({
  tasks,
  onEdit,
  onReopen,
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
              <h2 id={`history-${group.completion_date}`}>
                {formatCivilDate(group.completion_date, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </h2>
              <List density="compact" hasDividers edge="flush">
                {group.tasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onToggleComplete={() => {
                      void onReopen(task);
                    }}
                    onEdit={() => onEdit(task)}
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
