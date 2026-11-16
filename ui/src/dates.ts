import { assertCivilDate } from "../../src/core/task";

export function todayCivilDate(now = new Date()): string {
  return [
    now.getFullYear().toString().padStart(4, "0"),
    (now.getMonth() + 1).toString().padStart(2, "0"),
    now.getDate().toString().padStart(2, "0"),
  ].join("-");
}

export function civilDateAsLocalDate(civilDate: string): Date {
  assertCivilDate(civilDate);
  const [year, month, day] = civilDate.split("-").map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
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

export function millisecondsUntilNextCivilDay(
  now = new Date(),
): number {
  const next = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0,
    0,
    0,
    50,
  );
  return Math.max(1, next.getTime() - now.getTime());
}
