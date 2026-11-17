import type { ISODateString } from "@astryxdesign/core/utils";
import type { ISOTimeString } from "@astryxdesign/core/TimeInput";
import { addCivilDays } from "../../src/core/planning";
import { assertCivilDate, assertLocalTime } from "../../src/core/task";

export function todayCivilDate(now = new Date()): string {
  return [
    now.getFullYear().toString().padStart(4, "0"),
    (now.getMonth() + 1).toString().padStart(2, "0"),
    now.getDate().toString().padStart(2, "0"),
  ].join("-");
}

export function millisecondsUntilNextLocalDay(
  now = new Date(),
): number {
  const next = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
  );
  return Math.max(1, next.getTime() - now.getTime());
}

export function civilDateAsLocalDate(civilDate: string): Date {
  assertCivilDate(civilDate);
  const [year, month, day] = civilDate.split("-").map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
}

export function asIsoDateString(value: string): ISODateString {
  assertCivilDate(value);
  return value as ISODateString;
}

export function asIsoTimeString(value: string): ISOTimeString {
  assertLocalTime(value);
  return value as ISOTimeString;
}

export function formatPlannerDateHeader(civilDate: string): string {
  const date = civilDateAsLocalDate(civilDate);
  const weekday = new Intl.DateTimeFormat("en", {
    weekday: "long",
  }).format(date);
  const day = new Intl.DateTimeFormat("en", {
    day: "numeric",
  }).format(date);
  return `${weekday} ${day}`;
}

export function formatCivilDate(
  civilDate: string,
  options: Intl.DateTimeFormatOptions = {
    weekday: "short",
    month: "short",
    day: "numeric",
  },
): string {
  return new Intl.DateTimeFormat(undefined, options).format(
    civilDateAsLocalDate(civilDate),
  );
}

export function formatReminderTime(value: string): string {
  const [hourText, minuteText] = value.split(":");
  const date = new Date(2000, 0, 1, Number(hourText), Number(minuteText));
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}


export function formatPlannerWeekRange(displayedWeekStart: string): string {
  assertCivilDate(displayedWeekStart);
  const end = addCivilDays(displayedWeekStart, 6);

  const startMonth = formatCivilDate(displayedWeekStart, { month: "short" });
  const endMonth = formatCivilDate(end, { month: "short" });
  const startYear = formatCivilDate(displayedWeekStart, { year: "numeric" });
  const endYear = formatCivilDate(end, { year: "numeric" });
  const startDay = formatCivilDate(displayedWeekStart, { day: "numeric" });
  const endDay = formatCivilDate(end, { day: "numeric" });

  if (startYear !== endYear) {
    return `${startDay} ${startMonth} ${startYear}–${endDay} ${endMonth} ${endYear}`;
  }

  if (startMonth !== endMonth) {
    return `${startDay} ${startMonth}–${endDay} ${endMonth} ${endYear}`;
  }

  return `${startDay}–${endDay} ${endMonth} ${endYear}`;
}
