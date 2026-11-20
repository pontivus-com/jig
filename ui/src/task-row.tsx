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

export interface ActiveTaskRowProps extends TaskRowBaseProps {
  readonly mode: "active";
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

export interface PassiveTaskRowProps extends TaskRowBaseProps {
  readonly mode: "passive";
}

export type TaskRowProps = ActiveTaskRowProps | PassiveTaskRowProps;

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

type TaskCompletionControlProps = Readonly<{
  task: Task;
  completed: boolean;
}> &
  (
    | Readonly<{
        mode: "active";
        onToggleComplete: () => void;
      }>
    | Readonly<{
        mode: "passive";
      }>
  );

function TaskCompletionControl(
  props: TaskCompletionControlProps,
): React.ReactElement {
  const inputRef = useRef<HTMLInputElement>(null);
  const onToggleComplete =
    props.mode === "active" ? props.onToggleComplete : undefined;

  return (
    <span
      className="jig-task-completion-target"
      data-jig-drag-excluded="true"
      {...(onToggleComplete === undefined
        ? {}
        : {
            onClick: (event: React.MouseEvent<HTMLSpanElement>) => {
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
            },
          })}
    >
      <CheckboxInput
        ref={inputRef}
        label={
          props.completed
            ? `Reopen ${props.task.title}`
            : `Complete ${props.task.title}`
        }
        isLabelHidden
        value={props.completed}
        isReadOnly={onToggleComplete === undefined}
        {...(onToggleComplete === undefined
          ? {}
          : { onChange: onToggleComplete })}
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
      <TaskMetadata task={task} isInteractive={false} />
    </div>
  );
}

interface TaskCardPresentationBaseProps {
  readonly task: Task;
  readonly recurrenceSeries: RecurrenceSeries | null;
  readonly now: Date;
  readonly showDragHandle: boolean;
}

interface ActiveTaskCardPresentationProps
  extends TaskCardPresentationBaseProps {
  readonly mode: "active";
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

interface PassiveTaskCardPresentationProps
  extends TaskCardPresentationBaseProps {
  readonly mode: "passive";
}

type TaskCardPresentationProps =
  | ActiveTaskCardPresentationProps
  | PassiveTaskCardPresentationProps;

function TaskCardPresentation(
  props: TaskCardPresentationProps,
): React.ReactElement {
  const completed = props.task.completed_at !== null;
  const reminderLifecycle = useReminderLifecycle(props.task, props.now);
  const reminderDue = reminderLifecycle === "due";
  const activeProps = props.mode === "active" ? props : null;

  return (
    <ListItem
      {...(activeProps?.rowRef === undefined ? {} : { ref: activeProps.rowRef })}
      itemKey={props.task.id}
      {...(activeProps?.onSelect === undefined
        ? {}
        : { onClick: activeProps.onSelect })}
      className={[
        "jig-task-card",
        `jig-task-priority-${props.task.priority.toLowerCase()}`,
        activeProps?.isSelected ? "jig-task-card-selected" : "",
        completed ? "jig-task-card-completed" : "",
        reminderDue ? "jig-task-card-reminder-due" : "",
        activeProps?.isDragging ? "jig-task-card-dragging" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      isSelected={activeProps?.isSelected ?? false}
      startContent={
        <span
          className="jig-task-card-leading"
          data-jig-drag-excluded="true"
        >
          {props.showDragHandle ? (
            <span
              {...(activeProps?.dragHandleRef === undefined
                ? {}
                : { ref: activeProps.dragHandleRef })}
              className="jig-task-drag-handle"
              role={activeProps === null ? undefined : "button"}
              tabIndex={activeProps === null ? undefined : 0}
              aria-label={
                activeProps === null ? undefined : `Move ${props.task.title}`
              }
              aria-hidden={activeProps === null ? true : undefined}
              {...(activeProps === null
                ? {}
                : {
                    onClick: (event: React.MouseEvent<HTMLSpanElement>) =>
                      event.stopPropagation(),
                  })}
            >
              <JigIcon name="drag" color="inherit" size="sm" />
            </span>
          ) : null}
          {activeProps === null ? (
            <TaskCompletionControl
              mode="passive"
              task={props.task}
              completed={completed}
            />
          ) : (
            <TaskCompletionControl
              mode="active"
              task={props.task}
              completed={completed}
              onToggleComplete={activeProps.onToggleComplete}
            />
          )}
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
            isInteractive={activeProps !== null}
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
          {...(activeProps === null
            ? {}
            : {
                onEdit: activeProps.onEdit,
                onToggleComplete: activeProps.onToggleComplete,
                onSetPriority: activeProps.onSetPriority,
                onDelete: activeProps.onDelete,
                ...(activeProps.onMoveUp === undefined
                  ? {}
                  : { onMoveUp: activeProps.onMoveUp }),
                ...(activeProps.onMoveDown === undefined
                  ? {}
                  : { onMoveDown: activeProps.onMoveDown }),
              })}
        />
      }
    />
  );
}

export function TaskRow(props: TaskRowProps): React.ReactElement {
  if (props.mode === "passive") {
    return (
      <TaskCardPresentation
        mode="passive"
        task={props.task}
        recurrenceSeries={props.recurrenceSeries ?? null}
        now={props.now}
        showDragHandle
      />
    );
  }

  return (
    <TaskCardPresentation
      mode="active"
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
