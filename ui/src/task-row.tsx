import {
  Button,
  CheckboxInput,
  DropdownMenu,
  Icon,
  Link,
  ListItem,
} from "@astryxdesign/core";
import type { DropdownMenuItemData } from "@astryxdesign/core/DropdownMenu";
import { useDraggable } from "@dnd-kit/react";
import type { Ref } from "react";
import type { RecurrenceSeries } from "../../src/core/recurrence";
import type { Priority, Task } from "../../src/core/task";
import { isReminderDue } from "../../src/core/reminder";
import { formatReminderTime } from "./dates";
import { JigIcon } from "./jig-icons";
import { recurrenceSummary } from "./task-editor";

export interface TaskRowProps {
  readonly task: Task;
  readonly recurrenceSeries?: RecurrenceSeries | null;
  readonly now: Date;
  readonly isSelected?: boolean | undefined;
  readonly rowRef?: Ref<HTMLLIElement> | undefined;
  readonly dragHandleRef?: Ref<HTMLSpanElement> | undefined;
  readonly isDragging?: boolean | undefined;
  readonly onSelect?: (() => void) | undefined;
  readonly onToggleComplete: () => void;
  readonly onEdit: () => void;
  readonly onSetPriority: (priority: Priority) => void;
  readonly onDelete: () => void;
  readonly onMoveUp?: (() => void) | undefined;
  readonly onMoveDown?: (() => void) | undefined;
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
  recurrenceSeries = null,
}: Readonly<{
  task: Task;
  recurrenceSeries?: RecurrenceSeries | null;
}>): React.ReactElement {
  return (
    <div className="jig-task-meta">
      {task.context === null ? null : (
        <span className="jig-task-meta-item">{task.context}</span>
      )}
      {task.reminder_time === null ? null : (
        <span className="jig-task-meta-item jig-reminder-time">
          <Icon icon="clock" size="xsm" color="secondary" />
          {formatReminderTime(task.reminder_time)}
        </span>
      )}
      {task.recurrence_series_id === null ? null : (
        <span
          className="jig-task-meta-item jig-repeat-indicator"
          aria-label={
            recurrenceSeries === null
              ? "Recurring task"
              : `Recurring task: ${recurrenceSummary(recurrenceSeries)}`
          }
        >
          {recurrenceSeries === null
            ? "Repeats"
            : recurrenceSummary(recurrenceSeries)}
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
        <Link
          data-jig-drag-excluded="true"
          className="jig-task-meta-item"
          href={task.reference}
          target="_blank"
          type="inherit"
          hasUnderline
          onPointerDown={stopPointer}
          onClick={(event) => event.stopPropagation()}
        >
          <span className="jig-reference-link-content">
            <Icon icon="externalLink" size="xsm" color="inherit" />
            Open reference
          </span>
        </Link>
      ) : (
        <Button
          data-jig-drag-excluded="true"
          label="Copy reference"
          variant="ghost"
          icon={<Icon icon="copy" size="xsm" color="inherit" />}
          className="jig-copy-reference jig-task-meta-item"
          onPointerDown={stopPointer}
          onClick={(event) => {
            event.stopPropagation();
            void navigator.clipboard.writeText(task.reference ?? "");
          }}
        >
          Reference
        </Button>
      )}
    </div>
  );
}

function priorityMenuItems(
  task: Task,
  onSetPriority: (priority: Priority) => void,
): DropdownMenuItemData[] {
  return ([
    ["HIGH", "High"],
    ["NORMAL", "Normal"],
    ["LOW", "Low"],
  ] as const).map(([priority, label]) => ({
    id: `priority-${priority.toLowerCase()}`,
    label: `Priority: ${label}`,
    endContent:
      task.priority === priority ? (
        <span aria-label="Current priority">
          <Icon icon="check" size="xsm" color="inherit" />
        </span>
      ) : undefined,
    onClick: () => onSetPriority(priority),
  }));
}

export interface TaskActionMenuProps {
  readonly task: Task;
  readonly onEdit: () => void;
  readonly onToggleComplete: () => void;
  readonly onSetPriority: (priority: Priority) => void;
  readonly onDelete: () => void;
  readonly onMoveUp?: (() => void) | undefined;
  readonly onMoveDown?: (() => void) | undefined;
}

function taskActionMenuItems({
  task,
  onEdit,
  onToggleComplete,
  onSetPriority,
  onDelete,
  onMoveUp,
  onMoveDown,
}: TaskActionMenuProps): DropdownMenuItemData[] {
  return [
    {
      id: "edit",
      label: "Open / edit",
      icon: <JigIcon name="edit" color="inherit" />,
      onClick: onEdit,
    },
    {
      id: task.completed_at === null ? "complete" : "reopen",
      label: task.completed_at === null ? "Complete" : "Reopen",
      icon: <Icon icon="check" size="sm" color="inherit" />,
      onClick: onToggleComplete,
    },
    ...priorityMenuItems(task, onSetPriority),
    ...(onMoveUp === undefined
      ? []
      : [
          {
            id: "move-up",
            label: "Move up",
            icon: <Icon icon="arrowUp" size="sm" color="inherit" />,
            onClick: onMoveUp,
          },
        ]),
    ...(onMoveDown === undefined
      ? []
      : [
          {
            id: "move-down",
            label: "Move down",
            icon: <Icon icon="arrowDown" size="sm" color="inherit" />,
            onClick: onMoveDown,
          },
        ]),
    {
      id: "delete",
      label: "Delete…",
      icon: <JigIcon name="delete" color="inherit" />,
      onClick: onDelete,
    },
  ];
}

