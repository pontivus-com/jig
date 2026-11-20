import {
  assertCivilDate,
  assertUtcInstant,
  assertUuid,
  TaskValidationError,
} from "./task";

export const WEEKDAYS = [
  "MON",
  "TUE",
  "WED",
  "THU",
  "FRI",
  "SAT",
  "SUN",
] as const;

export type Weekday = (typeof WEEKDAYS)[number];

export interface WeeklyRecurrencePattern {
  readonly kind: "weekly";
  readonly interval_weeks: number;
  readonly weekdays: readonly Weekday[];
}

export interface MonthlyRecurrencePattern {
  readonly kind: "monthly";
  readonly day_of_month: number;
}

export type RecurrencePattern =
  | WeeklyRecurrencePattern
  | MonthlyRecurrencePattern;

export interface RecurrenceSpec {
  readonly pattern: RecurrencePattern;
  readonly end_date: string;
}

export interface RecurrenceSeries {
  readonly id: string;
  readonly effective_from: string;
  readonly end_date: string;
  readonly pattern: RecurrencePattern;
  readonly created_at: string;
  readonly updated_at: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function civilDateToUtc(value: string): Date {
  assertCivilDate(value);
  const [yearText, monthText, dayText] = value.split("-");
  return new Date(Date.UTC(
    Number(yearText),
    Number(monthText) - 1,
    Number(dayText),
  ));
}

function formatCivilDate(value: Date): string {
  return [
    value.getUTCFullYear().toString().padStart(4, "0"),
    (value.getUTCMonth() + 1).toString().padStart(2, "0"),
    value.getUTCDate().toString().padStart(2, "0"),
  ].join("-");
}

function weekdayForDate(value: Date): Weekday {
  const sundayBased = value.getUTCDay();
  const mondayBased = (sundayBased + 6) % 7;
  const weekday = WEEKDAYS[mondayBased];
  if (weekday === undefined) {
    throw new TaskValidationError("Unable to resolve recurrence weekday");
  }
  return weekday;
}

function mondayOfWeek(value: Date): Date {
  const mondayOffset = (value.getUTCDay() + 6) % 7;
  return new Date(value.getTime() - mondayOffset * DAY_MS);
}

function assertIntegerInRange(
  value: number,
  minimum: number,
  maximum: number,
  field: string,
): void {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new TaskValidationError(
      `${field} must be an integer in ${minimum}..${maximum}`,
    );
  }
}

export function isWeekday(value: unknown): value is Weekday {
  return WEEKDAYS.some((weekday) => weekday === value);
}

export function validateRecurrencePattern(
  pattern: RecurrencePattern,
): RecurrencePattern {
  if (pattern.kind === "weekly") {
    if (
      !Number.isInteger(pattern.interval_weeks) ||
      pattern.interval_weeks <= 0
    ) {
      throw new TaskValidationError(
        "interval_weeks must be a positive whole number",
      );
    }
    if (pattern.weekdays.length === 0) {
      throw new TaskValidationError(
        "weekly recurrence requires at least one weekday",
      );
    }
    const weekdays = new Set<Weekday>();
    for (const weekday of pattern.weekdays) {
      if (!isWeekday(weekday)) {
        throw new TaskValidationError("weekly recurrence weekday is invalid");
      }
      if (weekdays.has(weekday)) {
        throw new TaskValidationError(
          "weekly recurrence weekdays must be unique",
        );
      }
      weekdays.add(weekday);
    }
    return {
      kind: "weekly",
      interval_weeks: pattern.interval_weeks,
      weekdays: WEEKDAYS.filter((weekday) => weekdays.has(weekday)),
    };
  }

  assertIntegerInRange(
    pattern.day_of_month,
    1,
    31,
    "day_of_month",
  );
  return {
    kind: "monthly",
    day_of_month: pattern.day_of_month,
  };
}

export function validateRecurrenceSpec(
  spec: RecurrenceSpec,
  effectiveFrom: string,
): RecurrenceSpec {
  assertCivilDate(effectiveFrom, "effective_from");
  assertCivilDate(spec.end_date, "end_date");
  if (spec.end_date < effectiveFrom) {
    throw new TaskValidationError(
      "recurrence end_date must not precede effective_from",
    );
  }
  return {
    pattern: validateRecurrencePattern(spec.pattern),
    end_date: spec.end_date,
  };
}

