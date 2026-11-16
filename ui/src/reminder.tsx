import { useToast } from "@astryxdesign/core/Toast";
import { useEffect, useRef } from "react";
import type { Task } from "../../src/core/task";
import { todayCivilDate } from "./dates";

const REMINDER_INTERVAL_MS = 30_000;
const REMINDER_KEY_PREFIX = "jig-reminder-delivered:";

function reminderKey(task: Task): string | null {
  if (task.reminder_time === null) {
    return null;
  }
  return [
    REMINDER_KEY_PREFIX,
    task.id,
    task.scheduled_date,
    task.reminder_time,
  ].join("|");
}

function reminderDueAt(task: Task): Date | null {
  if (task.reminder_time === null) {
    return null;
  }
  const [year, month, day] = task.scheduled_date.split("-").map(Number);
  const [hour, minute] = task.reminder_time.split(":").map(Number);
  return new Date(
    year ?? 0,
    (month ?? 1) - 1,
    day ?? 1,
    hour ?? 0,
    minute ?? 0,
    0,
    0,
  );
}

function pruneOldReminderKeys(today: string): void {
  try {
    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const key = localStorage.key(index);
      if (key === null || !key.startsWith(REMINDER_KEY_PREFIX)) {
        continue;
      }
      const parts = key.split("|");
      const scheduledDate = parts.at(-2);
      if (scheduledDate !== undefined && scheduledDate < today) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    // Device-local suppression is best effort. Toast delivery still works.
  }
}

function wasDelivered(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function markDelivered(key: string): void {
  try {
    localStorage.setItem(key, "1");
  } catch {
    // Suppression persistence is best effort and never affects Task state.
  }
}

export function ReminderMonitor({
  tasks,
}: Readonly<{ tasks: readonly Task[] }>): null {
  const showToast = useToast();
  const sessionStartedAt = useRef(new Date());

  useEffect(() => {
    pruneOldReminderKeys(todayCivilDate());

    const check = (): void => {
      if (document.visibilityState !== "visible") {
        return;
      }

      const now = new Date();
      const today = todayCivilDate(now);
      for (const task of tasks) {
        if (
          task.completed_at !== null ||
          task.scheduled_date !== today ||
          task.reminder_time === null
        ) {
          continue;
        }

        const dueAt = reminderDueAt(task);
        const key = reminderKey(task);
        if (
          dueAt === null ||
          key === null ||
          dueAt < sessionStartedAt.current ||
          dueAt > now ||
          wasDelivered(key)
        ) {
          continue;
        }

        markDelivered(key);
        showToast({
          body: `Reminder: ${task.title}`,
          uniqueID: key,
          collisionBehavior: "ignore",
        });
      }
    };

    check();
    const interval = window.setInterval(check, REMINDER_INTERVAL_MS);
    const onVisibility = (): void => {
      if (document.visibilityState === "visible") {
        check();
      }
    };
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [showToast, tasks]);

  return null;
}
