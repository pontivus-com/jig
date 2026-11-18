import {
  expect,
  test,
} from "@playwright/test";

declare global {
  interface Window {
    __JIG_REMINDER_TEST_NOTIFICATIONS__?: Array<{
      title: string;
      body: string | null;
      tag: string | null;
    }>;
  }
}
import {
  apiCommand,
  apiState,
  resetCanonicalTasks,
  taskByTitle,
} from "./helpers";

function reminderStart(): Date {
  const start = new Date();
  start.setHours(9, 0, 0, 0);
  return start;
}

function civilDate(date: Date): string {
  return [
    date.getFullYear().toString().padStart(4, "0"),
    (date.getMonth() + 1).toString().padStart(2, "0"),
    date.getDate().toString().padStart(2, "0"),
  ].join("-");
}

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: reminderStart() });
  await page.addInitScript(() => {
    window.__JIG_REMINDER_TEST_NOTIFICATIONS__ = [];

    class MockNotification {
      static permission: NotificationPermission = "granted";

      static async requestPermission(): Promise<NotificationPermission> {
        return "granted";
      }

      constructor(title: string, options?: NotificationOptions) {
        window.__JIG_REMINDER_TEST_NOTIFICATIONS__?.push({
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
  });
  await page.goto("/");
  await resetCanonicalTasks(page);
  await page.reload();
});

test("due reminder fires once through browser Notification and edited time creates a new suppression key", async ({
  page,
}) => {
  await apiCommand(page, {
    type: "create",
    title: "Timed reminder",
    scheduled_date: civilDate(reminderStart()),
    priority: "NORMAL",
    context: null,
    reference: null,
    note: null,
    reminder_time: "09:01",
  });
  await page.reload();

  await page.clock.runFor(60_000);
  await expect
    .poll(() =>
      page.evaluate(
        () => window.__JIG_REMINDER_TEST_NOTIFICATIONS__?.length ?? 0,
      ),
    )
    .toBe(1);
  await expect(page.locator(".jig-reminder-toast-content")).toHaveCount(0);

  await page.clock.runFor(30_000);
  await expect
    .poll(() =>
      page.evaluate(
        () => window.__JIG_REMINDER_TEST_NOTIFICATIONS__?.length ?? 0,
      ),
    )
    .toBe(1);

  let deliveredKeys = await page.evaluate(() =>
    Object.keys(localStorage).filter((key) =>
      key.startsWith("jig-reminder-delivered:"),
    ),
  );
  expect(deliveredKeys).toHaveLength(1);

  const task = await taskByTitle(page, "Timed reminder");
  await apiCommand(page, {
    type: "edit",
    task_id: task.id,
    changes: {
      reminder_time: "09:02",
    },
  });
  await page.reload();
  await page.clock.runFor(30_000);

  await expect
    .poll(() =>
      page.evaluate(
        () => window.__JIG_REMINDER_TEST_NOTIFICATIONS__?.length ?? 0,
      ),
    )
    .toBe(1);

  deliveredKeys = await page.evaluate(() =>
    Object.keys(localStorage).filter((key) =>
      key.startsWith("jig-reminder-delivered:"),
    ),
  );
  expect(deliveredKeys).toHaveLength(2);
});

test("past reminders from before the browser session are not replayed and completed tasks are ineligible", async ({
  page,
}) => {
  await apiCommand(page, {
    type: "create",
    title: "Past reminder",
    scheduled_date: civilDate(reminderStart()),
    priority: "NORMAL",
    context: null,
    reference: null,
    note: null,
    reminder_time: "08:59",
  });
  await apiCommand(page, {
    type: "create",
    title: "Completed reminder",
    scheduled_date: civilDate(reminderStart()),
    priority: "NORMAL",
    context: null,
    reference: null,
    note: null,
    reminder_time: "09:01",
  });
  const completed = await taskByTitle(page, "Completed reminder");
  await apiCommand(page, {
    type: "complete",
    task_id: completed.id,
  });
  await page.reload();

  await page.clock.runFor(120_000);

  expect(
    await page.evaluate(
      () => window.__JIG_REMINDER_TEST_NOTIFICATIONS__ ?? [],
    ),
  ).toEqual([]);
  await expect(page.locator(".jig-reminder-toast-content")).toHaveCount(0);

  const titles = (await apiState(page)).tasks.map((task) => task.title);
  expect(titles).toContain("Past reminder");
  expect(titles).toContain("Completed reminder");
});