import {
  expect,
  test,
} from "@playwright/test";
import {
  apiCommand,
  apiState,
  browserCivilDate,
  resetCanonicalTasks,
  taskByTitle,
} from "./helpers";

function localMorning(): Date {
  const now = new Date();
  now.setHours(9, 0, 0, 0);
  return now;
}

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: localMorning() });
  await page.goto("/");
  await resetCanonicalTasks(page);
  await page.reload();
});

test("visible due reminder fires one in-app toast and edited time creates a new key", async ({
  page,
}) => {
  const today = await browserCivilDate(page);
  await apiCommand(page, {
    type: "create",
    title: "Timed reminder",
    scheduled_date: today,
    priority: "NORMAL",
    context: null,
    reference: null,
    note: null,
    reminder_time: "09:01",
  });
  await page.reload();

  await page.clock.runFor(60_000);
  const dismiss = page.getByRole("button", {
    name: "Dismiss",
    exact: true,
  });
  await expect(dismiss).toBeVisible();
  await dismiss.click();
  await expect(dismiss).toBeHidden();

  await page.clock.runFor(30_000);
  await expect(
    page.getByRole("button", { name: "Dismiss", exact: true }),
  ).toHaveCount(0);

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

  await expect(
    page.getByRole("button", { name: "Dismiss", exact: true }),
  ).toBeVisible();

  const deliveredKeys = await page.evaluate(() =>
    Object.keys(localStorage).filter((key) =>
      key.startsWith("jig-reminder-delivered:"),
    ),
  );
  expect(deliveredKeys).toHaveLength(2);
});

test("hidden open page uses browser Notification when permission is granted", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const calls: Array<{ title: string; body?: string; tag?: string }> = [];
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    class NotificationStub {
      static permission: NotificationPermission = "granted";
      static requestPermission = async (): Promise<NotificationPermission> =>
        "granted";
      constructor(title: string, options?: NotificationOptions) {
        calls.push({
          title,
          body: options?.body,
          tag: options?.tag,
        });
      }
    }
    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: NotificationStub,
    });
    (window as typeof window & { __notificationCalls?: typeof calls })
      .__notificationCalls = calls;
  });
  await page.reload();
  const today = await browserCivilDate(page);
  await apiCommand(page, {
    type: "create",
    title: "Hidden notification",
    scheduled_date: today,
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
        () =>
          (window as typeof window & {
            __notificationCalls?: Array<{
              title: string;
              body?: string;
              tag?: string;
            }>;
          }).__notificationCalls ?? [],
      ),
    )
    .toHaveLength(1);

  const [notification] = await page.evaluate(
    () =>
      (window as typeof window & {
        __notificationCalls?: Array<{
          title: string;
          body?: string;
          tag?: string;
        }>;
      }).__notificationCalls ?? [],
  );
  expect(notification).toMatchObject({
    title: "Jig reminder",
    body: "Hidden notification",
  });
  expect(notification?.tag).toContain(today);
  await expect(
    page.getByRole("button", { name: "Dismiss", exact: true }),
  ).toHaveCount(0);
});

test("hidden reminder without permission remains eligible for visible-page catch-up", async ({
  page,
}) => {
  await page.addInitScript(() => {
    let visibility: DocumentVisibilityState = "hidden";
    class NotificationStub {
      static permission: NotificationPermission = "default";
      static requestPermission = async (): Promise<NotificationPermission> =>
        "default";
    }
    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: NotificationStub,
    });
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => visibility,
    });
    (
      window as typeof window & {
        __setTestVisibility?: (next: DocumentVisibilityState) => void;
      }
    ).__setTestVisibility = (next) => {
      visibility = next;
      document.dispatchEvent(new Event("visibilitychange"));
    };
  });
  await page.reload();

  const today = await browserCivilDate(page);
  await apiCommand(page, {
    type: "create",
    title: "Catch-up reminder",
    scheduled_date: today,
    priority: "NORMAL",
    context: null,
    reference: null,
    note: null,
    reminder_time: "09:01",
  });
  await page.reload();

  await page.clock.runFor(60_000);

  const deliveredBefore = await page.evaluate(() =>
    Object.keys(localStorage).filter((key) =>
      key.includes("Catch-up reminder"),
    ),
  );
  expect(deliveredBefore).toHaveLength(0);
  await expect(
    page.getByRole("button", { name: "Dismiss", exact: true }),
  ).toHaveCount(0);

  await page.evaluate(() => {
    (
      window as typeof window & {
        __setTestVisibility?: (next: DocumentVisibilityState) => void;
      }
    ).__setTestVisibility?.("visible");
  });

  await expect(
    page.getByRole("button", { name: "Dismiss", exact: true }),
  ).toBeVisible();
});

test("permission is requested only from the explicit Settings Enable action", async ({
  page,
}) => {
  await page.addInitScript(() => {
    let requests = 0;
    class NotificationStub {
      static permission: NotificationPermission = "default";
      static requestPermission = async (): Promise<NotificationPermission> => {
        requests += 1;
        NotificationStub.permission = "granted";
        return "granted";
      };
    }
    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: NotificationStub,
    });
    (window as typeof window & { __permissionRequests?: () => number })
      .__permissionRequests = () => requests;
  });
  await page.reload();

  expect(
    await page.evaluate(
      () =>
        (window as typeof window & {
          __permissionRequests?: () => number;
        }).__permissionRequests?.() ?? -1,
    ),
  ).toBe(0);

  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Enable", exact: true }).click();

  await expect(page.getByText("Enabled.", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        (window as typeof window & {
          __permissionRequests?: () => number;
        }).__permissionRequests?.() ?? -1,
    ),
  ).toBe(1);
});

test("past reminders from before the browser session are not replayed and completed tasks are ineligible", async ({
  page,
}) => {
  const today = await browserCivilDate(page);
  await apiCommand(page, {
    type: "create",
    title: "Past reminder",
    scheduled_date: today,
    priority: "NORMAL",
    context: null,
    reference: null,
    note: null,
    reminder_time: "08:59",
  });
  await apiCommand(page, {
    type: "create",
    title: "Completed reminder",
    scheduled_date: today,
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

  await expect(
    page.getByRole("status").filter({ hasText: "Past reminder" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("status").filter({ hasText: "Completed reminder" }),
  ).toHaveCount(0);

  const titles = (await apiState(page)).tasks.map((task) => task.title);
  expect(titles).toContain("Past reminder");
  expect(titles).toContain("Completed reminder");
});
