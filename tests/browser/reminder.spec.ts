import {
  expect,
  test,
} from "@playwright/test";
import {
  apiCommand,
  apiState,
  resetCanonicalTasks,
  taskByTitle,
} from "./helpers";

const START = new Date("2026-11-16T09:00:00.000Z");

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: START });
  await page.goto("/");
  await resetCanonicalTasks(page);
  await page.reload();
});

test("due reminder fires once while open, dismisses, and edited time creates a new suppression key", async ({
  page,
}) => {
  await apiCommand(page, {
    type: "create",
    title: "Timed reminder",
    scheduled_date: "2026-11-16",
    priority: "NORMAL",
    context: null,
    reference: null,
    note: null,
    reminder_time: "09:01",
  });
  await page.reload();

  await page.clock.runFor(60_000);
  const firstReminder = page.getByText(
    "Reminder: Timed reminder",
    { exact: true },
  );
  await expect(firstReminder).toBeVisible();
  await page
    .getByRole("button", { name: "Dismiss", exact: true })
    .click();
  await expect(firstReminder).toBeHidden();

  await page.clock.runFor(30_000);
  await expect(
    page.getByText("Reminder: Timed reminder", { exact: true }),
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
    page.getByText("Reminder: Timed reminder", { exact: true }),
  ).toBeVisible();

  const deliveredKeys = await page.evaluate(() =>
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
    scheduled_date: "2026-11-16",
    priority: "NORMAL",
    context: null,
    reference: null,
    note: null,
    reminder_time: "08:59",
  });
  await apiCommand(page, {
    type: "create",
    title: "Completed reminder",
    scheduled_date: "2026-11-16",
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