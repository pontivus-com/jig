import {
  Button,
  CheckboxInput,
  DropdownMenu,
  Icon,
  Link,
  ListItem,
} from "@astryxdesign/core";
import type { DropdownMenuItemData } from "@astryxdesign/core/DropdownMenu";
import {
  PointerActivationConstraints,
  PointerSensor,
} from "@dnd-kit/dom";
import { useSortable } from "@dnd-kit/react/sortable";
import type { Ref } from "react";
import type { Priority, Task } from "../../src/core/task";
import { formatReminderTime } from "./dates";
import { JigIcon } from "./jig-icons";

export interface TaskRowProps {
  readonly task: Task;
  readonly isSelected?: boolean | undefined;
  readonly rowRef?: Ref<HTMLLIElement> | undefined;
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
}: Readonly<{ task: Task }>): React.ReactElement {
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
          label="Copy reference"
          variant="ghost"
          size="sm"
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
          size: "sm",
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
  isSelected = false,
  rowRef,
  onSelect,
  onToggleComplete,
  onEdit,
  onSetPriority,
  onDelete,
  onMoveUp,
  onMoveDown,
}: TaskRowProps): React.ReactElement {
  const completed = task.completed_at !== null;

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
      ]
        .filter(Boolean)
        .join(" ")}
      isSelected={isSelected}
      align="first-line"
      startContent={
        <span className="jig-task-card-leading">
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
          <TaskMetadata task={task} />
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

export interface SortableTaskRowProps
  extends Omit<TaskRowProps, "rowRef"> {
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
    sensors: [
      PointerSensor.configure({
        activationConstraints(event) {
          return event.pointerType === "touch"
            ? [
                new PointerActivationConstraints.Delay({
                  value: 250,
                  tolerance: 5,
                }),
              ]
            : [new PointerActivationConstraints.Distance({ value: 5 })];
        },
      }),
    ],
  });

  // The Astryx ListItem <li> is both dnd-kit's sortable element and pointer
  // source. PointerSensor excludes genuine interactive descendants, while
  // activation constraints keep ordinary press/release as Task selection.
  const rowRef = sortable.ref as Ref<HTMLLIElement>;

  return <TaskRow {...rowProps} task={task} rowRef={rowRef} />;
}
