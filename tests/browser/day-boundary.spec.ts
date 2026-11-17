import { expect, test } from "@playwright/test";
import {
  apiCommand,
  apiState,
  resetCanonicalTasks,
} from "./helpers";

test("already-open browser refreshes canonical state across local midnight", async ({
  page,
}) => {
  await page.clock.install({
    time: new Date("2026-11-17T23:59:30"),
  });
  await page.goto("/");
  await resetCanonicalTasks(page);

  await apiCommand(page, {
    type: "create",
    title: "Midnight continuity",
    scheduled_date: "2026-11-17",
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
    destination_date: "2026-11-18",
    destination_index: 0,
  });

  await expect(
    page.getByText("Midnight continuity", { exact: true }),
  ).toBeVisible();

  await page.clock.fastForward(60_000);

  await expect
    .poll(async () => {
      const heading = page.locator(".jig-day-view .jig-view-heading h1");
      return heading.textContent();
    })
    .toContain("November 18");

  await expect(
    page.getByText("Midnight continuity", { exact: true }),
  ).toBeVisible();
});

test("local midnight refresh preserves an explicitly selected non-today date", async ({
  page,
}) => {
  await page.clock.install({
    time: new Date("2026-11-17T23:59:30"),
  });
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
