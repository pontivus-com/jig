import { expect, test, type Page } from "@playwright/test";
import {
  apiCommand,
  apiState,
  browserCivilDate,
  resetCanonicalTasks,
} from "./helpers";

test.skip(
  process.env.JIG_CAPTURE_EVIDENCE !== "1",
  "temporary v1.0.3 evidence capture",
);

const EVIDENCE = "docs/evidence/v1.0.3/browser";

async function capture(page: Page, name: string): Promise<void> {
  await page.screenshot({
    path: `${EVIDENCE}/${name}.jpg`,
    type: "jpeg",
    quality: 72,
    fullPage: false,
  });
}

async function create(
  page: Page,
  title: string,
  date: string,
  options: Readonly<{
    priority?: "HIGH" | "NORMAL" | "LOW";
    context?: string | null;
    note?: string | null;
    reminder?: string | null;
  }> = {},
): Promise<void> {
  await apiCommand(page, {
    type: "create",
    title,
    scheduled_date: date,
    priority: options.priority ?? "NORMAL",
    context: options.context ?? null,
    reference: null,
    note: options.note ?? null,
    reminder_time: options.reminder ?? null,
  });
}

async function setTheme(page: Page, value: "light" | "dark"): Promise<void> {
  await page.evaluate((theme) => {
    window.localStorage.setItem("jig-theme", theme);
  }, value);
  await page.reload();
  await page.waitForTimeout(150);
}

async function closeWorkspace(page: Page): Promise<void> {
  const dialog = page.getByRole("dialog").first();
  if (!(await dialog.isVisible())) {
    return;
  }
  const close = dialog.getByRole("button", { name: "Close" });
  if (await close.isVisible()) {
    await close.click();
    await expect(dialog).toBeHidden();
  } else {
    await page.keyboard.press("Escape");
  }
}

test("capture finalized v1.0.3 single Planner evidence", async ({ page }) => {
  await page.goto("/");
  await resetCanonicalTasks(page);

  const today = await browserCivilDate(page);
  const tomorrow = await browserCivilDate(page, 1);
  const plusTwo = await browserCivilDate(page, 2);
  const plusThree = await browserCivilDate(page, 3);
  const plusFour = await browserCivilDate(page, 4);

  await create(page, "Finalize TTA remediation", today, {
    priority: "HIGH",
    context: "Legal",
    note: "Review the final implementation evidence.",
    reminder: "10:00",
  });
  await create(page, "Review Order lifecycle changes", today, {
    context: "Order",
    reminder: "14:00",
  });
  await create(page, "Validate SPAN documentation", tomorrow, {
    priority: "LOW",
    context: "SPAN",
  });
  await create(page, "Prepare customer review", plusTwo, {
    priority: "HIGH",
    context: "Customer",
  });
  await create(page, "Plan follow-up work", plusThree, {
    context: "Planning",
  });
  await create(page, "Weekly review", plusFour, {
    context: "Planning",
  });
  await create(page, "Completed implementation check", today, {
    priority: "HIGH",
    context: "Jig",
  });

  const completed = (await apiState(page)).tasks.find(
    (task) => task.title === "Completed implementation check",
  );
  if (completed === undefined) throw new Error("completed fixture missing");
  await apiCommand(page, { type: "complete", task_id: completed.id });

  await page.setViewportSize({ width: 1440, height: 900 });
  await setTheme(page, "light");
  await expect(page.locator(".jig-week-column")).toHaveCount(7);
  await capture(page, "desktop-planner-light");

  await setTheme(page, "dark");
  await expect(page.locator(".jig-week-column")).toHaveCount(7);
  await capture(page, "desktop-planner-dark");

  await setTheme(page, "light");
  const task = page.getByText("Finalize TTA remediation", { exact: true });
  await task.click();
  const drawer = page.getByRole("dialog", { name: "Finalize TTA remediation" });
  await expect(drawer).toBeVisible();
  await page.waitForTimeout(350);
  await capture(page, "desktop-planner-task-drawer");

  await drawer.getByRole("button", { name: "Edit", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Edit task" });
  await expect(editor).toBeVisible();
  await page.waitForTimeout(200);
  await capture(page, "desktop-planner-edit");
  await closeWorkspace(page);

  await page.getByRole("button", { name: "History", exact: true }).click();
  await expect(page.getByRole("heading", { name: "History", exact: true })).toBeVisible();
  await capture(page, "desktop-history");

  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
  await capture(page, "desktop-settings");

  await page.getByRole("button", { name: "Planner home" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".jig-week-strip-date")).toHaveCount(7);
  await capture(page, "mobile-planner");

  await page.getByText("Finalize TTA remediation", { exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Finalize TTA remediation" }),
  ).toBeVisible();
  await page.waitForTimeout(350);
  await capture(page, "mobile-task-bottom-sheet");
  await closeWorkspace(page);

  await page.setViewportSize({ width: 1440, height: 900 });
  const realStatus = await page.evaluate(async () =>
    fetch("/api/v1/status").then((response) => response.json()),
  );
  await page.route("**/api/v1/status", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ...realStatus,
        repository_status: "sync-issue",
      }),
    });
  });
  await page.reload();
  await expect(
    page.getByText("Repository synchronization issue", { exact: true }),
  ).toBeVisible();
  await capture(page, "sync-issue");
  await page.unroute("**/api/v1/status");
  await page.reload();
  await expect(
    page.getByText("Repository synchronization issue", { exact: true }),
  ).toHaveCount(0);

  await page.getByRole("button", { name: "Planner home" }).click();
  await page.route("**/api/v1/commands", async (route) => {
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: "Simulated local save failure" }),
    });
  });
  await page
    .locator(".jig-header-right")
    .getByRole("button", { name: "Add task", exact: true })
    .click();
  const add = page.getByRole("dialog", { name: "Add task" });
  await add.getByLabel("Title").fill("Unsaved evidence task");
  await add.getByRole("button", { name: "Add task", exact: true }).click();
  await expect(
    add.getByText("Simulated local save failure", { exact: true }),
  ).toBeVisible();
  await page.waitForTimeout(150);
  await capture(page, "local-save-failure");
  await page.unroute("**/api/v1/commands");
});
