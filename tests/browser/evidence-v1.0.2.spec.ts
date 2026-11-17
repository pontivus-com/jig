import { expect, test, type Page } from "@playwright/test";
import {
  apiCommand,
  apiState,
  browserCivilDate,
  resetCanonicalTasks,
} from "./helpers";

const EVIDENCE = "docs/evidence/v1.0.2/browser";

async function createReferenceData(page: Page): Promise<{
  today: string;
  selected: string;
}> {
  await resetCanonicalTasks(page);
  const today = await browserCivilDate(page);
  const selected = await browserCivilDate(page, 2);
  const next = await browserCivilDate(page, 3);

  const tasks = [
    ["Legal — TTA workflow remediation", selected, "HIGH", "Legal App", "10:00"],
    ["Review Order lifecycle changes", selected, "NORMAL", "Order", "14:00"],
    ["SPAN docs validation", selected, "LOW", "SPAN", null],
    ["Plan tomorrow", selected, "NORMAL", "Planning", "17:00"],
    ["Review product plan", today, "NORMAL", "Legal", null],
    ["Update release notes", today, "NORMAL", "Order", null],
    ["Review outstanding fixes", next, "NORMAL", "Legal", null],
  ] as const;

  for (const [title, scheduled_date, priority, context, reminder_time] of tasks) {
    await apiCommand(page, {
      type: "create",
      title,
      scheduled_date,
      priority,
      context,
      reference: title.startsWith("Legal")
        ? "https://github.com/pontivus-com/jig"
        : null,
      note: title.startsWith("Legal")
        ? "Details remain in the authoritative project."
        : null,
      reminder_time,
    });
  }

  await apiCommand(page, {
    type: "create",
    title: "Daily standup",
    scheduled_date: selected,
    priority: "NORMAL",
    context: "Team",
    reference: null,
    note: null,
    reminder_time: null,
  });
  const completedTask = (await apiState(page)).tasks.find(
    (task) => task.title === "Daily standup",
  );
  if (completedTask === undefined) {
    throw new Error("Daily standup fixture missing");
  }
  await apiCommand(page, {
    type: "complete",
    task_id: completedTask.id,
  });

  await page.reload();
  return { today, selected };
}

async function chooseDate(page: Page, date: string): Promise<void> {
  const day = String(Number(date.slice(-2)));
  const button = page.locator(".jig-week-strip-date").filter({
    has: page.locator("strong", { hasText: new RegExp(`^${day}$`) }),
  });
  await expect(button.first()).toBeVisible();
  await button.first().click();
}

async function navigateTo(
  page: Page,
  destination: "Week" | "Day" | "History" | "Settings",
): Promise<void> {
  const desktop = page
    .locator(".jig-sidebar")
    .getByRole("button", { name: destination, exact: true });
  if (await desktop.isVisible()) {
    await desktop.click();
    return;
  }

  const menu = page.locator(".jig-mobile-destination-menu");
  await menu.locator("summary").click();
  await menu
    .getByRole("button", { name: destination, exact: true })
    .click();
}

async function setTheme(page: Page, theme: "light" | "dark"): Promise<void> {
  await page.evaluate((value) => localStorage.setItem("jig-theme", value), theme);
  await page.reload();
}

async function prepare(
  page: Page,
  viewport: { width: number; height: number },
  theme: "light" | "dark" = "light",
): Promise<{ today: string; selected: string }> {
  await page.setViewportSize(viewport);
  await page.goto("/");
  const fixture = await createReferenceData(page);
  await setTheme(page, theme);
  return fixture;
}

test("capture desktop Week light", async ({ page }) => {
  const { selected } = await prepare(page, { width: 1440, height: 900 });
  await navigateTo(page, "Week");
  const selectedColumn = page.locator(`[data-date="${selected}"]`);
  await selectedColumn.locator(".jig-date-heading-button").click();
  await expect(page.locator(".jig-week-board")).toBeVisible();
  await page.screenshot({
    path: `${EVIDENCE}/desktop-week-light.jpg`,
    type: "jpeg",
    quality: 92,
  });
});

test("capture desktop Day light", async ({ page }) => {
  const { selected } = await prepare(page, { width: 1440, height: 900 });
  await navigateTo(page, "Day");
  await chooseDate(page, selected);
  await expect(
    page.getByRole("heading", { name: "Attention", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: `${EVIDENCE}/desktop-day-light.jpg`,
    type: "jpeg",
    quality: 92,
  });
});

test("capture desktop History light", async ({ page }) => {
  await prepare(page, { width: 1440, height: 900 });
  await navigateTo(page, "History");
  await expect(
    page.getByRole("heading", { name: "History", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: `${EVIDENCE}/desktop-history-light.jpg`,
    type: "jpeg",
    quality: 92,
  });
});

test("capture desktop Settings light", async ({ page }) => {
  await prepare(page, { width: 1440, height: 900 });
  await navigateTo(page, "Settings");
  await expect(
    page.getByRole("heading", { name: "Settings", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: `${EVIDENCE}/desktop-settings-light.jpg`,
    type: "jpeg",
    quality: 92,
  });
});

test("capture desktop Week dark", async ({ page }) => {
  const { selected } = await prepare(
    page,
    { width: 1440, height: 900 },
    "dark",
  );
  await navigateTo(page, "Week");
  const selectedColumn = page.locator(`[data-date="${selected}"]`);
  await selectedColumn.locator(".jig-date-heading-button").click();
  await page.screenshot({
    path: `${EVIDENCE}/desktop-week-dark.jpg`,
    type: "jpeg",
    quality: 92,
  });
});

test("capture mobile Day light", async ({ page }) => {
  const { selected } = await prepare(page, { width: 414, height: 900 });
  await navigateTo(page, "Day");
  await chooseDate(page, selected);
  await page.screenshot({
    path: `${EVIDENCE}/mobile-day-light.jpg`,
    type: "jpeg",
    quality: 92,
  });
});

test("capture mobile editor light", async ({ page }) => {
  const { selected } = await prepare(page, { width: 414, height: 980 });
  await navigateTo(page, "Day");
  await chooseDate(page, selected);

  const card = page
    .getByText("Legal — TTA workflow remediation", { exact: true })
    .locator("xpath=ancestor::li[contains(@class,'jig-task-card')][1]");
  await card
    .getByRole("button", {
      name: "Actions for Legal — TTA workflow remediation",
    })
    .click();
  await card.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.screenshot({
    path: `${EVIDENCE}/mobile-editor-light.jpg`,
    type: "jpeg",
    quality: 92,
  });
});
