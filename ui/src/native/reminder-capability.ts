import type { Task } from "../../../src/core/task";
import {
  deliverAndroidTaskReminder,
  listenForAndroidReminderDisplay,
  type AndroidReminderDeliveryOutcome,
} from "./notifications";
import { allocateAndroidReminderId } from "./reminder-registry";

export async function installAndroidReminderDisplayObserver(
  onReceived: (taskId: string, fingerprint: string) => void,
): Promise<() => Promise<void>> {
  const handle = await listenForAndroidReminderDisplay((notification) => {
    const extra =
      notification.extra !== null &&
      typeof notification.extra === "object" &&
      !Array.isArray(notification.extra)
        ? Object.fromEntries(Object.entries(notification.extra))
        : null;
    const taskId =
      extra !== null && typeof extra.jig_task_id === "string"
        ? extra.jig_task_id
        : null;
    const fingerprint =
      extra !== null &&
      typeof extra.jig_reminder_fingerprint === "string"
        ? extra.jig_reminder_fingerprint
        : null;
    if (taskId !== null && fingerprint !== null) {
      onReceived(taskId, fingerprint);
    }
  });
  return () => handle.remove();
}

export async function requestAndroidDueReminderDisplay(
  task: Task,
): Promise<AndroidReminderDeliveryOutcome> {
  const notificationId = await allocateAndroidReminderId();
  return deliverAndroidTaskReminder(task, notificationId);
}
