import { expect, test } from "@playwright/test";
import {
  apiCommand,
  apiState,
  resetCanonicalTasks,
} from "./helpers";

function nearMidnight(): Date {
  const start = new Date();
  start.setHours(23, 59, 30, 0);
  return start;
}

function civilDate(date: Date): string {
  return [
    date.getFullYear().toString().padStart(4, "0"),
    (date.getMonth() + 1).toString().padStart(2, "0"),
    date.getDate().toString().padStart(2, "0"),
  ].join("-");
}

function tomorrow(date: Date): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + 1);
  return next;
}

test("already-open browser refreshes canonical state across local midnight", async ({
  page,
}) => {
  const start = nearMidnight();
  const today = civilDate(start);
  const nextDay = civilDate(tomorrow(start));
  await page.clock.install({ time: start });
  await page.goto("/");
  await resetCanonicalTasks(page);

  await apiCommand(page, {
    type: "create",
    title: "Midnight continuity",
    scheduled_date: today,
    priority: "NORMAL",
    context: null,
    reference: null,
    note: null,
    reminder_time: null,
  });
  await page.reload();

  const task = (await apiState(page)).tasks.find(
    (candidate) => candidate.title === "Midnight continuity",
  );
  if (task === undefined) {
    throw new Error("Task missing");
  }

  await apiCommand(page, {
    type: "move",
    task_id: task.id,
    destination_date: nextDay,
    destination_index: 0,
  });

  await expect(
    page
      .locator(".jig-task-card")
      .filter({ hasText: "Midnight continuity" })
      .first(),
  ).toBeVisible();

  await page.clock.fastForward(60_000);

  await expect
    .poll(async () => {
      const heading = page.locator(".jig-day-desktop-heading h1");
      return heading.textContent();
    })
    .toContain(
      new Intl.DateTimeFormat("en-US", {
        month: "long",
        day: "numeric",
      }).format(tomorrow(start)),
    );

  await expect(
    page
      .locator(".jig-task-card")
      .filter({ hasText: "Midnight continuity" })
      .first(),
  ).toBeVisible();
});

test("local midnight refresh preserves an explicitly selected non-today date", async ({
  page,
}) => {
  const start = nearMidnight();
  await page.clock.install({ time: start });
  await page.goto("/");
  await resetCanonicalTasks(page);
  await page.reload();

  await page.locator('.jig-week-strip-date').first().click();
  const selectedBefore = await page
    .locator('.jig-week-strip-date[aria-current="date"]')
    .textContent();

  await page.clock.fastForward(60_000);

  await expect
    .poll(() =>
      page.locator('.jig-week-strip-date[aria-current="date"]').textContent(),
    )
    .toBe(selectedBefore);
});
