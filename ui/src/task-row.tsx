import {
  Button,
  CheckboxInput,
  DropdownMenu,
  Icon,
  Link,
  ListItem,
} from "@astryxdesign/core";
import type { DropdownMenuItemData } from "@astryxdesign/core/DropdownMenu";
import { useRef, type Ref } from "react";
import type { RecurrenceSeries } from "../../src/core/recurrence";
import type { Priority, Task } from "../../src/core/task";
import { formatReminderTime } from "./dates";
import { JigIcon } from "./jig-icons";
import { useReminderLifecycle } from "./reminder";
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
  interactiveReference = true,
}: Readonly<{
  task: Task;
  recurrenceSeries?: RecurrenceSeries | null;
  interactiveReference?: boolean;
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
      {task.reference === null ? null : !interactiveReference ? (
        <span className="jig-task-reference-action jig-task-meta-item">
          <Icon icon="externalLink" size="xsm" color="secondary" />
          Reference
        </span>
      ) : isSafeWebReference(task.reference) ? (
        <Link
          data-jig-drag-excluded="true"
          className="jig-task-reference-action jig-task-meta-item"
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
          className="jig-task-reference-action jig-copy-reference jig-task-meta-item"
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

function TaskCompletionControl({
  task,
  completed,
  onToggleComplete,
}: Readonly<{
  task: Task;
  completed: boolean;
  onToggleComplete: () => void;
}>): React.ReactElement {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <span
      className="jig-task-completion-target"
      data-jig-drag-excluded="true"
      onClick={(event) => {
        // Astryx CheckboxInput intentionally keeps a label-hidden checkbox as
        // a 24px marker and exposes no public control-class hook. The Task row
        // cannot own that checkbox's hit area because the independent drag
        // grip shares the same leading region. This wrapper is therefore the
        // smallest Jig-owned semantic fallback: it retains Astryx's checkbox
        // and native input semantics while forwarding only otherwise-empty
        // 48px target space through the component's public input ref.
        if (event.target === event.currentTarget) {
          inputRef.current?.click();
        }
        event.stopPropagation();
      }}
    >
      <CheckboxInput
        ref={inputRef}
        label={completed ? `Reopen ${task.title}` : `Complete ${task.title}`}
        isLabelHidden
        value={completed}
        onChange={onToggleComplete}
      />
    </span>
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
      <TaskMetadata task={task} interactiveReference={false} />
    </div>
  );
}

export function TaskCardPassivePreview({
  task,
  recurrenceSeries = null,
}: Readonly<{
  task: Task;
  recurrenceSeries?: RecurrenceSeries | null;
}>): React.ReactElement {
  return (
    <div
      className={[
        "jig-week-preview-card",
        "jig-week-preview-priority-" + task.priority.toLowerCase(),
      ].join(" ")}
    >
      <span className="jig-week-preview-card-leading" aria-hidden="true">
        <span className="jig-week-preview-card-drag-handle">
          <JigIcon name="drag" color="inherit" size="sm" />
        </span>
        <span className="jig-week-preview-card-checkbox">□</span>
      </span>
      <div className="jig-task-body">
        <span className="jig-task-title">{task.title}</span>
        <TaskMetadata
          task={task}
          recurrenceSeries={recurrenceSeries}
          interactiveReference={false}
        />
      </div>
      <span className="jig-week-preview-card-end" aria-hidden="true">
        <Icon icon="moreHorizontal" color="secondary" />
      </span>
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
  const reminderLifecycle = useReminderLifecycle(task, now);
  const reminderDue = reminderLifecycle === "due";

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
          <TaskCompletionControl
            task={task}
            completed={completed}
            onToggleComplete={onToggleComplete}
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
          {reminderLifecycle === "scheduled" ? (
            <span
              className="jig-reminder-due-indicator jig-reminder-scheduled-indicator"
              aria-label="Reminder scheduled"
            >
              <Icon icon="clock" size="xsm" color="inherit" />
              Reminder scheduled
            </span>
          ) : reminderLifecycle === "due" ? (
            <span
              className="jig-reminder-due-indicator"
              aria-label="Reminder due; reminder time has passed"
            >
              <Icon icon="clock" size="xsm" color="inherit" />
              Reminder due · time passed
            </span>
          ) : reminderLifecycle === "notified" ? (
            <span
              className="jig-reminder-due-indicator jig-reminder-notified-indicator"
              aria-label="Reminder due; notification displayed"
            >
              <Icon icon="clock" size="xsm" color="inherit" />
              Reminder notified
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
