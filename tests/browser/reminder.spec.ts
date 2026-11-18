import {
  expect,
  test,
} from "@playwright/test";
import {
  apiCommand,
  resetCanonicalTasks,
  taskByTitle,
} from "./helpers";

function reminderStart(): Date {
  return new Date(2030, 0, 7, 9, 0, 0, 0);
}

function civilDate(date: Date): string {
  return [
    date.getFullYear().toString().padStart(4, "0"),
    (date.getMonth() + 1).toString().padStart(2, "0"),
    date.getDate().toString().padStart(2, "0"),
  ].join("-");
}

async function deliveredKeys(page: import("@playwright/test").Page): Promise<string[]> {
  return page.evaluate(() =>
    Object.keys(localStorage).filter((key) =>
      key.startsWith("jig-reminder-delivered:"),
    ),
  );
}

async function installDeliveryProbe(page: import("@playwright/test").Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(Notification, "permission", {
      configurable: true,
      get: () => "granted",
    });
    const registration = {
      showNotification: async (): Promise<void> => undefined,
    };
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        register: async () => registration,
        ready: Promise.resolve(registration),
        getRegistration: async () => ({
          ...registration,
          active: { scriptURL: "/jig-notifications-sw.js" },
        }),
      },
    });
  });
}
test.beforeEach(async ({ page }) => {
  await page.context().grantPermissions(["notifications"]);
  await page.clock.install({ time: reminderStart() });
  await installDeliveryProbe(page);
  await page.goto("/");
  await resetCanonicalTasks(page);
  await page.reload();
});

test("due reminder uses the service-worker delivery path once and edited time gets a new suppression key", async ({
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
  await expect.poll(async () => (await deliveredKeys(page)).length).toBe(1);

  const registration = await page.evaluate(async () => {
    const current = await navigator.serviceWorker.getRegistration();
    return current?.active?.scriptURL ?? null;
  });
  expect(registration).toContain("/jig-notifications-sw.js");

  await page.clock.runFor(30_000);
  await expect.poll(async () => (await deliveredKeys(page)).length).toBe(1);

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

  await expect.poll(async () => (await deliveredKeys(page)).length).toBe(2);
});

test("a reminder already due before this browser session remains visible and gets one catch-up delivery attempt", async ({
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
    reminder_time: "08:59",
  });
  const completed = await taskByTitle(page, "Completed reminder");
  await apiCommand(page, {
    type: "complete",
    task_id: completed.id,
  });

  await page.reload();

  const pastCard = page
    .getByText("Past reminder", { exact: true })
    .locator("xpath=ancestor::li[1]");
  await expect(pastCard).toHaveClass(/jig-task-card-reminder-due/);
  await expect(pastCard.getByText("Reminder due", { exact: true })).toBeVisible();

  await expect.poll(async () => (await deliveredKeys(page)).length).toBe(1);
  await page.clock.runFor(60_000);
  await expect.poll(async () => (await deliveredKeys(page)).length).toBe(1);
});

test("an open Planner enters reminder-due attention when local time crosses the reminder boundary", async ({
  page,
}) => {
  await apiCommand(page, {
    type: "create",
    title: "Open app boundary",
    scheduled_date: civilDate(reminderStart()),
    priority: "NORMAL",
    context: null,
    reference: null,
    note: null,
    reminder_time: "09:01",
  });
  await page.reload();

  const card = page
    .getByText("Open app boundary", { exact: true })
    .locator("xpath=ancestor::li[1]");
  await expect(card).not.toHaveClass(/jig-task-card-reminder-due/);

  await page.clock.runFor(60_000);

  await expect(card).toHaveClass(/jig-task-card-reminder-due/);
  await expect(card.getByText("Reminder due", { exact: true })).toBeVisible();
  await expect.poll(async () => (await deliveredKeys(page)).length).toBe(1);
});
