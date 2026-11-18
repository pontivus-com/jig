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

export function isReminderDue(task: Task, now: Date): boolean {
  return (
    task.completed_at === null &&
    task.reminder_time !== null &&
    task.scheduled_date === localCivilDate(now) &&
    task.reminder_time <= localTime(now)
  );
}
