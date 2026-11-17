import {
  Button,
  CheckboxInput,
  ListItem,
} from "@astryxdesign/core";
import { useSortable } from "@dnd-kit/react/sortable";
import { useState, type Ref } from "react";
import type { Task } from "../../src/core/task";
import { formatReminderTime } from "./dates";

export interface TaskRowProps {
  readonly task: Task;
  readonly isSelected?: boolean | undefined;
  readonly rowRef?: Ref<HTMLLIElement> | undefined;
  readonly dragHandleRef?: Ref<HTMLDivElement> | undefined;
  readonly onSelect?: (() => void) | undefined;
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

function stopPointer(event: React.PointerEvent): void {
  event.stopPropagation();
}

function TaskMetadata({
  task,
}: Readonly<{ task: Task }>): React.ReactElement {
  return (
    <div className="jig-task-meta">
      {task.context === null ? null : (
        <span className="jig-task-meta-item">{task.context}</span>
      )}
      {task.reminder_time === null ? null : (
        <span className="jig-task-meta-item jig-reminder-time">
          <span aria-hidden="true">◷</span>{" "}
          {formatReminderTime(task.reminder_time)}
        </span>
      )}
      {task.priority === "NORMAL" ? null : (
        <span
          className={[
            "jig-task-meta-item",
            "jig-priority-label",
            `jig-priority-${task.priority.toLowerCase()}`,
          ].join(" ")}
        >
          {task.priority.toLowerCase()}
        </span>
      )}
      {task.reference === null ? null : isSafeWebReference(task.reference) ? (
        <a
          className="jig-task-meta-item"
          href={task.reference}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open reference"
          onPointerDown={stopPointer}
          onClick={(event) => event.stopPropagation()}
        >
          Reference
        </a>
      ) : (
        <button
          type="button"
          className="jig-copy-reference jig-task-meta-item"
          aria-label="Copy reference"
          onPointerDown={stopPointer}
          onClick={(event) => {
            event.stopPropagation();
            void navigator.clipboard.writeText(task.reference ?? "");
          }}
        >
          Reference
        </button>
      )}
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
  const [isOpen, setIsOpen] = useState(false);

  const closeAndRun = (
    event: React.MouseEvent<HTMLElement>,
    action: () => void,
  ): void => {
    event.stopPropagation();
    setIsOpen(false);
    action();
  };

  return (
    <div
      className="jig-task-menu"
      onPointerDown={stopPointer}
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        className="jig-task-menu-trigger"
        aria-label={`Actions for ${task.title}`}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        •••
      </button>
      {isOpen ? (
        <div className="jig-task-menu-panel" role="menu">
          <Button
            label="Edit"
            variant="ghost"
            size="sm"
            onClick={(event) => closeAndRun(event, onEdit)}
          />
          {onMoveToDate === undefined ? null : (
            <Button
              label="Move to date…"
              variant="ghost"
              size="sm"
              onClick={(event) => closeAndRun(event, onMoveToDate)}
            />
          )}
          {onMoveUp === undefined ? null : (
            <Button
              label="Move up"
              variant="ghost"
              size="sm"
              onClick={(event) => closeAndRun(event, onMoveUp)}
            />
          )}
          {onMoveDown === undefined ? null : (
            <Button
              label="Move down"
              variant="ghost"
              size="sm"
              onClick={(event) => closeAndRun(event, onMoveDown)}
            />
          )}
        </div>
      ) : null}
    </div>
  );
}

export function TaskCardPreview({
  task,
}: Readonly<{ task: Task }>): React.ReactElement {
  return (
    <div className="jig-task-card jig-drag-card-overlay" aria-hidden="true">
      <div className="jig-task-card-preview-row">
        <span className="jig-task-card-preview-checkbox">□</span>
        <span className="jig-task-drag-handle" aria-hidden="true">
          ≡
        </span>
        <span className="jig-task-title">{task.title}</span>
        <span className="jig-task-card-preview-menu">•••</span>
      </div>
      <TaskMetadata task={task} />
    </div>
  );
}

export function TaskRow({
  task,
  isSelected = false,
  rowRef,
  dragHandleRef,
  onSelect,
  onToggleComplete,
  onEdit,
  onMoveUp,
  onMoveDown,
  onMoveToDate,
}: TaskRowProps): React.ReactElement {
  const completed = task.completed_at !== null;

  return (
    <ListItem
      {...(rowRef === undefined ? {} : { ref: rowRef })}
      itemKey={task.id}
      className={[
        "jig-task-card",
        isSelected ? "jig-task-card-selected" : "",
        completed ? "jig-task-card-completed" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      isSelected={isSelected}
      align="first-line"
      startContent={
        <span
          className="jig-task-card-leading"
          onPointerDown={stopPointer}
          onClick={(event) => event.stopPropagation()}
        >
          <CheckboxInput
            label={completed ? `Reopen ${task.title}` : `Complete ${task.title}`}
            isLabelHidden
            value={completed}
            onChange={onToggleComplete}
            size="sm"
          />
        </span>
      }
      label={
        <div
          {...(dragHandleRef === undefined ? {} : { ref: dragHandleRef })}
          className="jig-task-body"
          {...(completed ? {} : { tabIndex: 0 })}
          {...(onSelect === undefined
            ? {}
            : {
                onClick: onSelect,
                onFocus: onSelect,
              })}
        >
          <div className="jig-task-title-row">
            {completed ? null : (
              <span
                className="jig-task-drag-handle"
                aria-hidden="true"
                title="Drag task"
              >
                ≡
              </span>
            )}
            <span
              className={
                completed
                  ? "jig-task-title jig-task-title-completed"
                  : "jig-task-title"
              }
            >
              {task.title}
            </span>
          </div>
          <TaskMetadata task={task} />
        </div>
      }
      endContent={
        <TaskActionMenu
          task={task}
          onEdit={onEdit}
          {...(onMoveUp === undefined ? {} : { onMoveUp })}
          {...(onMoveDown === undefined ? {} : { onMoveDown })}
          {...(onMoveToDate === undefined ? {} : { onMoveToDate })}
        />
      }
    />
  );
}

export interface SortableTaskRowProps
  extends Omit<TaskRowProps, "rowRef" | "dragHandleRef"> {
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

  return (
    <TaskRow
      {...rowProps}
      task={task}
      rowRef={sortable.ref as Ref<HTMLLIElement>}
      dragHandleRef={sortable.handleRef as Ref<HTMLDivElement>}
    />
  );
}
