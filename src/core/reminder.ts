import type { Task } from "./task";

function localCivilDate(now: Date): string {
  return [
    now.getFullYear().toString().padStart(4, "0"),
    (now.getMonth() + 1).toString().padStart(2, "0"),
    now.getDate().toString().padStart(2, "0"),
  ].join("-");
}

function localTime(now: Date): string {
  return [
    now.getHours().toString().padStart(2, "0"),
    now.getMinutes().toString().padStart(2, "0"),
  ].join(":");
}

export function reminderFingerprint(task: Task): string | null {
  return task.reminder_time === null
    ? null
    : `${task.scheduled_date}|${task.reminder_time}`;
}

export function reminderScheduledAt(task: Task): Date | null {
  if (task.reminder_time === null) {
    return null;
  }
  const scheduled = new Date(
    `${task.scheduled_date}T${task.reminder_time}:00`,
  );
  return Number.isNaN(scheduled.getTime()) ? null : scheduled;
}

export function isReminderScheduledInFuture(
  task: Task,
  now: Date,
): boolean {
  const scheduled = reminderScheduledAt(task);
  return (
    task.completed_at === null &&
    scheduled !== null &&
    scheduled.getTime() > now.getTime()
  );
}

export function isReminderDue(task: Task, now: Date): boolean {
  return (
    task.completed_at === null &&
    task.reminder_time !== null &&
    task.scheduled_date === localCivilDate(now) &&
    task.reminder_time <= localTime(now)
  );
}