export function recurrenceSpecMatchesSeries(
  spec: RecurrenceSpec,
  series: RecurrenceSeries,
): boolean {
  const normalized = validateRecurrenceSpec(
    spec,
    series.effective_from,
  );
  const current = validateRecurrenceSeries(series);

  if (
    normalized.end_date !== current.end_date ||
    normalized.pattern.kind !== current.pattern.kind
  ) {
    return false;
  }

  if (
    normalized.pattern.kind === "monthly" &&
    current.pattern.kind === "monthly"
  ) {
    return (
      normalized.pattern.day_of_month ===
      current.pattern.day_of_month
    );
  }

  if (
    normalized.pattern.kind === "weekly" &&
    current.pattern.kind === "weekly"
  ) {
    return (
      normalized.pattern.interval_weeks ===
        current.pattern.interval_weeks &&
      normalized.pattern.weekdays.length ===
        current.pattern.weekdays.length &&
      normalized.pattern.weekdays.every(
        (weekday, index) =>
          weekday === current.pattern.weekdays[index],
      )
    );
  }

  return false;
}

export function validateRecurrenceSeries(
  series: RecurrenceSeries,
): RecurrenceSeries {
  assertUuid(series.id, "recurrence series id");
  assertCivilDate(series.effective_from, "effective_from");
  const spec = validateRecurrenceSpec(
    {
      pattern: series.pattern,
      end_date: series.end_date,
    },
    series.effective_from,
  );
  assertUtcInstant(series.created_at, "created_at");
  assertUtcInstant(series.updated_at, "updated_at");
  if (Date.parse(series.updated_at) < Date.parse(series.created_at)) {
    throw new TaskValidationError(
      "recurrence updated_at must not precede created_at",
    );
  }
  return {
    id: series.id,
    effective_from: series.effective_from,
    end_date: spec.end_date,
    pattern: spec.pattern,
    created_at: series.created_at,
    updated_at: series.updated_at,
  };
}

/**
 * Enumerates only matching recurrence slots strictly after the effective
 * occurrence. The invoking/seed occurrence is retained independently of
 * whether its civil date itself matches the selected rule.
 */
export function enumerateRecurrenceDates(
  effectiveFrom: string,
  spec: RecurrenceSpec,
): readonly string[] {
  const normalized = validateRecurrenceSpec(spec, effectiveFrom);
  const start = civilDateToUtc(effectiveFrom);
  const end = civilDateToUtc(normalized.end_date);
  const dates: string[] = [];

  if (normalized.pattern.kind === "weekly") {
    const weekZero = mondayOfWeek(start);
    const selected = new Set(normalized.pattern.weekdays);
    for (
      let cursor = new Date(start.getTime() + DAY_MS);
      cursor.getTime() <= end.getTime();
      cursor = new Date(cursor.getTime() + DAY_MS)
    ) {
      const weekIndex = Math.floor(
        (mondayOfWeek(cursor).getTime() - weekZero.getTime()) /
          (7 * DAY_MS),
      );
      if (
        weekIndex % normalized.pattern.interval_weeks === 0 &&
        selected.has(weekdayForDate(cursor))
      ) {
        dates.push(formatCivilDate(cursor));
      }
    }
    return dates;
  }

  let year = start.getUTCFullYear();
  let month = start.getUTCMonth();
  while (true) {
    const candidate = new Date(
      Date.UTC(year, month, normalized.pattern.day_of_month),
    );
    if (
      candidate.getUTCMonth() === month &&
      candidate.getUTCDate() === normalized.pattern.day_of_month &&
      candidate.getTime() > start.getTime() &&
      candidate.getTime() <= end.getTime()
    ) {
      dates.push(formatCivilDate(candidate));
    }

    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
    const monthStart = new Date(Date.UTC(year, month, 1));
    if (monthStart.getTime() > end.getTime()) {
      break;
    }
  }
  return dates;
}

export function createRecurrenceSeries(
  id: string,
  effectiveFrom: string,
  spec: RecurrenceSpec,
  now: string,
): RecurrenceSeries {
  return validateRecurrenceSeries({
    id,
    effective_from: effectiveFrom,
    end_date: spec.end_date,
    pattern: spec.pattern,
    created_at: now,
    updated_at: now,
  });
}
