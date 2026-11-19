import {
  Banner,
  Button,
  CheckboxInput,
  DateInput,
  SegmentedControl,
  SegmentedControlItem,
  Selector,
  TextArea,
  TextInput,
  TimeInput,
} from "@astryxdesign/core";
import { FieldLabel } from "@astryxdesign/core/Field";
import { useId, useState } from "react";
import {
  WEEKDAYS,
  type RecurrenceSeries,
  type RecurrenceSpec,
  type Weekday,
} from "../../src/core/recurrence";
import {
  isPriority,
  type Priority,
  type Task,
  type TaskCommand,
} from "../../src/core/task";
import { asIsoDateString, asIsoTimeString } from "./dates";

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
] as const;

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
  if (draft.repeatEndDate < anchor) {
    return "Repeat end date cannot be before this occurrence.";
  }

  if (draft.repeatKind === "weekly") {
    const intervalWeeks = Number(draft.repeatIntervalWeeks);
    if (!Number.isInteger(intervalWeeks) || intervalWeeks <= 0) {
      return "Week interval must be a positive whole number.";
    }
    if (draft.repeatWeekdays.length === 0) {
      return "Select at least one weekday.";
    }
    return {
      pattern: {
        kind: "weekly",
        interval_weeks: intervalWeeks,
        weekdays: draft.repeatWeekdays,
      },
      end_date: draft.repeatEndDate,
    };
  }

  const dayOfMonth = Number(draft.repeatDayOfMonth);
  if (
    !Number.isInteger(dayOfMonth) ||
    dayOfMonth < 1 ||
    dayOfMonth > 31
  ) {
    return "Day of month must be a whole number from 1 to 31.";
  }

  return {
    pattern: {
      kind: "monthly",
      day_of_month: dayOfMonth,
    },
    end_date: draft.repeatEndDate,
  };
}

function recurrenceMatchesSeries(
  spec: RecurrenceSpec,
  series: RecurrenceSeries,
): boolean {
  if (
    spec.end_date !== series.end_date ||
    spec.pattern.kind !== series.pattern.kind
  ) {
    return false;
  }

  if (
    spec.pattern.kind === "monthly" &&
    series.pattern.kind === "monthly"
  ) {
    return spec.pattern.day_of_month === series.pattern.day_of_month;
  }

  if (
    spec.pattern.kind === "weekly" &&
    series.pattern.kind === "weekly"
  ) {
    return (
      spec.pattern.interval_weeks === series.pattern.interval_weeks &&
      spec.pattern.weekdays.length === series.pattern.weekdays.length &&
      spec.pattern.weekdays.every(
        (weekday, index) =>
          weekday === series.pattern.weekdays[index],
      )
    );
  }

  return false;
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
        : recurrenceMatchesSeries(recurrence, recurrenceSeries)
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
            if (value !== undefined) {
              updateScheduledDate(value);
            }
          }}
          isRequired
          weekStartsOn="mon"
        />

        <div className="jig-repeat-field">
          <Selector
            label="Repeat"
            value={draft.repeatKind}
            options={REPEAT_OPTIONS}
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
                    <div className="jig-repeat-weekday" key={weekday}>
                      <CheckboxInput
                        label={WEEKDAY_LABELS[weekday]}
                        value={draft.repeatWeekdays.includes(weekday)}
                        onChange={() => toggleWeekday(weekday)}
                      />
                    </div>
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
              />
            </div>
          ) : null}

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

        <TextInput
          label="Context"
          value={draft.context}
          onChange={(value) => update("context", value)}
          isOptional
          width="100%"
          placeholder="Project, client, or place"
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
