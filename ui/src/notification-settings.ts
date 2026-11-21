import { Capacitor } from "@capacitor/core";
import {
  browserNotificationState,
  requestBrowserNotificationPermission,
} from "./browser-notifications";
import {
  openAndroidExactAlarmSettings,
  readAndroidReminderPermission,
  requestAndroidReminderPermission,
} from "./native/notifications";

export type NotificationSettingsState =
  | {
      readonly platform: "browser";
      readonly permission:
        | "unsupported"
        | NotificationPermission;
      readonly exact_alarm: null;
    }
  | {
      readonly platform: "android";
      readonly permission:
        | "granted"
        | "permission-required"
        | "denied";
      readonly exact_alarm:
        | "granted"
        | "unavailable";
    };

export async function readNotificationSettings():
Promise<NotificationSettingsState> {
  if (Capacitor.isNativePlatform()) {
    return {
      platform: "android",
      ...(await readAndroidReminderPermission()),
    };
  }
  return {
    platform: "browser",
    permission: browserNotificationState(),
    exact_alarm: null,
  };
}

export async function requestNotificationPermission():
Promise<NotificationSettingsState> {
  if (Capacitor.isNativePlatform()) {
    return {
      platform: "android",
      ...(await requestAndroidReminderPermission()),
    };
  }
  return {
    platform: "browser",
    permission:
      await requestBrowserNotificationPermission(),
    exact_alarm: null,
  };
}

export async function openExactReminderSettings():
Promise<NotificationSettingsState> {
  if (!Capacitor.isNativePlatform()) {
    return readNotificationSettings();
  }
  return {
    platform: "android",
    ...(await openAndroidExactAlarmSettings()),
  };
}
