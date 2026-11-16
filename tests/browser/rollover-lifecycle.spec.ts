import {
  expect,
  test,
} from "@playwright/test";
import {
  apiCommand,
  apiState,
  browserCivilDate,
  resetCanonicalTasks,
} from "./helpers";

function previousDayNearMidnight(): Date {
  const now = new Date();
  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - 1,
    23,
    59,
    50,
    0,
  );
}

test("an already-open Day refreshes canonical rollover across local midnight", async ({
  page,
}) => {
  await page.clock.install({ time: previousDayNearMidnight() });
  await page.goto("/");
  await resetCanonicalTasks(page);
  const yesterday = await browserCivilDate(page);

  await apiCommand(page, {
    type: "create",
    title: "Midnight rollover",
    scheduled_date: yesterday,
    priority: "NORMAL",
    context: null,
    reference: null,
    note: null,
    reminder_time: null,
  });

  await expect(
    page.getByText("Midnight rollover", { exact: true }),
  ).toHaveCount(0);

  await page.clock.runFor(20_000);
  const today = await browserCivilDate(page);

  await expect(
    page
      .locator(".jig-task-card")
      .getByText("Midnight rollover", { exact: true }),
  ).toBeVisible();
  const task = (await apiState(page)).tasks.find(
    (candidate) => candidate.title === "Midnight rollover",
  );
  expect(task?.scheduled_date).toBe(today);

  await page.getByRole("button", { name: "Week", exact: true }).click();
  await expect(
    page
      .locator(`[data-date="${today}"]`)
      .getByText("Midnight rollover", { exact: true }),
  ).toBeVisible();
  if ((await page.locator(`[data-date="${yesterday}"]`).count()) > 0) {
    await expect(
      page
        .locator(`[data-date="${yesterday}"]`)
        .getByText("Midnight rollover", { exact: true }),
    ).toHaveCount(0);
  }
});

test("local midnight refresh preserves an explicitly selected non-today date", async ({
  page,
}) => {
  await page.clock.install({ time: previousDayNearMidnight() });
  await page.goto("/");
  await resetCanonicalTasks(page);

  await page.getByRole("button", { name: "Previous", exact: true }).click();
  const headingBefore = await page
    .locator(".jig-day-view h1")
    .innerText();

  await page.clock.runFor(20_000);

  await expect(page.locator(".jig-day-view h1")).toHaveText(headingBefore);
});

test("a rolled-forward reminder becomes eligible on the new scheduled date", async ({
  page,
}) => {
  await page.clock.install({ time: previousDayNearMidnight() });
  await page.goto("/");
  await resetCanonicalTasks(page);
  const yesterday = await browserCivilDate(page);

  await apiCommand(page, {
    type: "create",
    title: "Rollover reminder",
    scheduled_date: yesterday,
    priority: "NORMAL",
    context: null,
    reference: null,
    note: null,
    reminder_time: "00:01",
  });

  await page.clock.runFor(90_000);
  const today = await browserCivilDate(page);

  const task = (await apiState(page)).tasks.find(
    (candidate) => candidate.title === "Rollover reminder",
  );
  expect(task).toMatchObject({
    scheduled_date: today,
    reminder_time: "00:01",
  });
  await expect(
    page.getByRole("button", { name: "Dismiss", exact: true }),
  ).toBeVisible();
});
