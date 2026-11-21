import {
  Banner,
  Button,
  DateInput,
  SegmentedControl,
  SegmentedControlItem,
  Selector,
  TextArea,
  TextInput,
  TimeInput,
  ToggleButton,
} from "@astryxdesign/core";
import { FieldLabel } from "@astryxdesign/core/Field";
import { useId, useState } from "react";
import {
  recurrenceSpecMatchesSeries,
  validateRecurrenceSpec,
  WEEKDAYS,
  type RecurrenceSeries,
  type RecurrenceSpec,
  type Weekday,
} from "../../src/core/recurrence";
import {
  isPriority,
  TaskValidationError,
  type Priority,
  type Task,
  type TaskCommand,
} from "../../src/core/task";
import { assertActiveScheduleDate } from "../../src/core/planning";
import {
  asIsoDateString,
  asIsoTimeString,
  todayCivilDate,
} from "./dates";

export type RepeatKind = "none" | "weekly" | "monthly";

export interface TaskDraft {
  readonly title: string;
  readonly scheduledDate: string;
  readonly repeatKind: RepeatKind;
  readonly repeatIntervalWeeks: string;
  readonly repeatWeekdays: readonly Weekday[];
  readonly repeatDayOfMonth: string;
  readonly repeatEndDate: string;
  readonly reminderTime: string;
  readonly priority: Priority;
  readonly context: string;
  readonly reference: string;
  readonly note: string;
}

