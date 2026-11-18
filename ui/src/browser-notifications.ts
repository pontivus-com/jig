export type BrowserNotificationState =
  | "unsupported"
  | NotificationPermission;

function browserNotificationsSupported(): boolean {
  return typeof window.Notification !== "undefined";
}

export function browserNotificationState(): BrowserNotificationState {
  if (!browserNotificationsSupported()) {
    return "unsupported";
  }
  return window.Notification.permission;
}

export async function requestBrowserNotificationPermission(): Promise<BrowserNotificationState> {
  if (!browserNotificationsSupported()) {
    return "unsupported";
  }
  return window.Notification.requestPermission();
}
