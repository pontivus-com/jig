import {
  Button,
  DateInput,
  SegmentedControl,
  SegmentedControlItem,
  TextArea,
  TextInput,
  TimeInput,
} from "@astryxdesign/core";
import { FieldLabel } from "@astryxdesign/core/Field";
import { useId, useState } from "react";
import {
  isPriority,
  type Priority,
  type Task,
  type TaskCommand,
} from "../../src/core/task";
import { asIsoDateString, asIsoTimeString } from "./dates";

export interface TaskDraft {
  readonly title: string;
  readonly scheduledDate: string;
  readonly priority: Priority;
  readonly context: string;
  readonly reference: string;
  readonly note: string;
  readonly reminderTime: string;
}

export function draftFor(
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

export function commandForDraft(
  task: Task | null,
  draft: TaskDraft,
): TaskCommand {
  const reminderTime =
    draft.reminderTime.length === 0 ? null : draft.reminderTime;

  if (task === null) {
    return {
      type: "create",
      title: draft.title,
      scheduled_date: draft.scheduledDate,
      priority: draft.priority,
      context: draft.context,
      reference: draft.reference,
      note: draft.note,
      reminder_time: reminderTime,
    };
  }

  return {
    type: "edit",
    task_id: task.id,
    changes: {
      title: draft.title,
      scheduled_date: draft.scheduledDate,
      priority: draft.priority,
      context: draft.context,
      reference: draft.reference,
      note: draft.note,
      reminder_time: reminderTime,
    },
  };
}

export interface TaskEditorProps {
  readonly task: Task | null;
  readonly draft: TaskDraft;
  readonly externalError: string | null;
  readonly isSaving: boolean;
  readonly onDraftChange: (draft: TaskDraft) => void;
  readonly onCancel: () => void;
  readonly onSave: (command: TaskCommand) => Promise<boolean>;
}

export function TaskEditor({
  task,
  draft,
  externalError,
  isSaving,
  onDraftChange,
  onCancel,
  onSave,
}: TaskEditorProps): React.ReactElement {
  const [localError, setLocalError] = useState<string | null>(null);
  const priorityGroupId = useId();
  const priorityLabelId = useId();

  const update = <K extends keyof TaskDraft>(
    key: K,
    value: TaskDraft[K],
  ): void => {
    onDraftChange({ ...draft, [key]: value });
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
      className="jig-task-editor-surface"
      aria-label={task === null ? "Add task" : `Task ${task.title}`}
    >
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
          value={asIsoDateString(draft.scheduledDate)}
          onChange={(value) => {
            if (value !== null) {
              update("scheduledDate", value);
            }
          }}
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
            onChange={(value) => {
              if (isPriority(value)) {
                update("priority", value);
              }
            }}
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
              : asIsoTimeString(draft.reminderTime)
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
