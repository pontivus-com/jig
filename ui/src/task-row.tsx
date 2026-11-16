import {
  Button,
  CheckboxInput,
  ListItem,
} from "@astryxdesign/core";
import { useSortable } from "@dnd-kit/react/sortable";
import type { Ref } from "react";
import type { Task } from "../../src/core/task";
import { formatReminderTime } from "./dates";

export interface TaskRowProps {
  readonly task: Task;
  readonly isSelected?: boolean | undefined;
  readonly rowRef?: Ref<HTMLLIElement> | undefined;
  readonly dragHandleRef?: Ref<HTMLButtonElement> | undefined;
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

function TaskDescription({
  task,
}: Readonly<{
  task: Task;
}>): React.ReactElement {
  return (
    <div className="jig-task-meta">
      {task.context === null ? null : <span>{task.context}</span>}
      {task.priority === "NORMAL" ? null : (
        <span className="jig-priority-label">{task.priority.toLowerCase()}</span>
      )}
      {task.reminder_time === null ? null : (
        <span>Reminder {formatReminderTime(task.reminder_time)}</span>
      )}
      {task.reference === null ? null : isSafeWebReference(task.reference) ? (
        <a
          href={task.reference}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(event) => event.stopPropagation()}
        >
          Open reference
        </a>
      ) : (
        <button
          type="button"
          className="jig-copy-reference"
          onClick={(event) => {
            event.stopPropagation();
            void navigator.clipboard.writeText(task.reference ?? "");
          }}
        >
          Copy reference
        </button>
      )}
    </div>
  );
}

export function TaskRow({
  task,
  isSelected = false,
  rowRef,
  dragHandleRef,
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
      isSelected={isSelected}
      align="first-line"
      startContent={
        <CheckboxInput
          label={completed ? `Reopen ${task.title}` : `Complete ${task.title}`}
          isLabelHidden
          value={completed}
          onChange={onToggleComplete}
          size="sm"
        />
      }
      label={
        <span className={completed ? "jig-task-title jig-task-title-completed" : "jig-task-title"}>
          {task.title}
        </span>
      }
      description={<TaskDescription task={task} />}
      endContent={
        <div className="jig-task-actions">
          {completed || dragHandleRef === undefined ? null : (
            <Button
              ref={dragHandleRef}
              label="Drag"
              variant="ghost"
              size="sm"
              aria-label={`Drag ${task.title}`}
            />
          )}
          {onMoveUp === undefined ? null : (
            <Button
              label="Up"
              variant="ghost"
              size="sm"
              onClick={onMoveUp}
              aria-label={`Move ${task.title} up`}
            />
          )}
          {onMoveDown === undefined ? null : (
            <Button
              label="Down"
              variant="ghost"
              size="sm"
              onClick={onMoveDown}
              aria-label={`Move ${task.title} down`}
            />
          )}
          {onMoveToDate === undefined ? null : (
            <Button
              label="Move…"
              variant="ghost"
              size="sm"
              onClick={onMoveToDate}
              aria-label={`Move ${task.title} to another date`}
            />
          )}
          <Button
            label="Edit"
            variant="ghost"
            size="sm"
            onClick={onEdit}
            aria-label={`Edit ${task.title}`}
          />
        </div>
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
      dragHandleRef={sortable.handleRef as Ref<HTMLButtonElement>}
    />
  );
}