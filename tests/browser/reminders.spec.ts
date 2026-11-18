import { expect, test, type Page } from "@playwright/test";
import {
  apiCommand,
  apiState,
  browserCivilDate,
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
    __JIG_NOTIFICATION_SHOULD_THROW__?: boolean;
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

test("visible due reminder uses browser Notification and no in-app Toast", async ({
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

  const calls = await page.evaluate(
    () => window.__JIG_NOTIFICATION_CALLS__ ?? [],
  );
  expect(calls).toHaveLength(1);
  expect(calls[0]).toMatchObject({
    title: "Jig reminder",
    body: "Visible reminder",
  });
  await expect(page.locator(".jig-reminder-toast-content")).toHaveCount(0);
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


test("due reminder without permission stays undelivered until explicit grant", async ({
  page,
}) => {
  await prepareReminderPage(page, "default");
  await apiCommand(page, {
    type: "create",
    title: "Permission-gated reminder",
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
  expect(
    await page.evaluate(() => window.__JIG_NOTIFICATION_CALLS__ ?? []),
  ).toEqual([]);

  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(
    await page.evaluate(() => window.__JIG_NOTIFICATION_CALLS__ ?? []),
  ).toEqual([]);
  await expect(page.locator(".jig-reminder-toast-content")).toHaveCount(0);

  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Enable", exact: true }).click();
  await page.clock.fastForward(30_000);

  const calls = await page.evaluate(
    () => window.__JIG_NOTIFICATION_CALLS__ ?? [],
  );
  expect(calls).toHaveLength(1);
  expect(calls[0]).toMatchObject({
    title: "Jig reminder",
    body: "Permission-gated reminder",
  });
});

test("denied notification permission leaves a due reminder undelivered", async ({
  page,
}) => {
  await prepareReminderPage(page, "denied");
  await apiCommand(page, {
    type: "create",
    title: "Denied reminder",
    scheduled_date: civilDate(reminderStart()),
    priority: "NORMAL",
    context: null,
    reference: null,
    note: null,
    reminder_time: "10:00",
  });
  await page.reload();
  await page.clock.fastForward(60_000);

  expect(await page.evaluate(() => window.__JIG_NOTIFICATION_CALLS__ ?? []))
    .toEqual([]);
  expect(
    await page.evaluate(() =>
      Object.keys(localStorage).filter((key) =>
        key.startsWith("jig-reminder-delivered:"),
      ),
    ),
  ).toEqual([]);
});

test("unsupported Notification capability does not claim reminder delivery", async ({
  page,
}) => {
  await page.clock.install({ time: reminderStart() });
  await page.addInitScript(() => {
    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: undefined,
    });
  });
  await page.goto("/");
  await resetCanonicalTasks(page);
  await apiCommand(page, {
    type: "create",
    title: "Unsupported reminder",
    scheduled_date: civilDate(reminderStart()),
    priority: "NORMAL",
    context: null,
    reference: null,
    note: null,
    reminder_time: "10:00",
  });
  await page.reload();
  await page.clock.fastForward(60_000);

  expect(
    await page.evaluate(() =>
      Object.keys(localStorage).filter((key) =>
        key.startsWith("jig-reminder-delivered:"),
      ),
    ),
  ).toEqual([]);
  await expect(page.locator(".jig-reminder-toast-content")).toHaveCount(0);
});

test("Notification constructor failure remains retryable until delivery succeeds", async ({
  page,
}) => {
  await page.clock.install({ time: reminderStart() });
  await page.addInitScript(() => {
    window.__JIG_NOTIFICATION_CALLS__ = [];
    window.__JIG_NOTIFICATION_SHOULD_THROW__ = true;

    class RetryableNotification {
      static permission: NotificationPermission = "granted";

      static async requestPermission(): Promise<NotificationPermission> {
        return "granted";
      }

      constructor(title: string, options?: NotificationOptions) {
        if (window.__JIG_NOTIFICATION_SHOULD_THROW__ === true) {
          throw new Error("synthetic Notification constructor failure");
        }
        window.__JIG_NOTIFICATION_CALLS__?.push({
          title,
          body: options?.body ?? null,
          tag: options?.tag ?? null,
        });
      }
    }

    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: RetryableNotification,
    });
  });
  await page.goto("/");
  await resetCanonicalTasks(page);
  await apiCommand(page, {
    type: "create",
    title: "Retryable reminder",
    scheduled_date: civilDate(reminderStart()),
    priority: "NORMAL",
    context: null,
    reference: null,
    note: null,
    reminder_time: "10:00",
  });
  await page.reload();

  await page.clock.fastForward(60_000);
  expect(await page.evaluate(() => window.__JIG_NOTIFICATION_CALLS__ ?? []))
    .toEqual([]);
  expect(
    await page.evaluate(() =>
      Object.keys(localStorage).filter((key) =>
        key.startsWith("jig-reminder-delivered:"),
      ),
    ),
  ).toEqual([]);

  await page.evaluate(() => {
    window.__JIG_NOTIFICATION_SHOULD_THROW__ = false;
  });
  await page.clock.fastForward(30_000);

  await expect
    .poll(() => page.evaluate(() => window.__JIG_NOTIFICATION_CALLS__?.length ?? 0))
    .toBe(1);
  expect(
    await page.evaluate(() =>
      Object.keys(localStorage).filter((key) =>
        key.startsWith("jig-reminder-delivered:"),
      ).length,
    ),
  ).toBe(1);
});

test("rolled-forward reminder uses today's canonical date and preserved time", async ({
  page,
}) => {
  await prepareReminderPage(page, "granted");
  const today = await browserCivilDate(page);
  const yesterday = await browserCivilDate(page, -1);

  await apiCommand(page, {
    type: "create",
    title: "Rolled reminder",
    scheduled_date: yesterday,
    priority: "NORMAL",
    context: null,
    reference: null,
    note: null,
    reminder_time: "10:00",
  });

  const rolled = (await apiState(page)).tasks.find(
    (task) => task.title === "Rolled reminder",
  );
  expect(rolled).toBeDefined();
  expect(rolled?.scheduled_date).toBe(today);
  expect(rolled?.reminder_time).toBe("10:00");

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
    body: "Rolled reminder",
  });
  expect(calls[0]?.tag).toContain(`${today}|10:00`);
});

test("completed Task never delivers its due reminder", async ({
  page,
}) => {
  await prepareReminderPage(page, "granted");
  const today = civilDate(reminderStart());
  await apiCommand(page, {
    type: "create",
    title: "Completed reminder",
    scheduled_date: today,
    priority: "NORMAL",
    context: null,
    reference: null,
    note: null,
    reminder_time: "10:00",
  });
  const created = (await apiState(page)).tasks.find(
    (task) => task.title === "Completed reminder",
  );
  if (created === undefined) {
    throw new Error("completed reminder Task missing");
  }
  await apiCommand(page, {
    type: "complete",
    task_id: created.id,
  });
  await page.reload();

  await page.clock.fastForward(60_000);

  expect(
    await page.evaluate(() => window.__JIG_NOTIFICATION_CALLS__ ?? []),
  ).toEqual([]);
  await expect(
    page.getByText("Reminder: Completed reminder", { exact: true }),
  ).toHaveCount(0);
});
