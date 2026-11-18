import {
  Button,
  CheckboxInput,
  DateInput,
  SegmentedControl,
  SegmentedControlItem,
  TextInput,
} from "@astryxdesign/core";
import { useEffect, useState } from "react";
import {
  WEEKDAYS,
  type RecurrenceSeries,
  type RecurrenceSpec,
  type Weekday,
} from "../../src/core/recurrence";
import type { Task } from "../../src/core/task";
import { asIsoDateString } from "./dates";

type RepeatKind = "weekly" | "monthly";

interface RepeatDraft {
  readonly kind: RepeatKind;
  readonly intervalWeeks: string;
  readonly weekdays: readonly Weekday[];
  readonly dayOfMonth: string;
  readonly endDate: string;
}

const WEEKDAY_LABELS: Readonly<Record<Weekday, string>> = {
  MON: "Mon",
  TUE: "Tue",
  WED: "Wed",
  THU: "Thu",
  FRI: "Fri",
  SAT: "Sat",
  SUN: "Sun",
};

function weekdayForCivilDate(value: string): Weekday {
  const date = new Date(`${value}T00:00:00.000Z`);
  const mondayBased = (date.getUTCDay() + 6) % 7;
  return WEEKDAYS[mondayBased] ?? "MON";
}

function draftFor(
  task: Task,
  series: RecurrenceSeries | null,
): RepeatDraft {
  if (series?.pattern.kind === "weekly") {
    return {
      kind: "weekly",
      intervalWeeks: String(series.pattern.interval_weeks),
      weekdays: series.pattern.weekdays,
      dayOfMonth: task.recurrence_occurrence_date?.slice(8, 10)
        .replace(/^0/, "") ?? String(Number(task.scheduled_date.slice(8, 10))),
      endDate: series.end_date,
    };
  }
  if (series?.pattern.kind === "monthly") {
    return {
      kind: "monthly",
      intervalWeeks: "1",
      weekdays: [
        weekdayForCivilDate(
          task.recurrence_occurrence_date ?? task.scheduled_date,
        ),
      ],
      dayOfMonth: String(series.pattern.day_of_month),
      endDate: series.end_date,
    };
  }

  const anchor =
    task.recurrence_occurrence_date ?? task.scheduled_date;
  return {
    kind: "weekly",
    intervalWeeks: "1",
    weekdays: [weekdayForCivilDate(anchor)],
    dayOfMonth: String(Number(anchor.slice(8, 10))),
    endDate: "",
  };
}

function recurrenceSpec(
  draft: RepeatDraft,
  anchor: string,
): RecurrenceSpec | string {
  if (draft.endDate.length === 0) {
    return "Repeat end date is required.";
  }
  if (draft.endDate < anchor) {
    return "Repeat end date cannot be before this occurrence.";
  }

  if (draft.kind === "weekly") {
    const intervalWeeks = Number(draft.intervalWeeks);
    if (
      !Number.isInteger(intervalWeeks) ||
      intervalWeeks <= 0
    ) {
      return "Week interval must be a positive whole number.";
    }
    if (draft.weekdays.length === 0) {
      return "Select at least one weekday.";
    }
    return {
      pattern: {
        kind: "weekly",
        interval_weeks: intervalWeeks,
        weekdays: draft.weekdays,
      },
      end_date: draft.endDate,
    };
  }

  const dayOfMonth = Number(draft.dayOfMonth);
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
    end_date: draft.endDate,
  };
}

export function recurrenceSummary(
  series: RecurrenceSeries,
): string {
  if (series.pattern.kind === "monthly") {
    return `Monthly on day ${series.pattern.day_of_month} until ${series.end_date}`;
  }
  const days = series.pattern.weekdays
    .map((weekday) => WEEKDAY_LABELS[weekday])
    .join(", ");
  const interval =
    series.pattern.interval_weeks === 1
      ? "Weekly"
      : `Every ${series.pattern.interval_weeks} weeks`;
  return `${interval} on ${days} until ${series.end_date}`;
}

