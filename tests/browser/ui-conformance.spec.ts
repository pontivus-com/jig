import {
  expect,
  test,
  type Page,
} from "@playwright/test";
import {
  apiCommand,
  browserCivilDate,
  resetCanonicalTasks,
} from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await resetCanonicalTasks(page);
  await page.reload();
});

async function createTask(
  page: Page,
  title: string,
  options: Readonly<{
    date?: string;
    context?: string | null;
    priority?: "HIGH" | "NORMAL" | "LOW";
    reminder?: string | null;
    reference?: string | null;
    note?: string | null;
  }> = {},
): Promise<void> {
  const date = options.date ?? (await browserCivilDate(page));
  await apiCommand(page, {
    type: "create",
    title,
    scheduled_date: date,
    priority: options.priority ?? "NORMAL",
    context: options.context ?? null,
    reference: options.reference ?? null,
    note: options.note ?? null,
    reminder_time: options.reminder ?? null,
  });
}

function taskCard(page: Page, title: string) {
  return page
    .getByText(title, { exact: true })
    .locator("xpath=ancestor::li[contains(@class,'jig-task-card')][1]");
}

test("desktop uses the governed left rail and Day is the initial surface", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.reload();

  await expect(page.locator(".jig-sidebar")).toBeVisible();
  await expect(page.locator(".jig-topbar")).toHaveCount(0);
  for (const label of ["Week", "Day", "History", "Settings"]) {
    await expect(
      page
        .locator(".jig-sidebar")
        .getByRole("button", { name: label, exact: true }),
    ).toBeVisible();
  }
  await expect(
    page
      .locator(".jig-sidebar")
      .getByRole("button", { name: "Day", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { name: "Attention", exact: false }))
    .toBeVisible();
});

test("Week fits all seven scheduled-date buckets at the reference desktop viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.reload();
  await page.getByRole("button", { name: "Week", exact: true }).click();

  const board = page.locator(".jig-week-board");
  const columns = page.locator(".jig-week-column");
  await expect(columns).toHaveCount(7);

  const geometry = await board.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    left: element.getBoundingClientRect().left,
    right: element.getBoundingClientRect().right,
  }));
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);

  for (let index = 0; index < 7; index += 1) {
    const box = await columns.nth(index).boundingBox();
    expect(box).not.toBeNull();
    if (box !== null) {
      expect(box.x).toBeGreaterThanOrEqual(geometry.left - 1);
      expect(box.x + box.width).toBeLessThanOrEqual(geometry.right + 1);
    }
  }
});

test("Task cards expose content, whole-card drag affordance and one hidden action menu", async ({
  page,
}) => {
  await createTask(page, "Card contract", {
    context: "Legal",
    priority: "HIGH",
    reminder: "14:30",
  });
  await page.reload();

  const card = taskCard(page, "Card contract");
  await expect(card).toBeVisible();
  await expect(card).toContainText("Legal");
  await expect(card).toContainText("high");
  await expect(card).toContainText(/2:30|14:30/);
  await expect(card.locator(".jig-task-drag-handle")).toHaveText("≡");
  await expect(
    card.locator('summary[aria-label="Actions for Card contract"]'),
  ).toHaveText("•••");

  await expect(
    card.getByRole("button", { name: "Edit", exact: true }),
  ).toBeHidden();
  await expect(card.getByText("Drag", { exact: true })).toHaveCount(0);
  await expect(card.getByText("Move…", { exact: true })).toHaveCount(0);
  await expect(card.getByText("Up", { exact: true })).toHaveCount(0);
  await expect(card.getByText("Down", { exact: true })).toHaveCount(0);
});

test("Day has one canonical Attention sequence and a desktop Task inspector", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await createTask(page, "Inspectable task", {
    context: "Client",
    priority: "LOW",
    reminder: "16:00",
    reference: "https://example.com/context",
    note: "Review before close.",
  });
  await page.reload();

  await expect(
    page.getByRole("heading", { name: /Attention/ }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("heading", { name: "Carried over", exact: true }),
  ).toHaveCount(0);

  const inspector = page.locator(
    'aside[aria-label="Details for Inspectable task"]',
  );
  await expect(inspector).toBeVisible();
  await expect(inspector).toContainText("Context");
  await expect(inspector).toContainText("Client");
  await expect(inspector).toContainText("Priority");
  await expect(inspector).toContainText("low");
  await expect(inspector).toContainText("Reminder");
  await expect(inspector).toContainText("Reference");
  await expect(inspector).toContainText("Notes");
});

test("History exposes canonical scheduled date and actual completion time", async ({
  page,
}) => {
  const today = await browserCivilDate(page);
  await createTask(page, "History semantics", { date: today });
  const state = await page.evaluate(async () =>
    fetch("/api/v1/tasks").then((response) => response.json()),
  ) as { tasks: Array<{ id: string; title: string }> };
  const task = state.tasks.find((candidate) => candidate.title === "History semantics");
  if (task === undefined) {
    throw new Error("History task missing");
  }
  await apiCommand(page, { type: "complete", task_id: task.id });
  await page.reload();

  await page.getByRole("button", { name: "History", exact: true }).click();
  const row = page
    .getByText("History semantics", { exact: true })
    .locator("xpath=ancestor::div[contains(@class,'jig-history-task-row')][1]");
  await expect(row).toBeVisible();
  await expect(row).toContainText("Scheduled");
  await expect(row).toContainText(
    new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      day: "numeric",
    }).format(new Date(`${today}T12:00:00`)),
  );
  await expect(row.locator("time")).not.toHaveText("");
});

test("Settings exposes only Jig-owned operational concepts", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Settings", exact: true }).click();

  await expect(page.getByRole("heading", { name: "Appearance" })).toBeVisible();
  await expect(page.getByText("Browser notifications", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Planning data" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Synchronization" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Diagnostics" })).toBeVisible();

  const body = await page.locator("body").innerText();
  expect(body).not.toMatch(/Migrate/i);
  expect(body).not.toMatch(/worktree/i);
  expect(body).not.toMatch(/Remote origin/i);
  expect(body).not.toMatch(/branch\/ref/i);
});

test("narrow layout uses one compact app header, seven visible dates and persistent Quick Add", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();

  await expect(page.locator(".jig-sidebar")).toHaveCount(0);
  await expect(page.locator(".jig-mobile-header")).toBeVisible();
  await expect(page.locator(".jig-mobile-destination-menu > summary")).toHaveText("Day");

  const strip = page.locator(".jig-week-strip");
  await expect(page.locator(".jig-week-strip-date")).toHaveCount(7);
  const stripSize = await strip.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(stripSize.scrollWidth).toBeLessThanOrEqual(stripSize.clientWidth + 1);

  await expect(
    page.locator(".jig-mobile-quick-add").getByRole("button", {
      name: "Add task",
      exact: true,
    }),
  ).toBeVisible();

  await page.locator(".jig-mobile-destination-menu > summary").click();
  for (const label of ["Week", "Day", "History", "Settings"]) {
    await expect(
      page
        .locator(".jig-mobile-destination-panel")
        .getByRole("button", { name: label, exact: true }),
    ).toBeVisible();
  }
});
