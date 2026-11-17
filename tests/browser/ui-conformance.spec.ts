import { expect, test, type Page } from "@playwright/test";
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

function expectNear(actual: number, expected: number, tolerance = 3): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

async function createTask(
  page: Page,
  title: string,
  date: string,
  priority: "HIGH" | "NORMAL" | "LOW" = "NORMAL",
): Promise<void> {
  await apiCommand(page, {
    type: "create",
    title,
    scheduled_date: date,
    priority,
    context: null,
    reference: null,
    note: null,
    reminder_time: null,
  });
}

test("desktop opens on the single Planner with no sidebar", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });

  await expect(page.locator(".jig-primary-nav")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Planner home" })).toBeVisible();
  await expect(page.getByRole("button", { name: "History", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Settings", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add task", exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Previous week" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Today", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Next week" })).toBeVisible();
  await expect(page.locator(".jig-week-column")).toHaveCount(7);
  await expect(page.getByRole("main")).toHaveCount(1);
  await expect(page.getByText("Week of", { exact: false })).toHaveCount(0);
  await expect(page.getByText("Selected date view", { exact: false })).toHaveCount(0);
});

test("desktop temporal centerpiece is page-centered with range above controls", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });

  const center = page.locator(".jig-header-center");
  const range = page.locator(".jig-header-week-range");
  const controls = page.locator(".jig-header-week-controls");
  await expect(center).toBeVisible();
  await expect(range).toBeVisible();
  await expect(controls).toBeVisible();

  const centerBox = await center.boundingBox();
  const rangeBox = await range.boundingBox();
  const controlsBox = await controls.boundingBox();
  expect(centerBox).not.toBeNull();
  expect(rangeBox).not.toBeNull();
  expect(controlsBox).not.toBeNull();
  if (centerBox !== null && rangeBox !== null && controlsBox !== null) {
    expectNear(centerBox.x + centerBox.width / 2, 720, 4);
    expect(rangeBox.y).toBeLessThan(controlsBox.y);
  }

  const selectedBefore = await page
    .locator('.jig-date-heading-button[aria-current="date"]')
    .getAttribute("aria-label");
  const rangeBefore = await range.textContent();

  await page.getByRole("button", { name: "Next week" }).click();
  const selectedAfter = await page
    .locator('.jig-date-heading-button[aria-current="date"]')
    .getAttribute("aria-label");
  const rangeAfter = await range.textContent();
  expect(selectedAfter).not.toBe(selectedBefore);
  expect(rangeAfter).not.toBe(rangeBefore);

  await page.getByRole("button", { name: "Today", exact: true }).click();
  await expect(range).toHaveText(rangeBefore ?? "");
});

test("desktop Planner uses seven fluid columns without horizontal board scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 1216, height: 900 });

  const thresholdBoard = page.locator(".jig-week-board");
  await expect(thresholdBoard.locator(".jig-week-column")).toHaveCount(7);
  const thresholdGeometry = await thresholdBoard.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    widths: [...element.querySelectorAll<HTMLElement>(".jig-week-column")].map(
      (column) => column.getBoundingClientRect().width,
    ),
  }));
  expect(thresholdGeometry.scrollWidth).toBeLessThanOrEqual(
    thresholdGeometry.clientWidth + 1,
  );
  for (const width of thresholdGeometry.widths) {
    expect(width).toBeGreaterThanOrEqual(160);
  }

  await page.setViewportSize({ width: 1440, height: 900 });

  const board = page.locator(".jig-week-board");
  const columns = board.locator(".jig-week-column");
  await expect(columns).toHaveCount(7);

  const geometry = await board.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    widths: [...element.querySelectorAll<HTMLElement>(".jig-week-column")].map(
      (column) => column.getBoundingClientRect().width,
    ),
  }));

  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
  for (const width of geometry.widths) {
    expect(width).toBeGreaterThanOrEqual(160);
  }

  await page.setViewportSize({ width: 1920, height: 900 });
  const wideFirst = await columns.first().boundingBox();
  expect(wideFirst).not.toBeNull();
  if (wideFirst !== null) {
    expect(wideFirst.width).toBeGreaterThan(220);
  }
});

test("Task selection opens a right Drawer without moving or narrowing the Planner", async ({ page }) => {
  const today = await browserCivilDate(page);
  await createTask(page, "Drawer contract task", today);
  await page.reload();
  await page.setViewportSize({ width: 1440, height: 900 });

  const board = page.locator(".jig-week-board");
  const before = await board.boundingBox();
  const task = page.getByText("Drawer contract task", { exact: true });
  await task.click();

  const drawer = page.getByRole("dialog", { name: "Drawer contract task" });
  await expect(drawer).toBeVisible();
  const after = await board.boundingBox();
  expect(before).not.toBeNull();
  expect(after).not.toBeNull();
  if (before !== null && after !== null) {
    expectNear(after.width, before.width, 1);
  }

  expect((await apiState(page)).tasks.find((item) => item.title === "Drawer contract task")?.scheduled_date)
    .toBe(today);
});

