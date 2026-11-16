import {
  Button,
  CheckboxInput,
} from "@astryxdesign/core";
import { useSortable } from "@dnd-kit/react/sortable";
import type { Ref } from "react";
import type { Task } from "../../src/core/task";
import { formatReminderTime } from "./dates";

export interface TaskRowProps {
  readonly task: Task;
  readonly isSelected?: boolean | undefined;
  readonly rowRef?: Ref<HTMLLIElement> | undefined;
  readonly isSortable?: boolean | undefined;
  readonly onToggleComplete: () => void;
  readonly onEdit: () => void;
  readonly onMoveUp?: (() => void) | undefined;
  readonly onMoveDown?: (() => void) | undefined;
  readonly onMoveToDate?: (() => void) | undefined;
}

function isSafeWebReference(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function stopDrag(event: React.SyntheticEvent): void {
  event.stopPropagation();
}

function TaskMetadata({
  task,
}: Readonly<{ task: Task }>): React.ReactElement | null {
  const items = [
    task.context,
    task.reminder_time === null
      ? null
      : formatReminderTime(task.reminder_time),
    task.priority === "NORMAL"
      ? null
      : task.priority.toLowerCase(),
  ].filter((item): item is string => item !== null);

  return items.length === 0 ? null : (
    <div className="jig-task-meta">
      {items.map((item) => (
        <span key={item}>{item}</span>
      ))}
    </div>
  );
}

export function TaskCardPreview({
  task,
}: Readonly<{ task: Task }>): React.ReactElement {
  return (
    <div className="jig-task-card jig-drag-card-overlay" aria-hidden="true">
      <div className="jig-task-card-row">
        <span className="jig-task-checkbox-ghost">□</span>
        <span className="jig-task-drag-handle">≡</span>
        <div className="jig-task-card-content">
          <span className="jig-task-title">{task.title}</span>
          <TaskMetadata task={task} />
        </div>
        <span className="jig-task-menu-glyph">•••</span>
      </div>
    </div>
  );
}

function TaskActionMenu({
  task,
  onEdit,
  onMoveUp,
  onMoveDown,
  onMoveToDate,
}: Readonly<{
  task: Task;
  onEdit: () => void;
  onMoveUp?: (() => void) | undefined;
  onMoveDown?: (() => void) | undefined;
  onMoveToDate?: (() => void) | undefined;
}>): React.ReactElement {
  return (
    <details
      className="jig-task-menu"
      onPointerDown={stopDrag}
      onClick={stopDrag}
    >
      <summary aria-label={`Actions for ${task.title}`}>•••</summary>
      <div className="jig-task-menu-panel">
        <Button label="Edit" variant="ghost" size="sm" onClick={onEdit} />
        {onMoveToDate === undefined ? null : (
          <Button
            label="Move to date…"
            variant="ghost"
            size="sm"
            onClick={onMoveToDate}
          />
        )}
        {onMoveUp === undefined ? null : (
          <Button
            label="Move up"
            variant="ghost"
            size="sm"
            onClick={onMoveUp}
          />
        )}
        {onMoveDown === undefined ? null : (
          <Button
            label="Move down"
            variant="ghost"
            size="sm"
            onClick={onMoveDown}
          />
        )}
        {task.reference === null ? null : isSafeWebReference(task.reference) ? (
          <a
            className="jig-task-menu-link"
            href={task.reference}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open reference
          </a>
        ) : (
          <Button
            label="Copy reference"
            variant="ghost"
            size="sm"
            onClick={() => {
              void navigator.clipboard.writeText(task.reference ?? "");
            }}
          />
        )}
      </div>
    </details>
  );
}

export function TaskRow({
  task,
  isSelected = false,
  rowRef,
  isSortable = false,
  onToggleComplete,
  onEdit,
  onMoveUp,
  onMoveDown,
  onMoveToDate,
}: TaskRowProps): React.ReactElement {
  const completed = task.completed_at !== null;

  return (
    <li
      ref={rowRef}
      className={[
        "jig-task-card",
        isSortable ? "jig-task-card-sortable" : "",
        isSelected ? "jig-task-card-selected" : "",
        completed ? "jig-task-card-completed" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-task-id={task.id}
      tabIndex={isSortable ? 0 : undefined}
      aria-label={isSortable ? `Task ${task.title}. Drag to move.` : undefined}
    >
      <div className="jig-task-card-row">
        <div
          className="jig-task-checkbox"
          onPointerDown={stopDrag}
          onClick={stopDrag}
        >
          <CheckboxInput
            label={completed ? `Reopen ${task.title}` : `Complete ${task.title}`}
            isLabelHidden
            value={completed}
            onChange={onToggleComplete}
            size="sm"
          />
        </div>

        {isSortable ? (
          <span className="jig-task-drag-handle" aria-hidden="true">
            ≡
          </span>
        ) : null}

        <div className="jig-task-card-content">
          <span
            className={
              completed
                ? "jig-task-title jig-task-title-completed"
                : "jig-task-title"
            }
          >
            {task.title}
          </span>
          <TaskMetadata task={task} />
        </div>

        <TaskActionMenu
          task={task}
          onEdit={onEdit}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
          onMoveToDate={onMoveToDate}
        />
      </div>
    </li>
  );
}

function setRef<T>(ref: Ref<T>, node: T | null): void {
  if (typeof ref === "function") {
    ref(node);
    return;
  }
  if (ref !== null) {
    (ref as { current: T | null }).current = node;
  }
}

export interface SortableTaskRowProps
  extends Omit<TaskRowProps, "rowRef" | "isSortable"> {
  readonly index: number;
  readonly group: string;
}

export function SortableTaskRow({
  task,
  index,
  group,
  ...rowProps
}: SortableTaskRowProps): React.ReactElement {
  const sortable = useSortable({
    id: task.id,
    index,
    group,
    type: "jig-task",
    accept: "jig-task",
  });

  const sortableRef = sortable.ref as Ref<HTMLLIElement>;
  const activatorRef = sortable.handleRef as Ref<HTMLLIElement>;

  return (
    <TaskRow
      {...rowProps}
      task={task}
      isSortable
      rowRef={(node) => {
        setRef(sortableRef, node);
        setRef(activatorRef, node);
      }}
    />
  );
}
