import {
  Button,
  DateInput,
  SegmentedControl,
  SegmentedControlItem,
  TextArea,
  TextInput,
  TimeInput,
} from "@astryxdesign/core";
import type { ISODateString } from "@astryxdesign/core/utils";
import type { ISOTimeString } from "@astryxdesign/core/TimeInput";
import { FieldLabel } from "@astryxdesign/core/Field";
import { useEffect, useId, useState } from "react";
import type {
  Priority,
  Task,
  TaskCommand,
} from "../../src/core/task";
import { formatCivilDate } from "./dates";

interface TaskDraft {
  readonly title: string;
  readonly scheduledDate: string;
  readonly priority: Priority;
  readonly context: string;
  readonly reference: string;
  readonly note: string;
  readonly reminderTime: string;
}

function draftFor(
  task: Task | null,
  initiatingDate: string,
): TaskDraft {
  return task === null
    ? {
        title: "",
        scheduledDate: initiatingDate,
        priority: "NORMAL",
        context: "",
        reference: "",
        note: "",
        reminderTime: "",
      }
    : {
        title: task.title,
        scheduledDate: task.scheduled_date,
        priority: task.priority,
        context: task.context ?? "",
        reference: task.reference ?? "",
        note: task.note ?? "",
        reminderTime: task.reminder_time ?? "",
      };
}

function optionalText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function commandForDraft(
  task: Task | null,
  draft: TaskDraft,
): TaskCommand {
  if (task === null) {
    return {
      type: "create",
      title: draft.title.trim(),
      scheduled_date: draft.scheduledDate,
      priority: draft.priority,
      context: optionalText(draft.context),
      reference: optionalText(draft.reference),
      note: optionalText(draft.note),
      reminder_time:
        draft.reminderTime.length === 0 ? null : draft.reminderTime,
    };
  }

  return {
    type: "edit",
    task_id: task.id,
    changes: {
      title: draft.title.trim(),
      scheduled_date: draft.scheduledDate,
      priority: draft.priority,
      context: optionalText(draft.context),
      reference: optionalText(draft.reference),
      note: optionalText(draft.note),
      reminder_time:
        draft.reminderTime.length === 0 ? null : draft.reminderTime,
    },
  };
}

export interface TaskEditorProps {
  readonly task: Task | null;
  readonly initiatingDate: string;
  readonly externalError: string | null;
  readonly isSaving: boolean;
  readonly showHeading?: boolean;
  readonly surface?: "docked" | "drawer";
  readonly onCancel: () => void;
  readonly onSave: (command: TaskCommand) => Promise<boolean>;
}

export function TaskEditor({
  task,
  initiatingDate,
  externalError,
  isSaving,
  showHeading = true,
  surface = "docked",
  onCancel,
  onSave,
}: TaskEditorProps): React.ReactElement {
  const [draft, setDraft] = useState<TaskDraft>(() =>
    draftFor(task, initiatingDate),
  );
  const [localError, setLocalError] = useState<string | null>(null);
  const priorityGroupId = useId();
  const priorityLabelId = useId();

  useEffect(() => {
    setDraft(draftFor(task, initiatingDate));
    setLocalError(null);
  }, [task?.id, initiatingDate]);

  const update = <K extends keyof TaskDraft>(
    key: K,
    value: TaskDraft[K],
  ): void => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const submit = async (): Promise<void> => {
    if (draft.title.trim().length === 0) {
      setLocalError("Title is required.");
      return;
    }
    if (draft.scheduledDate.length === 0) {
      setLocalError("Date is required.");
      return;
    }

    setLocalError(null);
    await onSave(commandForDraft(task, draft));
  };

  return (
    <section
      className={[
        "jig-task-inspector",
        "jig-task-editor-surface",
        surface === "drawer" ? "jig-task-inspector-drawer" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={task === null ? "Add task" : `Edit task ${task.title}`}
    >
      {showHeading ? (
        <div className="jig-task-inspector-heading">
          <p className="jig-eyebrow">
            {task === null ? "New task" : "Editing task"}
          </p>
          <h2>{task === null ? "Add task" : task.title}</h2>
          <p className="jig-secondary-copy">
            {formatCivilDate(task?.scheduled_date ?? initiatingDate, {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>
      ) : null}

      <form
        className="jig-editor-form"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        {(localError ?? externalError) === null ? null : (
          <div className="jig-form-error" role="alert">
            {localError ?? externalError}
          </div>
        )}

        <TextInput
          label="Title"
          value={draft.title}
          onChange={(value) => update("title", value)}
          isRequired
          hasAutoFocus
          width="100%"
        />

        <DateInput
          label="Date"
          value={draft.scheduledDate as ISODateString}
          onChange={(value) =>
            update("scheduledDate", value ?? draft.scheduledDate)
          }
          isRequired
          weekStartsOn="mon"
        />

        <TextInput
          label="Context"
          value={draft.context}
          onChange={(value) => update("context", value)}
          isOptional
          width="100%"
          placeholder="Project, client, or place"
        />

        <div className="jig-editor-group-field">
          <FieldLabel
            label="Priority"
            inputID={priorityGroupId}
            labelID={priorityLabelId}
            isGroupLabel
          />
          <SegmentedControl
            id={priorityGroupId}
            aria-labelledby={priorityLabelId}
            label="Priority"
            value={draft.priority}
            onChange={(value) => update("priority", value as Priority)}
            layout="fill"
          >
            <SegmentedControlItem value="HIGH" label="High" />
            <SegmentedControlItem value="NORMAL" label="Normal" />
            <SegmentedControlItem value="LOW" label="Low" />
          </SegmentedControl>
        </div>

        <TimeInput
          label="Reminder"
          value={
            draft.reminderTime.length === 0
              ? undefined
              : (draft.reminderTime as ISOTimeString)
          }
          onChange={(value) => update("reminderTime", value ?? "")}
          isOptional
          hasClear
        />

        <TextInput
          label="Reference"
          value={draft.reference}
          onChange={(value) => update("reference", value)}
          isOptional
          width="100%"
          placeholder="https://… or a path/locator to copy"
        />

        <TextArea
          label="Notes"
          value={draft.note}
          onChange={(value) => update("note", value)}
          isOptional
          rows={4}
        />

        {task === null ? null : (
          <div className="jig-editor-date-behavior">
            <strong>Date change behavior</strong>
            <span>
              Changing date uses priority-guided insertion. Dragging uses the
              exact drop position.
            </span>
          </div>
        )}

        <div className="jig-editor-actions">
          <div className="jig-editor-primary-actions">
            <Button
              type="button"
              label="Cancel"
              variant="secondary"
              onClick={onCancel}
              isDisabled={isSaving}
            />
            <Button
              type="submit"
              label={task === null ? "Add task" : "Save"}
              variant="primary"
              isLoading={isSaving}
            />
          </div>
        </div>
      </form>
    </section>
  );
}