const REPEAT_OPTIONS = [
  { value: "none", label: "Does not repeat" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

const WEEKDAY_LABELS: Readonly<Record<Weekday, string>> = {
  MON: "Mon",
  TUE: "Tue",
  WED: "Wed",
  THU: "Thu",
  FRI: "Fri",
  SAT: "Sat",
  SUN: "Sun",
};

function isRepeatKind(value: unknown): value is RepeatKind {
  return value === "none" || value === "weekly" || value === "monthly";
}

function weekdayForCivilDate(value: string): Weekday {
  const date = new Date(`${value}T00:00:00.000Z`);
  const mondayBased = (date.getUTCDay() + 6) % 7;
  return WEEKDAYS[mondayBased] ?? "MON";
}

function dayOfMonthForCivilDate(value: string): string {
  return String(Number(value.slice(8, 10)));
}

export function recurrenceSummary(
  series: RecurrenceSeries,
): string {
  if (series.pattern.kind === "monthly") {
    return `Monthly · day ${series.pattern.day_of_month} · until ${series.end_date}`;
  }
  const days = series.pattern.weekdays
    .map((weekday) => WEEKDAY_LABELS[weekday])
    .join(", ");
  const interval =
    series.pattern.interval_weeks === 1
      ? "Weekly"
      : `Every ${series.pattern.interval_weeks} weeks`;
  return `${interval} · ${days} · until ${series.end_date}`;
}

export function draftFor(
  task: Task | null,
  initiatingDate: string,
  recurrenceSeries: RecurrenceSeries | null = null,
): TaskDraft {
  const scheduledDate = task?.scheduled_date ?? initiatingDate;
  const anchor =
    task?.recurrence_occurrence_date ?? scheduledDate;

  const repeat =
    recurrenceSeries?.pattern.kind === "weekly"
      ? {
          repeatKind: "weekly" as const,
          repeatIntervalWeeks: String(
            recurrenceSeries.pattern.interval_weeks,
          ),
          repeatWeekdays: recurrenceSeries.pattern.weekdays,
          repeatDayOfMonth: dayOfMonthForCivilDate(anchor),
          repeatEndDate: recurrenceSeries.end_date,
        }
      : recurrenceSeries?.pattern.kind === "monthly"
        ? {
            repeatKind: "monthly" as const,
            repeatIntervalWeeks: "1",
            repeatWeekdays: [weekdayForCivilDate(anchor)],
            repeatDayOfMonth: String(
              recurrenceSeries.pattern.day_of_month,
            ),
            repeatEndDate: recurrenceSeries.end_date,
          }
        : {
            repeatKind: "none" as const,
            repeatIntervalWeeks: "1",
            repeatWeekdays: [weekdayForCivilDate(anchor)],
            repeatDayOfMonth: dayOfMonthForCivilDate(anchor),
            repeatEndDate: "",
          };

  return task === null
    ? {
        title: "",
        scheduledDate,
        ...repeat,
        reminderTime: "",
        priority: "NORMAL",
        context: "",
        reference: "",
        note: "",
      }
    : {
        title: task.title,
        scheduledDate,
        ...repeat,
        reminderTime: task.reminder_time ?? "",
        priority: task.priority,
        context: task.context ?? "",
        reference: task.reference ?? "",
        note: task.note ?? "",
      };
}

function recurrenceValidationMessage(
  error: TaskValidationError,
): string {
  switch (error.message) {
    case "recurrence end_date must not precede effective_from":
      return "Repeat end date cannot be before this occurrence.";
    case "interval_weeks must be a positive whole number":
      return "Week interval must be a positive whole number.";
    case "weekly recurrence requires at least one weekday":
      return "Select at least one weekday.";
    case "day_of_month must be an integer in 1..31":
      return "Day of month must be a whole number from 1 to 31.";
    default:
      return "Repeat settings are invalid.";
  }
}

function recurrenceSpecForDraft(
  task: Task | null,
  draft: TaskDraft,
): RecurrenceSpec | null | string {
  if (draft.repeatKind === "none") {
    return null;
  }

  const anchor =
    task?.recurrence_occurrence_date ?? draft.scheduledDate;

  if (draft.repeatEndDate.length === 0) {
    return "Repeat end date is required.";
  }

  const candidate: RecurrenceSpec =
    draft.repeatKind === "weekly"
      ? {
          pattern: {
            kind: "weekly",
            interval_weeks: Number(draft.repeatIntervalWeeks),
            weekdays: draft.repeatWeekdays,
          },
          end_date: draft.repeatEndDate,
        }
      : {
          pattern: {
            kind: "monthly",
            day_of_month: Number(draft.repeatDayOfMonth),
          },
          end_date: draft.repeatEndDate,
        };

  try {
    return validateRecurrenceSpec(candidate, anchor);
  } catch (error) {
    if (error instanceof TaskValidationError) {
      return recurrenceValidationMessage(error);
    }
    throw error;
  }
}

export function commandForDraft(
  task: Task | null,
  draft: TaskDraft,
  recurrenceSeries: RecurrenceSeries | null,
): TaskCommand | string {
  const reminderTime =
    draft.reminderTime.length === 0 ? null : draft.reminderTime;
  const recurrence = recurrenceSpecForDraft(task, draft);

  if (typeof recurrence === "string") {
    return recurrence;
  }

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
      ...(recurrence === null ? {} : { recurrence }),
    };
  }

  const recurrenceChange =
    recurrenceSeries === null
      ? recurrence === null
        ? undefined
        : recurrence
      : recurrence === null
        ? null
        : recurrenceSpecMatchesSeries(recurrence, recurrenceSeries)
          ? undefined
          : recurrence;

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
    ...(recurrenceChange === undefined
      ? {}
      : { recurrence: recurrenceChange }),
  };
}

export interface TaskEditorProps {
  readonly formId?: string;
  readonly showActions?: boolean;
  readonly task: Task | null;
  readonly recurrenceSeries: RecurrenceSeries | null;
  readonly draft: TaskDraft;
  readonly externalError: string | null;
  readonly isSaving: boolean;
  readonly onDraftChange: (draft: TaskDraft) => void;
  readonly onCancel: () => void;
  readonly onSave: (command: TaskCommand) => Promise<boolean>;
}

