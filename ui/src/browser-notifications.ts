export type BrowserNotificationState =
  | "unsupported"
  | NotificationPermission;

export function browserNotificationState(): BrowserNotificationState {
  if (!("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission;
}

export async function requestBrowserNotificationPermission(): Promise<BrowserNotificationState> {
  if (!("Notification" in window)) {
    return "unsupported";
  }
  return Notification.requestPermission();
}
