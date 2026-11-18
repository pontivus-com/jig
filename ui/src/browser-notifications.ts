export type BrowserNotificationState =
  | "unsupported"
  | NotificationPermission;

export type BrowserNotificationDeliveryOutcome =
  | "displayed"
  | "permission-required"
  | "denied"
  | "unsupported"
  | "failed";

const SERVICE_WORKER_URL = "/jig-notifications-sw.js";

let registrationPromise: Promise<ServiceWorkerRegistration> | null = null;

function browserNotificationsSupported(): boolean {
  return (
    typeof window.Notification !== "undefined" &&
    "serviceWorker" in navigator
  );
}

async function notificationRegistration(): Promise<ServiceWorkerRegistration> {
  if (registrationPromise === null) {
    registrationPromise = navigator.serviceWorker
      .register(SERVICE_WORKER_URL)
      .then(async (registration) => {
        if (registration.active !== null) {
          return registration;
        }
        return navigator.serviceWorker.ready;
      })
      .catch((error: unknown) => {
        registrationPromise = null;
        throw error;
      });
  }
  return registrationPromise;
}

export async function prepareBrowserNotificationServiceWorker(): Promise<void> {
  if (!browserNotificationsSupported()) {
    return;
  }
  try {
    await notificationRegistration();
  } catch {
    // Readiness is retried by the actual delivery path. Registration failure
    // never changes canonical reminder-due state.
  }
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

export async function displayBrowserNotification(
  title: string,
  options: NotificationOptions,
): Promise<BrowserNotificationDeliveryOutcome> {
  const state = browserNotificationState();
  if (state === "unsupported") {
    return "unsupported";
  }
  if (state === "default") {
    return "permission-required";
  }
  if (state === "denied") {
    return "denied";
  }

  try {
    const registration = await notificationRegistration();
    await registration.showNotification(title, options);
    return "displayed";
  } catch {
    return "failed";
  }
}