export function TaskActionMenu(
  props: TaskActionMenuProps,
): React.ReactElement {
  const { task } = props;
  const items = taskActionMenuItems(props);

  return (
    <div
      data-jig-drag-excluded="true"
      className="jig-task-menu"
      onPointerDown={stopPointer}
      onClick={(event) => event.stopPropagation()}
    >
      <DropdownMenu
        button={{
          label: `Actions for ${task.title}`,
          icon: <Icon icon="moreHorizontal" color="inherit" />,
          isIconOnly: true,
          variant: "ghost",
          className: "jig-task-menu-trigger",
        }}
        items={items}
        placement="below"
        alignment="end"
      />
    </div>
  );
}

export function TaskCardPreview({
  task,
}: Readonly<{ task: Task }>): React.ReactElement {
  return (
    <div
      className={`jig-task-card jig-task-priority-${task.priority.toLowerCase()} jig-drag-card-overlay`}
      aria-hidden="true"
    >
      <div className="jig-task-card-preview-row">
        <span className="jig-task-card-preview-checkbox">□</span>
        <span className="jig-task-title">{task.title}</span>
        <Icon icon="moreHorizontal" color="secondary" />
      </div>
      <TaskMetadata task={task} />
    </div>
  );
}

export function TaskRow({
  task,
  recurrenceSeries = null,
  now,
  isSelected = false,
  rowRef,
  dragHandleRef,
  isDragging = false,
  onSelect,
  onToggleComplete,
  onEdit,
  onSetPriority,
  onDelete,
  onMoveUp,
  onMoveDown,
}: TaskRowProps): React.ReactElement {
  const completed = task.completed_at !== null;
  const reminderDue = isReminderDue(task, now);

  return (
    <ListItem
      {...(rowRef === undefined ? {} : { ref: rowRef })}
      itemKey={task.id}
      {...(onSelect === undefined ? {} : { onClick: onSelect })}
      className={[
        "jig-task-card",
        `jig-task-priority-${task.priority.toLowerCase()}`,
        isSelected ? "jig-task-card-selected" : "",
        completed ? "jig-task-card-completed" : "",
        reminderDue ? "jig-task-card-reminder-due" : "",
        isDragging ? "jig-task-card-dragging" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      isSelected={isSelected}
      align="first-line"
      startContent={
        <span
          className="jig-task-card-leading"
          data-jig-drag-excluded="true"
        >
          {dragHandleRef === undefined ? null : (
            <span
              ref={dragHandleRef}
              className="jig-task-drag-handle"
              role="button"
              tabIndex={0}
              aria-label={`Move ${task.title}`}
              onClick={(event) => event.stopPropagation()}
            >
              <JigIcon name="drag" color="inherit" size="sm" />
            </span>
          )}
          <CheckboxInput
            label={completed ? `Reopen ${task.title}` : `Complete ${task.title}`}
            isLabelHidden
            value={completed}
            onChange={onToggleComplete}
          />
        </span>
      }
      label={
        <div className="jig-task-body">
          <div className="jig-task-title-row">
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
          <TaskMetadata task={task} recurrenceSeries={recurrenceSeries} />
          {reminderDue ? (
            <span className="jig-reminder-due-indicator" aria-label="Reminder due">
              <Icon icon="clock" size="xsm" color="inherit" />
              Reminder due
            </span>
          ) : null}
        </div>
      }
      endContent={
        <TaskActionMenu
          task={task}
          onEdit={onEdit}
          onToggleComplete={onToggleComplete}
          onSetPriority={onSetPriority}
          onDelete={onDelete}
          {...(onMoveUp === undefined ? {} : { onMoveUp })}
          {...(onMoveDown === undefined ? {} : { onMoveDown })}
        />
      }
    />
  );
}

export interface DraggableTaskRowProps
  extends Omit<
    TaskRowProps,
    "rowRef" | "dragHandleRef" | "isDragging"
  > {
  readonly index: number;
}

export function DraggableTaskRow({
  task,
  index,
  ...rowProps
}: DraggableTaskRowProps): React.ReactElement {
  const draggable = useDraggable({
    id: task.id,
    type: "jig-task",
    data: {
      date: task.scheduled_date,
      index,
    },
  });

  const rowRef = (element: HTMLLIElement | null): void => {
    draggable.ref(element);
  };
  const dragHandleRef = (element: HTMLSpanElement | null): void => {
    draggable.handleRef(element);
  };

  return (
    <TaskRow
      {...rowProps}
      task={task}
      rowRef={rowRef}
      dragHandleRef={dragHandleRef}
      isDragging={draggable.isDragging}
    />
  );
}
