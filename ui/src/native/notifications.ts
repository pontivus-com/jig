import type { PermissionState } from "@capacitor/core";
import {
  LocalNotifications,
  type LocalNotificationSchema,
  type LocalNotificationsPlugin,
} from "@capacitor/local-notifications";
import type { PluginListenerHandle } from "@capacitor/core";
import type { Task } from "../../../src/core/task";
import {
  isReminderScheduledInFuture,
  reminderScheduledAt,
} from "../../../src/core/reminder";

export type AndroidReminderSchedulingOutcome =
  | "scheduled-exact"
  | "scheduled-inexact"
  | "permission-required"
  | "denied"
  | "failed";

export type AndroidReminderDeliveryOutcome =
  | "display-requested"
  | "permission-required"
  | "denied"
  | "failed";

export interface AndroidReminderPermissionStatus {
  readonly permission:
    | "granted"
    | "permission-required"
    | "denied";
  readonly exact_alarm: "granted" | "unavailable";
}

export type AndroidLocalNotificationsPort = Pick<
  LocalNotificationsPlugin,
  | "schedule"
  | "cancel"
  | "getPending"
  | "checkPermissions"
  | "requestPermissions"
  | "checkExactNotificationSetting"
  | "changeExactNotificationSetting"
>;

export type AndroidReminderListenerPort = Pick<
  LocalNotificationsPlugin,
  "addListener"
>;

function permissionMeaning(
  state: PermissionState,
): AndroidReminderPermissionStatus["permission"] {
  if (state === "granted") {
    return "granted";
  }
  if (state === "denied") {
    return "denied";
  }
  return "permission-required";
}

export async function readAndroidReminderPermission(
  port: AndroidLocalNotificationsPort = LocalNotifications,
): Promise<AndroidReminderPermissionStatus> {
  const [permission, exact] = await Promise.all([
    port.checkPermissions(),
    port.checkExactNotificationSetting(),
  ]);
  return {
    permission: permissionMeaning(permission.display),
    exact_alarm:
      exact.exact_alarm === "granted"
        ? "granted"
        : "unavailable",
  };
}

export async function requestAndroidReminderPermission(
  port: AndroidLocalNotificationsPort = LocalNotifications,
): Promise<AndroidReminderPermissionStatus> {
  const permission = await port.requestPermissions();
  const exact = await port.checkExactNotificationSetting();
  return {
    permission: permissionMeaning(permission.display),
    exact_alarm:
      exact.exact_alarm === "granted"
        ? "granted"
        : "unavailable",
  };
}

export async function openAndroidExactAlarmSettings(
  port: AndroidLocalNotificationsPort = LocalNotifications,
): Promise<AndroidReminderPermissionStatus> {
  await port.changeExactNotificationSetting();
  return readAndroidReminderPermission(port);
}

export function androidReminderFingerprint(task: Task): string | null {
  return task.reminder_time === null
    ? null
    : `${task.scheduled_date}|${task.reminder_time}`;
}

export async function scheduleAndroidTaskReminder(
  task: Task,
  notificationId: number,
  now: Date,
  port: AndroidLocalNotificationsPort = LocalNotifications,
): Promise<AndroidReminderSchedulingOutcome> {
  const at = reminderScheduledAt(task);
  if (
    at === null ||
    !isReminderScheduledInFuture(task, now)
  ) {
    return "failed";
  }

  let settings: AndroidReminderPermissionStatus;
  try {
    settings = await readAndroidReminderPermission(port);
  } catch {
    return "failed";
  }
  if (settings.permission === "denied") {
    return "denied";
  }
  if (settings.permission !== "granted") {
    return "permission-required";
  }

  const exact = settings.exact_alarm === "granted";
  try {
    const result = await port.schedule({
      notifications: [
        {
          id: notificationId,
          title: "Jig reminder",
          body: task.title,
          schedule: {
            at,
            allowWhileIdle: true,
          },
          isExactNotification: exact,
          isExactMandatory: false,
          extra: {
            jig_task_id: task.id,
            jig_reminder_fingerprint:
              androidReminderFingerprint(task),
          },
        },
      ],
    });
    return exact && result.warning === undefined
      ? "scheduled-exact"
      : "scheduled-inexact";
  } catch {
    return "failed";
  }
}

/**
 * Ask Android to display a reminder immediately when an already-due Task is
 * being evaluated while Jig is open. The platform's received event remains
 * the only evidence used to project the notification as displayed.
 */
export async function deliverAndroidTaskReminder(
  task: Task,
  notificationId: number,
  port: AndroidLocalNotificationsPort = LocalNotifications,
): Promise<AndroidReminderDeliveryOutcome> {
  if (task.completed_at !== null || task.reminder_time === null) {
    return "failed";
  }

  let settings: AndroidReminderPermissionStatus;
  try {
    settings = await readAndroidReminderPermission(port);
  } catch {
    return "failed";
  }
  if (settings.permission === "denied") {
    return "denied";
  }
  if (settings.permission !== "granted") {
    return "permission-required";
  }

  try {
    await port.schedule({
      notifications: [
        {
          id: notificationId,
          title: "Jig reminder",
          body: task.title,
          foreground: true,
          autoCancel: true,
          isExactNotification: false,
          isExactMandatory: false,
          extra: {
            jig_task_id: task.id,
            jig_reminder_fingerprint:
              androidReminderFingerprint(task),
          },
        },
      ],
    });
    return "display-requested";
  } catch {
    return "failed";
  }
}

export function listenForAndroidReminderDisplay(
  onReceived: (notification: LocalNotificationSchema) => void,
  port: AndroidReminderListenerPort = LocalNotifications,
): Promise<PluginListenerHandle> {
  return port.addListener(
    "localNotificationReceived",
    onReceived,
  );
}

export async function cancelAndroidReminder(
  notificationId: number,
  port: AndroidLocalNotificationsPort = LocalNotifications,
): Promise<boolean> {
  try {
    await port.cancel({
      notifications: [{ id: notificationId }],
    });
    return true;
  } catch {
    return false;
  }
}
