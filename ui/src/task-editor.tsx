import {
  AlertDialog,
  Button,
  DateInput,
  Dialog,
  DialogHeader,
  SegmentedControl,
  SegmentedControlItem,
  TextArea,
  TextInput,
  TimeInput,
} from "@astryxdesign/core";
import type { ISODateString } from "@astryxdesign/core/utils";
import type { ISOTimeString } from "@astryxdesign/core/TimeInput";
import { useEffect, useState } from "react";
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
      title: draft.title,
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
      title: draft.title,
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
  readonly isOpen: boolean;
  readonly isNarrow: boolean;
  readonly task: Task | null;
  readonly initiatingDate: string;
  readonly externalError: string | null;
  readonly isSaving: boolean;
  readonly onOpenChange: (isOpen: boolean) => void;
  readonly onSave: (command: TaskCommand) => Promise<boolean>;
  readonly onDelete: (taskId: string) => Promise<boolean>;
}

export function TaskEditor({
  isOpen,
  isNarrow,
  task,
  initiatingDate,
  externalError,
  isSaving,
  onOpenChange,
  onSave,
  onDelete,
}: TaskEditorProps): React.ReactElement {
  const [draft, setDraft] = useState<TaskDraft>(() =>
    draftFor(task, initiatingDate),
  );
  const [localError, setLocalError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setDraft(draftFor(task, initiatingDate));
      setLocalError(null);
      setDeleteOpen(false);
    }
  }, [isOpen, task?.id, initiatingDate]);

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
    const saved = await onSave(commandForDraft(task, draft));
    if (saved) {
      onOpenChange(false);
    }
  };

  return (
    <>
      <Dialog
        isOpen={isOpen}
        onOpenChange={isSaving ? () => undefined : onOpenChange}
        purpose="form"
        variant={isNarrow ? "fullscreen" : "standard"}
        width="38rem"
        maxHeight="90dvh"
        padding={isNarrow ? 0 : 4}
      >
        <div
          className={
            isNarrow
              ? "jig-editor jig-editor-mobile-frame"
              : "jig-editor"
          }
        >
          <DialogHeader
            title={task === null ? "Add task" : "Edit task"}
            subtitle={formatCivilDate(
              task?.scheduled_date ?? initiatingDate,
              {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              },
            )}
            {...(isSaving ? {} : { onOpenChange })}
          />

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

            <SegmentedControl
              label="Priority"
              value={draft.priority}
              onChange={(value) => update("priority", value as Priority)}
              layout="fill"
            >
              <SegmentedControlItem value="HIGH" label="High" />
              <SegmentedControlItem value="NORMAL" label="Normal" />
              <SegmentedControlItem value="LOW" label="Low" />
            </SegmentedControl>

            <TimeInput
              label="Reminder"
              value={
                draft.reminderTime.length === 0
                  ? undefined
                  : (draft.reminderTime as ISOTimeString)
              }
              onChange={(value) =>
                update("reminderTime", value ?? "")
              }
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
              <>
                <div className="jig-editor-date-behavior">
                  <strong>Date change behavior</strong>
                  <span>
                    Changing date uses priority-guided insertion. Dragging uses
                    the exact drop position.
                  </span>
                </div>
                <div className="jig-editor-destructive-row">
                  <Button
                    type="button"
                    label="Delete task…"
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteOpen(true)}
                    isDisabled={isSaving}
                  />
                </div>
              </>
            )}

            <div className="jig-editor-actions">
              <div className="jig-editor-primary-actions">
                <Button
                  type="button"
                  label="Cancel"
                  variant="secondary"
                  size={isNarrow ? "lg" : "md"}
                  width={isNarrow ? "100%" : undefined}
                  onClick={() => onOpenChange(false)}
                  isDisabled={isSaving}
                />
                <Button
                  type="submit"
                  label={task === null ? "Add task" : "Save"}
                  variant="primary"
                  size={isNarrow ? "lg" : "md"}
                  width={isNarrow ? "100%" : undefined}
                  isLoading={isSaving}
                />
              </div>
            </div>
          </form>
        </div>
      </Dialog>

      {task === null ? null : (
        <AlertDialog
          isOpen={deleteOpen}
          onOpenChange={isSaving ? () => undefined : setDeleteOpen}
          title="Delete task?"
          description="This permanently removes the task from current Jig data. Git history may still contain an earlier exported snapshot."
          actionLabel="Delete task"
          cancelLabel="Cancel"
          actionVariant="destructive"
          isActionLoading={isSaving}
          onAction={async () => {
            const deleted = await onDelete(task.id);
            if (deleted) {
              setDeleteOpen(false);
              onOpenChange(false);
            }
          }}
        />
      )}
    </>
  );
}

export interface MoveTaskDialogProps {
  readonly task: Task | null;
  readonly isOpen: boolean;
  readonly initialDate: string;
  readonly isSaving: boolean;
  readonly error: string | null;
  readonly onOpenChange: (isOpen: boolean) => void;
  readonly onMove: (destinationDate: string) => Promise<boolean>;
}

export function MoveTaskDialog({
  task,
  isOpen,
  initialDate,
  isSaving,
  error,
  onOpenChange,
  onMove,
}: MoveTaskDialogProps): React.ReactElement {
  const [destinationDate, setDestinationDate] = useState(initialDate);

  useEffect(() => {
    if (isOpen) {
      setDestinationDate(initialDate);
    }
  }, [isOpen, initialDate, task?.id]);

  if (task === null) {
    return <></>;
  }

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={isSaving ? () => undefined : onOpenChange}
      purpose="form"
      width={420}
      padding={4}
    >
      <div className="jig-move-dialog">
        <DialogHeader
          title="Move task to date"
          subtitle={task.title}
          {...(isSaving ? {} : { onOpenChange })}
        />
        {error === null ? null : (
          <div className="jig-form-error" role="alert">
            {error}
          </div>
        )}
        <DateInput
          label="Destination date"
          value={destinationDate as ISODateString}
          onChange={(value) => {
            if (value !== undefined) {
              setDestinationDate(value);
            }
          }}
          isRequired
          weekStartsOn="mon"
        />
        <p className="jig-secondary-copy">
          The task will be appended to the selected date using the same exact-position move operation as drag and drop.
        </p>
        <div className="jig-editor-primary-actions">
          <Button
            label="Cancel"
            variant="secondary"
            onClick={() => onOpenChange(false)}
            isDisabled={isSaving}
          />
          <Button
            label="Move task"
            variant="primary"
            isLoading={isSaving}
            onClick={() => {
              void onMove(destinationDate).then((moved) => {
                if (moved) {
                  onOpenChange(false);
                }
              });
            }}
          />
        </div>
      </div>
    </Dialog>
  );
}