test("global Add task uses the selected date and initially asks only for title", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const selectedDate = await browserCivilDate(page);

  await page.getByRole("button", { name: "Add task", exact: true }).first().click();
  const drawer = page.getByRole("dialog", { name: "Add task" });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByLabel("Title")).toBeVisible();
  await expect(drawer.getByLabel("Date")).toHaveCount(0);
  await expect(drawer.getByLabel("Context")).toHaveCount(0);

  await drawer.getByLabel("Title").fill("Title-only create");
  await drawer.getByRole("button", { name: "Add task", exact: true }).click();

  const created = (await apiState(page)).tasks.find((task) => task.title === "Title-only create");
  expect(created?.scheduled_date).toBe(selectedDate);
});

test("History remains active while completed Task details use the same right workspace", async ({ page }) => {
  const today = await browserCivilDate(page);
  await createTask(page, "History detail contract", today);
  const created = (await apiState(page)).tasks.find((task) => task.title === "History detail contract");
  if (created === undefined) throw new Error("history fixture missing");
  await apiCommand(page, { type: "complete", task_id: created.id });
  await page.reload();

  await page.getByRole("button", { name: "History", exact: true }).click();
  await expect(page.getByRole("button", { name: "History", exact: true }))
    .toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("button", { name: "Previous week" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Add task", exact: true })).toHaveCount(0);

  await page.getByText("History detail contract", { exact: true }).click();
  await expect(page.getByRole("dialog", { name: "History detail contract" })).toBeVisible();
  await expect(page.getByRole("button", { name: "History", exact: true }))
    .toHaveAttribute("aria-current", "page");
});

test("narrow Planner uses hamburger popover, seven-date strip and BottomSheet", async ({ page }) => {
  const today = await browserCivilDate(page);
  await createTask(page, "Mobile workspace task", today);
  await page.reload();
  await page.setViewportSize({ width: 390, height: 844 });

  await expect(page.locator(".jig-week-board")).toHaveCount(0);
  await expect(page.locator(".jig-week-strip-date")).toHaveCount(7);
  await expect(page.getByRole("button", { name: "Open navigation menu" })).toBeVisible();

  await page.getByRole("button", { name: "Open navigation menu" }).click();
  await expect(page.getByRole("menuitem", { name: "History" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Settings" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Planner" })).toHaveCount(0);

  await page.getByText("Mobile workspace task", { exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Mobile workspace task" })).toBeVisible();
  await expect(page.locator(".jig-week-strip-date")).toHaveCount(7);
});

test("responsive reflow preserves Planner selection and unsaved workspace draft", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });

  const visibleDates = page.locator(".jig-date-heading-button");
  await visibleDates.nth(3).click();
  const selectedBefore = await page
    .locator('.jig-date-heading-button[aria-current="date"]')
    .getAttribute("aria-label");
  const rangeBefore = await page.locator(".jig-header-week-range").textContent();

  await page.getByRole("button", { name: "Add task", exact: true }).first().click();
  const drawer = page.getByRole("dialog", { name: "Add task" });
  await drawer.getByLabel("Title").fill("Draft survives layout");

  await page.setViewportSize({ width: 1215, height: 900 });
  const sheet = page.getByRole("dialog", { name: "Add task" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByLabel("Title")).toHaveValue("Draft survives layout");
  await expect(page.locator(".jig-header-week-range")).toHaveText(rangeBefore ?? "");
  await expect(page.locator(".jig-week-strip-date[aria-current='date']")).toHaveAttribute(
    "aria-label",
    selectedBefore ?? "",
  );

  await page.setViewportSize({ width: 1216, height: 900 });
  await expect(page.getByRole("dialog", { name: "Add task" }).getByLabel("Title"))
    .toHaveValue("Draft survives layout");
});

test("Task cards expose restrained priority classes without replacing text semantics", async ({ page }) => {
  const today = await browserCivilDate(page);
  await createTask(page, "High priority card", today, "HIGH");
  await createTask(page, "Normal priority card", today, "NORMAL");
  await createTask(page, "Low priority card", today, "LOW");
  await page.reload();

  const high = page.getByText("High priority card", { exact: true }).locator("xpath=ancestor::li[1]");
  const normal = page.getByText("Normal priority card", { exact: true }).locator("xpath=ancestor::li[1]");
  const low = page.getByText("Low priority card", { exact: true }).locator("xpath=ancestor::li[1]");

  await expect(high).toHaveClass(/jig-task-priority-high/);
  await expect(normal).toHaveClass(/jig-task-priority-normal/);
  await expect(low).toHaveClass(/jig-task-priority-low/);
  await expect(high.getByText("high", { exact: true })).toBeVisible();
  await expect(low.getByText("low", { exact: true })).toBeVisible();

  await high.click();
  const detail = page.getByRole("dialog", { name: "High priority card" });
  await expect(detail.locator(".jig-priority-high")).toHaveText("high");
  await detail.getByRole("button", { name: "✓ Mark complete", exact: true }).click();

  await page.getByRole("button", { name: "History", exact: true }).click();
  const historyRow = page
    .getByText("High priority card", { exact: true })
    .locator("xpath=ancestor::li[1]");
  await expect(historyRow).toHaveClass(/jig-task-priority-high/);
});

test("Settings remains a secondary destination without Planner temporal controls", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("button", { name: "Settings", exact: true }).click();

  await expect(page.getByRole("button", { name: "Settings", exact: true }))
    .toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Previous week" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Today", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Add task", exact: true })).toHaveCount(0);
  await expect(page.getByText("Git migration", { exact: false })).toHaveCount(0);
  await expect(page.getByText("branch", { exact: true })).toHaveCount(0);
});
