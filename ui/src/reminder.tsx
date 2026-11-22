import {
  useEffect,
  useRef,
  useState,
} from "react";
import type { Task } from "../../src/core/task";
import {
  isReminderDue,
  isReminderScheduledInFuture,
  reminderFingerprint,
} from "../../src/core/reminder";
import {
  installRuntimeReminderDisplayObserver,
  requestRuntimeDueReminderDisplay,
  usesNativeReminderDelivery,
} from "./runtime";
import {
  browserNotificationState,
  displayBrowserNotification,
  prepareBrowserNotificationServiceWorker,
} from "./browser-notifications";
import { todayCivilDate } from "./dates";

const REMINDER_INTERVAL_MS = 30_000;
const REMINDER_KEY_PREFIX = "jig-reminder-delivered:";

export type ReminderLifecycle =
  | "none"
  | "scheduled"
  | "due"
  | "notified";

export function reminderDeliveryKey(task: Task): string | null {
  const fingerprint = reminderFingerprint(task);
  return fingerprint === null
    ? null
    : [REMINDER_KEY_PREFIX, task.id, fingerprint].join("|");
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

export function markReminderNotified(key: string): void {
  try {
    localStorage.setItem(key, "1");
  } catch {
    // Presentation bookkeeping is best effort and never affects Task state.
  }
}

export function isReminderNotified(task: Task): boolean {
  const key = reminderDeliveryKey(task);
  return key !== null && wasDelivered(key);
}

export function useReminderLifecycle(
  task: Task,
  now: Date,
): ReminderLifecycle {
  const notified = isReminderNotified(task);

  if (
    task.completed_at !== null ||
    task.reminder_time === null
  ) {
    return "none";
  }
  if (isReminderDue(task, now)) {
    return notified ? "notified" : "due";
  }
  return isReminderScheduledInFuture(task, now)
    ? "scheduled"
    : "none";
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
  onReminderNotified,
}: Readonly<{
  tasks: readonly Task[];
  now: Date;
  onReminderNotified: () => void;
}>): null {
  const attemptingKeys = useRef(new Set<string>());
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;
  const nativeListenerReady = useRef<Promise<boolean> | null>(null);

  useEffect(() => {
    if (!usesNativeReminderDelivery()) {
      return;
    }

    let active = true;
    let removeListener: (() => Promise<void>) | null = null;
    const ready = installRuntimeReminderDisplayObserver(
      (taskId, fingerprint) => {
        const task = tasksRef.current.find(
          (candidate) =>
            candidate.id === taskId &&
            reminderDeliveryKey(candidate) !== null &&
            reminderFingerprint(candidate) === fingerprint,
        );
        const key = task === undefined ? null : reminderDeliveryKey(task);
        if (key !== null) {
          markReminderNotified(key);
          onReminderNotified();
          attemptingKeys.current.delete(key);
        }
      },
    ).then((remove) => {
      if (remove === null) {
        return false;
      }
      if (!active) {
        void remove();
        return false;
      }
      removeListener = remove;
      return true;
    }).catch(() => false);
    nativeListenerReady.current = ready;

    return () => {
      active = false;
      if (removeListener !== null) {
        void removeListener();
      }
    };
  }, [onReminderNotified]);

  useEffect(() => {
    if (!usesNativeReminderDelivery()) {
      return;
    }
    const ready = nativeListenerReady.current;
    if (ready === null) {
      return;
    }
    void ready.then((listening) => {
      if (!listening) {
        return;
      }
      for (const task of tasks) {
        if (!isReminderDue(task, now)) {
          continue;
        }
        const key = reminderDeliveryKey(task);
        if (
          key === null ||
          wasDelivered(key) ||
          attemptingKeys.current.has(key)
        ) {
          continue;
        }
        attemptingKeys.current.add(key);
        void requestRuntimeDueReminderDisplay(task)
          .then((requested) => {
            if (!requested) {
              attemptingKeys.current.delete(key);
            }
          })
          .catch(() => {
            attemptingKeys.current.delete(key);
          });
      }
    });
  }, [now, tasks]);

  useEffect(() => {
    if (usesNativeReminderDelivery()) {
      return;
    }
    void prepareBrowserNotificationServiceWorker();
  }, []);

  useEffect(() => {
    if (usesNativeReminderDelivery()) {
      return;
    }
    pruneOldReminderKeys(todayCivilDate(now));

    for (const task of tasks) {
      if (!isReminderDue(task, now)) {
        continue;
      }

      const key = reminderDeliveryKey(task);
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
          markReminderNotified(key);
          onReminderNotified();
        }
      }).finally(() => {
        attemptingKeys.current.delete(key);
      });
    }
  }, [now, tasks]);

  return null;
}
