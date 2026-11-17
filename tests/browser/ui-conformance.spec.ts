import { expect, test } from "@playwright/test";
import {
  apiCommand,
  apiState,
  browserCivilDate,
  resetCanonicalTasks,
} from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await resetCanonicalTasks(page);
  await page.reload();
});

test("desktop shell uses the governed rail and Day is the initial destination", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });

  await expect(page.locator(".jig-sidebar")).toBeVisible();
  await expect(page.locator(".jig-topbar")).toHaveCount(0);
  for (const destination of ["Week", "Day", "History", "Settings"]) {
    await expect(
      page.locator(".jig-sidebar").getByRole("button", {
        name: destination,
        exact: true,
      }),
    ).toBeVisible();
  }
  await expect(
    page.locator(".jig-sidebar").getByRole("button", {
      name: "Day",
      exact: true,
    }),
  ).toHaveAttribute("aria-current", "page");
});

test("Week fits seven visible columns at the canonical desktop viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("button", { name: "Week", exact: true }).click();

  const board = page.locator(".jig-week-board");
  await expect(board).toBeVisible();
  await expect(board.locator(".jig-week-column")).toHaveCount(7);

  const geometry = await board.evaluate((element) => {
    const boardRect = element.getBoundingClientRect();
    const columns = [...element.querySelectorAll(".jig-week-column")];
    return {
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
      visible: columns.every((column) => {
        const rect = column.getBoundingClientRect();
        return (
          rect.left >= boardRect.left - 1 &&
          rect.right <= boardRect.right + 1
        );
      }),
    };
  });

  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
  expect(geometry.visible).toBe(true);
});

test("Task cards expose content, grip and one overflow affordance without action words", async ({
  page,
}) => {
  const today = await browserCivilDate(page);
  await apiCommand(page, {
    type: "create",
    title: "Card interaction contract",
    scheduled_date: today,
    priority: "HIGH",
    context: "Planning",
    reference: null,
    note: null,
    reminder_time: null,
  });
  await page.reload();

  const card = page
    .getByText("Card interaction contract", { exact: true })
    .locator("xpath=ancestor::li[contains(@class,'jig-task-card')][1]");
  await expect(card).toBeVisible();
  await expect(card.getByText("≡", { exact: true })).toBeVisible();
  await expect(
    card.getByRole("button", { name: "Actions for Card interaction contract" }),
  ).toBeVisible();

  await expect(card.getByText("Drag", { exact: true })).toBeHidden();
  await expect(
    card.getByRole("button", { name: "Edit", exact: true }),
  ).toBeHidden();
  await expect(
    card.getByRole("button", { name: "Move up", exact: true }),
  ).toBeHidden();
  await expect(
    card.getByRole("button", { name: "Move down", exact: true }),
  ).toBeHidden();

  await card
    .getByRole("button", {
      name: "Actions for Card interaction contract",
    })
    .click();
  await expect(
    card.getByRole("button", { name: "Edit", exact: true }),
  ).toBeVisible();
});

test("Day renders one canonical Attention sequence and a desktop inspector", async ({
  page,
}) => {
  const today = await browserCivilDate(page);
  await apiCommand(page, {
    type: "create",
    title: "Inspector contract",
    scheduled_date: today,
    priority: "NORMAL",
    context: "Legal",
    reference: "https://example.com/context",
    note: "Review the exact wording.",
    reminder_time: "16:00",
  });
  await page.reload();
  await page.setViewportSize({ width: 1440, height: 900 });

  await expect(
    page.getByRole("heading", { name: "Attention", exact: true }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("heading", { name: "Carried over", exact: true }),
  ).toHaveCount(0);

  const card = page
    .getByText("Inspector contract", { exact: true })
    .locator("xpath=ancestor::li[contains(@class,'jig-task-card')][1]");
  await card.click();

  const inspector = page.getByRole("complementary", {
    name: "Task details for Inspector contract",
  });
  await expect(inspector).toBeVisible();
  await expect(inspector.getByText("Legal", { exact: true })).toBeVisible();
  await expect(inspector.getByText("Review the exact wording.")).toBeVisible();
  await expect(
    inspector.getByRole("button", { name: "Edit", exact: true }),
  ).toBeVisible();
});

test("History exposes canonical scheduled date and actual completion time", async ({
  page,
}) => {
  const today = await browserCivilDate(page);
  await apiCommand(page, {
    type: "create",
    title: "History semantics",
    scheduled_date: today,
    priority: "NORMAL",
    context: "Ops",
    reference: null,
    note: null,
    reminder_time: null,
  });
  const created = (await apiState(page)).tasks.find(
    (task) => task.title === "History semantics",
  );
  if (created === undefined) {
    throw new Error("created Task missing");
  }
  await apiCommand(page, {
    type: "complete",
    task_id: created.id,
  });
  await page.reload();
  await page.getByRole("button", { name: "History", exact: true }).click();

  const row = page
    .getByText("History semantics", { exact: true })
    .locator("xpath=ancestor::li[1]");
  await expect(row.getByText(/Scheduled /)).toBeVisible();
  await expect(row.locator("time")).not.toHaveText("");
});

test("narrow shell keeps all destinations reachable and the seven-date strip fits", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });

  await expect(page.locator(".jig-sidebar")).toBeHidden();
  await expect(page.locator(".jig-mobile-header")).toBeVisible();

  const destination = page.locator(".jig-mobile-destination-menu");
  await destination.locator("summary").click();
  for (const label of ["Week", "Day", "History", "Settings"]) {
    await expect(
      destination.getByRole("button", { name: label, exact: true }),
    ).toBeVisible();
  }
  await destination.locator("summary").click();

  const strip = page.locator(".jig-week-strip");
  await expect(strip.locator(".jig-week-strip-date")).toHaveCount(7);
  const geometry = await strip.evaluate((element) => ({
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
  }));
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
  await expect(
    page.getByRole("button", { name: "Add task", exact: true }),
  ).toBeVisible();
});

test("Settings exposes product diagnostics without Git-management workflow", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Settings", exact: true }).click();

  for (const heading of [
    "Appearance",
    "Planning data",
    "Synchronization",
    "Diagnostics",
  ]) {
    await expect(
      page.getByRole("heading", { name: heading, exact: true }),
    ).toBeVisible();
  }

  const body = await page.locator("body").innerText();
  for (const forbidden of [
    "Migrate",
    "Git worktree",
    "Remote origin",
    "branch/ref",
  ]) {
    expect(body).not.toContain(forbidden);
  }
});