export interface RecurrenceEditorProps {
  readonly task: Task;
  readonly series: RecurrenceSeries | null;
  readonly isSaving: boolean;
  readonly onSetRecurrence: (
    recurrence: RecurrenceSpec | null,
  ) => Promise<boolean>;
}

export function RecurrenceEditor({
  task,
  series,
  isSaving,
  onSetRecurrence,
}: RecurrenceEditorProps): React.ReactElement {
  const [draft, setDraft] = useState<RepeatDraft>(() =>
    draftFor(task, series),
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(draftFor(task, series));
    setError(null);
  }, [task.id, task.recurrence_occurrence_date, series]);

  const anchor =
    task.recurrence_occurrence_date ?? task.scheduled_date;

  const toggleWeekday = (weekday: Weekday): void => {
    setDraft((current) => ({
      ...current,
      weekdays: current.weekdays.includes(weekday)
        ? current.weekdays.filter((value) => value !== weekday)
        : WEEKDAYS.filter(
            (value) =>
              current.weekdays.includes(value) || value === weekday,
          ),
    }));
  };

  const save = async (): Promise<void> => {
    const spec = recurrenceSpec(draft, anchor);
    if (typeof spec === "string") {
      setError(spec);
      return;
    }
    setError(null);
    await onSetRecurrence(spec);
  };

  return (
    <section className="jig-repeat-editor" aria-label="Repeat">
      <div className="jig-repeat-heading">
        <strong>Repeat</strong>
        <span>
          {series === null
            ? "Not repeating"
            : recurrenceSummary(series)}
        </span>
      </div>

      <SegmentedControl
        label="Repeat pattern"
        value={draft.kind}
        onChange={(value) => {
          if (value === "weekly" || value === "monthly") {
            setDraft((current) => ({
              ...current,
              kind: value,
            }));
          }
        }}
        layout="fill"
      >
        <SegmentedControlItem value="weekly" label="Weekly" />
        <SegmentedControlItem value="monthly" label="Monthly" />
      </SegmentedControl>

      {draft.kind === "weekly" ? (
        <>
          <TextInput
            label="Every N weeks"
            value={draft.intervalWeeks}
            onChange={(value) =>
              setDraft((current) => ({
                ...current,
                intervalWeeks: value,
              }))
            }
            isRequired
            width="100%"
          />
          <div
            className="jig-repeat-weekdays"
            role="group"
            aria-label="Repeat weekdays"
          >
            {WEEKDAYS.map((weekday) => (
              <CheckboxInput
                key={weekday}
                label={WEEKDAY_LABELS[weekday]}
                value={draft.weekdays.includes(weekday)}
                onChange={() => toggleWeekday(weekday)}
                size="sm"
              />
            ))}
          </div>
        </>
      ) : (
        <TextInput
          label="Day of month"
          value={draft.dayOfMonth}
          onChange={(value) =>
            setDraft((current) => ({
              ...current,
              dayOfMonth: value,
            }))
          }
          isRequired
          width="100%"
        />
      )}

      <DateInput
        label="Repeat until"
        value={
          draft.endDate.length === 0
            ? undefined
            : asIsoDateString(draft.endDate)
        }
        onChange={(value) =>
          setDraft((current) => ({
            ...current,
            endDate: value ?? "",
          }))
        }
        isRequired
        weekStartsOn="mon"
      />

      {error === null ? null : (
        <div className="jig-form-error" role="alert">
          {error}
        </div>
      )}

      <div className="jig-repeat-actions">
        <Button
          type="button"
          label={series === null ? "Enable repeat" : "Save repeat"}
          variant="secondary"
          size="sm"
          isLoading={isSaving}
          onClick={() => {
            void save();
          }}
        />
        {series === null ? null : (
          <Button
            type="button"
            label="Stop repeating"
            variant="ghost"
            size="sm"
            isDisabled={isSaving}
            onClick={() => {
              setError(null);
              void onSetRecurrence(null);
            }}
          />
        )}
      </div>
    </section>
  );
}
