import { expect, test, type Page } from "@playwright/test";
import {
  apiCommand,
  resetCanonicalTasks,
} from "./helpers";

declare global {
  interface Window {
    __JIG_NOTIFICATION_CALLS__?: Array<{
      title: string;
      body: string | null;
      tag: string | null;
    }>;
    __JIG_PERMISSION_REQUESTS__?: number;
  }
}

async function installNotificationMock(
  page: Page,
  permission: "default" | "granted" | "denied",
): Promise<void> {
  await page.addInitScript((initialPermission) => {
    window.__JIG_NOTIFICATION_CALLS__ = [];
    window.__JIG_PERMISSION_REQUESTS__ = 0;

    class MockNotification {
      static permission: NotificationPermission = initialPermission;

      static async requestPermission(): Promise<NotificationPermission> {
        window.__JIG_PERMISSION_REQUESTS__ =
          (window.__JIG_PERMISSION_REQUESTS__ ?? 0) + 1;
        MockNotification.permission = "granted";
        return "granted";
      }

      constructor(
        title: string,
        options?: NotificationOptions,
      ) {
        window.__JIG_NOTIFICATION_CALLS__?.push({
          title,
          body: options?.body ?? null,
          tag: options?.tag ?? null,
        });
      }
    }

    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: MockNotification,
    });
  }, permission);
}

function reminderStart(): Date {
  const start = new Date();
  start.setHours(9, 59, 30, 0);
  return start;
}

function civilDate(date: Date): string {
  return [
    date.getFullYear().toString().padStart(4, "0"),
    (date.getMonth() + 1).toString().padStart(2, "0"),
    date.getDate().toString().padStart(2, "0"),
  ].join("-");
}

async function prepareReminderPage(
  page: Page,
  permission: "default" | "granted" | "denied",
): Promise<void> {
  await page.clock.install({
    time: reminderStart(),
  });
  await installNotificationMock(page, permission);
  await page.goto("/");
  await resetCanonicalTasks(page);
  await page.reload();
}

test("visible due reminder uses the in-app toast and not browser Notification", async ({
  page,
}) => {
  await prepareReminderPage(page, "granted");
  await apiCommand(page, {
    type: "create",
    title: "Visible reminder",
    scheduled_date: civilDate(reminderStart()),
    priority: "NORMAL",
    context: null,
    reference: null,
    note: null,
    reminder_time: "10:00",
  });
  await page.reload();

  await page.clock.fastForward(60_000);

  await expect(
    page
      .getByRole("region", { name: "Notifications" })
      .getByText("Reminder: Visible reminder", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => window.__JIG_NOTIFICATION_CALLS__ ?? []),
  ).toEqual([]);
});

test("hidden open page with granted permission uses one browser Notification", async ({
  page,
}) => {
  await prepareReminderPage(page, "granted");
  await apiCommand(page, {
    type: "create",
    title: "Hidden reminder",
    scheduled_date: civilDate(reminderStart()),
    priority: "NORMAL",
    context: null,
    reference: null,
    note: null,
    reminder_time: "10:00",
  });
  await page.reload();

  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
  });
  await page.clock.fastForward(60_000);

  const calls = await page.evaluate(
    () => window.__JIG_NOTIFICATION_CALLS__ ?? [],
  );
  expect(calls).toHaveLength(1);
  expect(calls[0]).toMatchObject({
    title: "Jig reminder",
    body: "Hidden reminder",
  });
  expect(calls[0]?.tag).toContain(`${civilDate(reminderStart())}|10:00`);

  await page.clock.fastForward(60_000);
  expect(
    await page.evaluate(() => window.__JIG_NOTIFICATION_CALLS__ ?? []),
  ).toHaveLength(1);
});

test("notification permission is requested only from the Settings Enable action", async ({
  page,
}) => {
  await prepareReminderPage(page, "default");
  expect(
    await page.evaluate(() => window.__JIG_PERMISSION_REQUESTS__ ?? 0),
  ).toBe(0);

  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByText("Not enabled", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Enable", exact: true }).click();

  await expect(page.getByText("Enabled", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(() => window.__JIG_PERMISSION_REQUESTS__ ?? 0),
  ).toBe(1);
});
