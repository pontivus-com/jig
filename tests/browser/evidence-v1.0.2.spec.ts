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

  const completed = await apiCommand(page, {
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
  const button = page.locator(`.jig-week-strip-date`).filter({
    has: page.locator("strong", {
      hasText: String(Number(date.slice(-2))),
    }),
  });
  if (await button.count()) {
    await button.first().click();
  }
}

async function setTheme(page: Page, theme: "light" | "dark"): Promise<void> {
  await page.evaluate((value) => localStorage.setItem("jig-theme", value), theme);
  await page.reload();
}

test("capture v1.0.2 reference screens", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const { selected } = await createReferenceData(page);
  await setTheme(page, "light");

  await page.getByRole("button", { name: "Week", exact: true }).click();
  const weekDate = page.locator(`[data-date="${selected}"] .jig-date-heading-button`);
  if (await weekDate.count()) {
    await weekDate.click();
  }
  await expect(page.locator(".jig-week-board")).toBeVisible();
  await page.screenshot({
    path: `${EVIDENCE}/desktop-week-light.jpg`,
    type: "jpeg",
    quality: 92,
    fullPage: false,
  });

  await page.getByRole("button", { name: "Day", exact: true }).click();
  await chooseDate(page, selected);
  await expect(page.getByRole("heading", { name: "Attention", exact: true })).toBeVisible();
  await page.screenshot({
    path: `${EVIDENCE}/desktop-day-light.jpg`,
    type: "jpeg",
    quality: 92,
    fullPage: false,
  });

  await page.getByRole("button", { name: "History", exact: true }).click();
  await expect(page.getByRole("heading", { name: "History", exact: true })).toBeVisible();
  await page.screenshot({
    path: `${EVIDENCE}/desktop-history-light.jpg`,
    type: "jpeg",
    quality: 92,
    fullPage: false,
  });

  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
  await page.screenshot({
    path: `${EVIDENCE}/desktop-settings-light.jpg`,
    type: "jpeg",
    quality: 92,
    fullPage: false,
  });

  await setTheme(page, "dark");
  await page.getByRole("button", { name: "Week", exact: true }).click();
  await page.screenshot({
    path: `${EVIDENCE}/desktop-week-dark.jpg`,
    type: "jpeg",
    quality: 92,
    fullPage: false,
  });

  await setTheme(page, "light");
  await page.setViewportSize({ width: 414, height: 900 });
  await page.getByRole("button", { name: "Day", exact: true }).click();
  await chooseDate(page, selected);
  await page.screenshot({
    path: `${EVIDENCE}/mobile-day-light.jpg`,
    type: "jpeg",
    quality: 92,
    fullPage: false,
  });

  await page.setViewportSize({ width: 414, height: 980 });
  const title = page.getByText("Legal — TTA workflow remediation", {
    exact: true,
  });
  const card = title.locator("xpath=ancestor::li[contains(@class,'jig-task-card')][1]");
  await card.getByRole("button", {
    name: "Actions for Legal — TTA workflow remediation",
  }).click();
  await card.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.screenshot({
    path: `${EVIDENCE}/mobile-editor-light.jpg`,
    type: "jpeg",
    quality: 92,
    fullPage: false,
  });
});