export function TaskEditor({
  formId,
  showActions = true,
  task,
  recurrenceSeries,
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
  const weekdayGroupId = useId();
  const weekdayLabelId = useId();

  const update = <K extends keyof TaskDraft>(
    key: K,
    value: TaskDraft[K],
  ): void => {
    onDraftChange({ ...draft, [key]: value });
  };

  const updateScheduledDate = (value: string): void => {
    onDraftChange({
      ...draft,
      scheduledDate: value,
      ...(draft.repeatKind === "none"
        ? {
            repeatWeekdays: [weekdayForCivilDate(value)],
            repeatDayOfMonth: dayOfMonthForCivilDate(value),
          }
        : {}),
    });
  };

  const changeRepeatKind = (kind: RepeatKind): void => {
    const anchor =
      task?.recurrence_occurrence_date ?? draft.scheduledDate;
    onDraftChange({
      ...draft,
      repeatKind: kind,
      ...(draft.repeatKind === "none" && kind !== "none"
        ? {
            repeatWeekdays:
              draft.repeatWeekdays.length === 0
                ? [weekdayForCivilDate(anchor)]
                : draft.repeatWeekdays,
            repeatDayOfMonth:
              draft.repeatDayOfMonth.length === 0
                ? dayOfMonthForCivilDate(anchor)
                : draft.repeatDayOfMonth,
          }
        : {}),
    });
  };

  const toggleWeekday = (weekday: Weekday): void => {
    update(
      "repeatWeekdays",
      draft.repeatWeekdays.includes(weekday)
        ? draft.repeatWeekdays.filter((value) => value !== weekday)
        : WEEKDAYS.filter(
            (value) =>
              draft.repeatWeekdays.includes(value) ||
              value === weekday,
          ),
    );
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
    if (task === null || task.completed_at === null) {
      try {
        assertActiveScheduleDate(
          todayCivilDate(),
          draft.scheduledDate,
        );
      } catch (error) {
        setLocalError(
          error instanceof Error
            ? error.message
            : "Outstanding Tasks can only be scheduled for today or a future date",
        );
        return;
      }
    }

    const command = commandForDraft(task, draft, recurrenceSeries);
    if (typeof command === "string") {
      setLocalError(command);
      return;
    }

    setLocalError(null);
    await onSave(command);
  };

  const stoppingExistingSeries =
    recurrenceSeries !== null && draft.repeatKind === "none";
  const repeating = draft.repeatKind !== "none";
  const repeatSummary =
    draft.repeatEndDate.length === 0
      ? null
      : draft.repeatKind === "weekly"
        ? `Every ${draft.repeatIntervalWeeks} week${draft.repeatIntervalWeeks === "1" ? "" : "s"} · ${draft.repeatWeekdays
            .map((weekday) => WEEKDAY_LABELS[weekday])
            .join(", ")} · until ${draft.repeatEndDate}`
        : draft.repeatKind === "monthly"
          ? `Monthly · day ${draft.repeatDayOfMonth} · until ${draft.repeatEndDate}`
          : null;

  return (
    <section
      className="jig-task-editor-surface"
      aria-label={task === null ? "Add task" : `Task ${task.title}`}
    >
      <form
        id={formId}
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

        <div className="jig-editor-section">
          <div className="jig-editor-section-heading">
            <h3>Task</h3>
          </div>
          <TextInput
            label="Title"
            value={draft.title}
            onChange={(value) => update("title", value)}
            isRequired
            hasAutoFocus
            width="100%"
            controlClassName="jig-mobile-touch-control"
          />
        </div>

        <div className="jig-editor-section">
          <div className="jig-editor-section-heading">
            <h3>Schedule</h3>
          </div>
          <DateInput
            label="Date"
            value={asIsoDateString(draft.scheduledDate)}
            onChange={(value) => {
              if (value !== undefined) {
                updateScheduledDate(value);
              }
            }}
            isRequired
            weekStartsOn="mon"
            controlClassName="jig-mobile-touch-control"
          />

          <div className="jig-repeat-field">
            <Selector
              label="Repeat"
              value={draft.repeatKind}
              options={REPEAT_OPTIONS}
              presentation="adaptive"
              controlClassName="jig-mobile-touch-control"
              renderOption={(option) => (
                <span className="jig-mobile-selector-option">
                  {option.label}
                </span>
              )}
              onChange={(value) => {
                if (isRepeatKind(value)) {
                  changeRepeatKind(value);
                }
              }}
            />

            {draft.repeatKind === "weekly" ? (
              <div className="jig-repeat-disclosure">
                <TextInput
                  label="Every N weeks"
                  value={draft.repeatIntervalWeeks}
                  onChange={(value) => update("repeatIntervalWeeks", value)}
                  isRequired
                  width="100%"
                  controlClassName="jig-mobile-touch-control"
                />
                <div className="jig-editor-group-field">
                  <FieldLabel
                    label="Repeat on"
                    inputID={weekdayGroupId}
                    labelID={weekdayLabelId}
                    isGroupLabel
                  />
                  <div
                    id={weekdayGroupId}
                    className="jig-repeat-weekdays"
                    role="group"
                    aria-labelledby={weekdayLabelId}
                  >
                    {WEEKDAYS.map((weekday) => (
                      <ToggleButton
                        key={weekday}
                        className="jig-repeat-weekday"
                        label={WEEKDAY_LABELS[weekday]}
                        isPressed={draft.repeatWeekdays.includes(weekday)}
                        onPressedChange={() => toggleWeekday(weekday)}
                      />
                    ))}
                  </div>
                </div>
                <DateInput
                  label="Ends on"
                  value={
                    draft.repeatEndDate.length === 0
                      ? undefined
                      : asIsoDateString(draft.repeatEndDate)
                  }
                  onChange={(value) =>
                    update("repeatEndDate", value ?? "")
                  }
                  isRequired
                  weekStartsOn="mon"
                  controlClassName="jig-mobile-touch-control"
                />
              </div>
            ) : draft.repeatKind === "monthly" ? (
              <div className="jig-repeat-disclosure">
                <TextInput
                  label="Day of month"
                  value={draft.repeatDayOfMonth}
                  onChange={(value) => update("repeatDayOfMonth", value)}
                  isRequired
                  width="100%"
                  controlClassName="jig-mobile-touch-control"
                />
                <span className="jig-secondary-copy">
                  Months without this day are skipped.
                </span>
                <DateInput
                  label="Ends on"
                  value={
                    draft.repeatEndDate.length === 0
                      ? undefined
                      : asIsoDateString(draft.repeatEndDate)
                  }
                  onChange={(value) =>
                    update("repeatEndDate", value ?? "")
                  }
                  isRequired
                  weekStartsOn="mon"
                  controlClassName="jig-mobile-touch-control"
                />
              </div>
            ) : null}

            {repeatSummary === null ? null : (
              <p className="jig-repeat-summary">{repeatSummary}</p>
            )}

            {repeating && task !== null ? (
              <p className="jig-repeat-scope-copy">
                Repeat changes the series schedule. Other Task fields change
                this Task only.
              </p>
            ) : null}

            {stoppingExistingSeries ? (
              <Banner
                status="warning"
                title="Stop this series when you save?"
                description="This Task stays as a one-off. Completed History stays. Other outstanding Tasks in this series are removed."
                collapsible={false}
              />
            ) : null}
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
            controlClassName="jig-mobile-touch-control"
          />
        </div>

        <div className="jig-editor-section">
          <div className="jig-editor-section-heading">
            <h3>Details</h3>
          </div>
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
              <SegmentedControlItem
                value="HIGH"
                label="High"
                style={{ minHeight: "48px" }}
              />
              <SegmentedControlItem
                value="NORMAL"
                label="Normal"
                style={{ minHeight: "48px" }}
              />
              <SegmentedControlItem
                value="LOW"
                label="Low"
                style={{ minHeight: "48px" }}
              />
            </SegmentedControl>
          </div>

          <TextInput
            label="Context"
            value={draft.context}
            onChange={(value) => update("context", value)}
            isOptional
            width="100%"
            controlClassName="jig-mobile-touch-control"
            placeholder="Project, client, or place"
          />

          <TextInput
            label="Reference"
            value={draft.reference}
            onChange={(value) => update("reference", value)}
            isOptional
            width="100%"
            controlClassName="jig-mobile-touch-control"
            placeholder="https://… or a path/locator to copy"
          />
        </div>

        <div className="jig-editor-section">
          <div className="jig-editor-section-heading">
            <h3>Notes</h3>
          </div>
          <TextArea
            label="Notes"
            value={draft.note}
            onChange={(value) => update("note", value)}
            isOptional
            rows={4}
            controlClassName="jig-mobile-touch-control"
          />
        </div>

        {showActions ? (
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
        ) : null}
      </form>
    </section>
  );
}
