import type { Task } from "../../../src/core/task";
import {
  allocateAndroidReminderId,
  readAndroidReminderRegistry,
  removeAndroidReminderRegistry,
  writeAndroidReminderRegistry,
  type AndroidReminderRegistryEntry,
  type AndroidReminderRegistryPort,
} from "./reminder-registry";
import {
  cancelAndroidReminder,
  androidReminderFingerprint,
  isFutureAndroidReminder,
  scheduleAndroidTaskReminder,
  type AndroidLocalNotificationsPort,
  type AndroidReminderSchedulingOutcome,
} from "./notifications";
import { LocalNotifications } from "@capacitor/local-notifications";

export interface AndroidReminderReconciliationResult {
  readonly scheduled: Readonly<Record<string, AndroidReminderSchedulingOutcome>>;
  readonly cancelled_task_ids: readonly string[];
}

function pendingJigTaskId(value: unknown): string | null {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return null;
  }
  const object = Object.fromEntries(Object.entries(value));
  return typeof object.jig_task_id === "string"
    ? object.jig_task_id
    : null;
}

export async function reconcileAndroidReminders(
  tasks: readonly Task[],
  now: Date,
  notificationPort: AndroidLocalNotificationsPort =
    LocalNotifications,
  registryPort?: AndroidReminderRegistryPort,
): Promise<AndroidReminderReconciliationResult> {
  const [registry, pending] = await Promise.all([
    readAndroidReminderRegistry(registryPort),
    notificationPort.getPending(),
  ]);
  const pendingById = new Map(
    pending.notifications.map((notification) => [
      notification.id,
      notification,
    ]),
  );
  const registryByTask = new Map(
    registry.map((entry) => [entry.task_id, entry]),
  );
  const eligible = new Map(
    tasks
      .filter((task) => isFutureAndroidReminder(task, now))
      .map((task) => [task.id, task]),
  );

  const cancelledTaskIds: string[] = [];
  for (const entry of registry) {
    const task = eligible.get(entry.task_id);
    const fingerprint =
      task === undefined
        ? null
        : androidReminderFingerprint(task);
    const pendingNotification = pendingById.get(
      entry.notification_id,
    );
    if (
      task !== undefined &&
      fingerprint === entry.fingerprint &&
      pendingNotification !== undefined
    ) {
      continue;
    }

    if (pendingNotification !== undefined) {
      await cancelAndroidReminder(
        entry.notification_id,
        notificationPort,
      );
    }
    await removeAndroidReminderRegistry(
      entry.task_id,
      registryPort,
    );
    registryByTask.delete(entry.task_id);
    cancelledTaskIds.push(entry.task_id);
  }

  for (const notification of pending.notifications) {
    const taskId = pendingJigTaskId(notification.extra);
    if (taskId === null) {
      continue;
    }
    const registered = registryByTask.get(taskId);
    if (
      registered !== undefined &&
      registered.notification_id === notification.id
    ) {
      continue;
    }
    await cancelAndroidReminder(
      notification.id,
      notificationPort,
    );
  }

  const scheduled: Record<
    string,
    AndroidReminderSchedulingOutcome
  > = {};
  for (const task of eligible.values()) {
    if (registryByTask.has(task.id)) {
      continue;
    }
    const fingerprint = androidReminderFingerprint(task);
    if (fingerprint === null) {
      continue;
    }
    const notificationId = await allocateAndroidReminderId(
      registryPort,
    );
    const outcome = await scheduleAndroidTaskReminder(
      task,
      notificationId,
      now,
      notificationPort,
    );
    scheduled[task.id] = outcome;
    if (
      outcome === "scheduled-exact" ||
      outcome === "scheduled-inexact"
    ) {
      const entry: AndroidReminderRegistryEntry = {
        task_id: task.id,
        notification_id: notificationId,
        fingerprint,
      };
      await writeAndroidReminderRegistry(
        entry,
        registryPort,
      );
      registryByTask.set(task.id, entry);
    }
  }

  return {
    scheduled,
    cancelled_task_ids: cancelledTaskIds,
  };
}
