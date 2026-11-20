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

interface TaskRowBaseProps {
  readonly task: Task;
  readonly recurrenceSeries?: RecurrenceSeries | null;
  readonly now: Date;
}

export interface TaskRowProps extends TaskRowBaseProps {
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
  isInteractive = true,
}: Readonly<{
  task: Task;
  recurrenceSeries?: RecurrenceSeries | null;
  isInteractive?: boolean;
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
          className="jig-task-reference-action jig-task-meta-item"
          href={task.reference}
          target="_blank"
          type="inherit"
          hasUnderline
          {...(isInteractive
            ? {
                onPointerDown: stopPointer,
                onClick: (event: React.MouseEvent) => event.stopPropagation(),
              }
            : {})}
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
          {...(isInteractive
            ? {
                onPointerDown: stopPointer,
                onClick: (event: React.MouseEvent) => {
                  event.stopPropagation();
                  void navigator.clipboard.writeText(task.reference ?? "");
                },
              }
            : {})}
        >
          Reference
        </Button>
      )}
    </div>
  );
}

interface TaskCompletionControlProps {
  readonly task: Task;
  readonly completed: boolean;
  readonly onToggleComplete: () => void;
}

function TaskCompletionControl({
  task,
  completed,
  onToggleComplete,
}: TaskCompletionControlProps): React.ReactElement {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <span
      className="jig-task-completion-target"
      data-jig-drag-excluded="true"
      onClick={(event: React.MouseEvent<HTMLSpanElement>) => {
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
        label={
          completed
            ? `Reopen ${task.title}`
            : `Complete ${task.title}`
        }
        isLabelHidden
        value={completed}
        onChange={onToggleComplete}
      />
    </span>
  );
}

function priorityMenuItems(
  task: Task,
  onSetPriority?: ((priority: Priority) => void) | undefined,
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
    ...(onSetPriority === undefined
      ? {}
      : { onClick: () => onSetPriority(priority) }),
  }));
}

export interface TaskActionMenuProps {
  readonly task: Task;
  readonly onEdit?: (() => void) | undefined;
  readonly onToggleComplete?: (() => void) | undefined;
  readonly onSetPriority?: ((priority: Priority) => void) | undefined;
  readonly onDelete?: (() => void) | undefined;
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
      ...(onEdit === undefined ? {} : { onClick: onEdit }),
    },
    {
      id: task.completed_at === null ? "complete" : "reopen",
      label: task.completed_at === null ? "Complete" : "Reopen",
      icon: <Icon icon="check" size="sm" color="inherit" />,
      ...(onToggleComplete === undefined
        ? {}
        : { onClick: onToggleComplete }),
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
      ...(onDelete === undefined ? {} : { onClick: onDelete }),
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

export function TaskDragOverlayCard({
  task,
}: Readonly<{ task: Task }>): React.ReactElement {
  return (
    <div
      className={`jig-task-card jig-task-priority-${task.priority.toLowerCase()} jig-drag-card-overlay`}
      aria-hidden="true"
    >
      <div className="jig-task-drag-overlay-row">
        <span className="jig-task-drag-overlay-checkbox">□</span>
        <span className="jig-task-title">{task.title}</span>
        <Icon icon="moreHorizontal" color="secondary" />
      </div>
      <TaskMetadata task={task} isInteractive={false} />
    </div>
  );
}

interface TaskCardPresentationProps {
  readonly task: Task;
  readonly recurrenceSeries: RecurrenceSeries | null;
  readonly now: Date;
  readonly showDragHandle: boolean;
  readonly isSelected: boolean;
  readonly rowRef?: Ref<HTMLLIElement> | undefined;
  readonly dragHandleRef?: Ref<HTMLSpanElement> | undefined;
  readonly isDragging: boolean;
  readonly onSelect?: (() => void) | undefined;
  readonly onToggleComplete: () => void;
  readonly onEdit: () => void;
  readonly onSetPriority: (priority: Priority) => void;
  readonly onDelete: () => void;
  readonly onMoveUp?: (() => void) | undefined;
  readonly onMoveDown?: (() => void) | undefined;
}

function TaskCardPresentation(
  props: TaskCardPresentationProps,
): React.ReactElement {
  const completed = props.task.completed_at !== null;
  const reminderLifecycle = useReminderLifecycle(props.task, props.now);
  const reminderDue = reminderLifecycle === "due";

  return (
    <ListItem
      {...(props.rowRef === undefined ? {} : { ref: props.rowRef })}
      itemKey={props.task.id}
      {...(props.onSelect === undefined ? {} : { onClick: props.onSelect })}
      className={[
        "jig-task-card",
        `jig-task-priority-${props.task.priority.toLowerCase()}`,
        props.isSelected ? "jig-task-card-selected" : "",
        completed ? "jig-task-card-completed" : "",
        reminderDue ? "jig-task-card-reminder-due" : "",
        props.isDragging ? "jig-task-card-dragging" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      isSelected={props.isSelected}
      startContent={
        <span
          className="jig-task-card-leading"
          data-jig-drag-excluded="true"
        >
          {props.showDragHandle ? (
            <span
              {...(props.dragHandleRef === undefined
                ? {}
                : { ref: props.dragHandleRef })}
              className="jig-task-drag-handle"
              role="button"
              tabIndex={0}
              aria-label={`Move ${props.task.title}`}
              onClick={(event: React.MouseEvent<HTMLSpanElement>) =>
                event.stopPropagation()}
            >
              <JigIcon name="drag" color="inherit" size="sm" />
            </span>
          ) : null}
          <TaskCompletionControl
            task={props.task}
            completed={completed}
            onToggleComplete={props.onToggleComplete}
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
              {props.task.title}
            </span>
          </div>
          <TaskMetadata
            task={props.task}
            recurrenceSeries={props.recurrenceSeries}
          />
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
          task={props.task}
          onEdit={props.onEdit}
          onToggleComplete={props.onToggleComplete}
          onSetPriority={props.onSetPriority}
          onDelete={props.onDelete}
          {...(props.onMoveUp === undefined ? {} : { onMoveUp: props.onMoveUp })}
          {...(props.onMoveDown === undefined
            ? {}
            : { onMoveDown: props.onMoveDown })}
        />
      }
    />
  );
}

export function TaskRow(props: TaskRowProps): React.ReactElement {
  return (
    <TaskCardPresentation
      task={props.task}
      recurrenceSeries={props.recurrenceSeries ?? null}
      now={props.now}
      isSelected={props.isSelected ?? false}
      {...(props.rowRef === undefined ? {} : { rowRef: props.rowRef })}
      {...(props.dragHandleRef === undefined
        ? {}
        : { dragHandleRef: props.dragHandleRef })}
      isDragging={props.isDragging ?? false}
      showDragHandle={props.dragHandleRef !== undefined}
      {...(props.onSelect === undefined ? {} : { onSelect: props.onSelect })}
      onToggleComplete={props.onToggleComplete}
      onEdit={props.onEdit}
      onSetPriority={props.onSetPriority}
      onDelete={props.onDelete}
      {...(props.onMoveUp === undefined ? {} : { onMoveUp: props.onMoveUp })}
      {...(props.onMoveDown === undefined
        ? {}
        : { onMoveDown: props.onMoveDown })}
    />
  );
}
