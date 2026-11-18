import {
  useEffect,
  useRef,
  useState,
} from "react";
import type { Task } from "../../src/core/task";
import { isReminderDue } from "../../src/core/reminder";
import {
  browserNotificationState,
  displayBrowserNotification,
  prepareBrowserNotificationServiceWorker,
} from "./browser-notifications";
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
    // Device-local suppression is best effort and never affects Task state.
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

export function useReminderClock(): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const tick = (): void => {
      setNow(new Date());
    };
    const interval = window.setInterval(tick, REMINDER_INTERVAL_MS);
    const onVisibility = (): void => {
      if (document.visibilityState === "visible") {
        tick();
      }
    };

    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return now;
}

export function ReminderMonitor({
  tasks,
  now,
}: Readonly<{
  tasks: readonly Task[];
  now: Date;
}>): null {
  const attemptingKeys = useRef(new Set<string>());

  useEffect(() => {
    void prepareBrowserNotificationServiceWorker();
  }, []);

  useEffect(() => {
    pruneOldReminderKeys(todayCivilDate(now));

    for (const task of tasks) {
      if (!isReminderDue(task, now)) {
        continue;
      }

      const key = reminderKey(task);
      if (
        key === null ||
        wasDelivered(key) ||
        attemptingKeys.current.has(key) ||
        browserNotificationState() !== "granted"
      ) {
        continue;
      }

      attemptingKeys.current.add(key);
      void displayBrowserNotification("Jig reminder", {
        body: task.title,
        tag: key,
      }).then((outcome) => {
        if (outcome === "displayed") {
          markDelivered(key);
        }
      }).finally(() => {
        attemptingKeys.current.delete(key);
      });
    }
  }, [now, tasks]);

  return null;
}
