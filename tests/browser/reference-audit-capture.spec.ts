import { test, expect, type Page } from "@playwright/test";
import {
  apiCommand,
  apiState,
  browserCivilDate,
  resetCanonicalTasks,
} from "./helpers";

async function syncNow(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const token = (
      window as typeof window & { __JIG_WRITE_TOKEN__?: string }
    ).__JIG_WRITE_TOKEN__;
    if (token === undefined) throw new Error("Jig write token unavailable");
    const response = await fetch("/api/v1/sync", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-jig-write-token": token,
      },
      body: "{}",
    });
    if (!response.ok) throw new Error(`sync failed: ${response.status}`);
  });
}

async function capture(page: Page, name: string): Promise<void> {
  const image = await page.screenshot({ type: "jpeg", quality: 58 });
  console.log(`JIG_REFERENCE_CAPTURE:${name}:${image.toString("base64")}`);
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

test("capture current-head reference surfaces", async ({ page }) => {
  await page.goto("/");
  await resetCanonicalTasks(page);

  const previous = await browserCivilDate(page, -1);
  const today = await browserCivilDate(page);
  const next = await browserCivilDate(page, 1);
  const plusTwo = await browserCivilDate(page, 2);
  const plusThree = await browserCivilDate(page, 3);

  await create(page, "Review product plan", previous, { context: "Legal" });
  await create(page, "Legal — TTA workflow remediation", today, {
    priority: "HIGH",
    context: "Legal App",
    note: "Details live in the project.",
    reminder: "10:00",
  });
  await create(page, "Review Order lifecycle changes", today, {
    context: "Order",
    reminder: "14:00",
  });
  await create(page, "SPAN docs validation", today, {
    priority: "LOW",
    context: "SPAN",
  });
  await create(page, "Plan tomorrow", today, {
    context: "Planning",
    reminder: "17:00",
  });
  await create(page, "Review outstanding fixes", next, { context: "Legal" });
  await create(page, "Prepare next week", next, { context: "Order" });
  await create(page, "Reading and notes", plusTwo, { context: "Personal" });
  await create(page, "Weekly review", plusThree, { context: "Planning" });
  await create(page, "Daily standup", today, { context: "Team" });

  const standup = (await apiState(page)).tasks.find(
    (task) => task.title === "Daily standup",
  );
  if (standup === undefined) throw new Error("standup fixture missing");
  await apiCommand(page, { type: "complete", task_id: standup.id });

  await syncNow(page);
  await page.reload();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.locator(".jig-day-view")).toBeVisible();

  const firstCard = page
    .getByText("Legal — TTA workflow remediation", { exact: true })
    .locator("xpath=ancestor::li[contains(@class,'jig-task-card')][1]");
  await firstCard.click();
  await capture(page, "desktop-day-inspector");

  await page
    .locator(".jig-primary-nav")
    .getByRole("button", { name: "Week", exact: true })
    .click();
  await capture(page, "desktop-week-light");

  await page.evaluate(() => localStorage.setItem("jig-theme", "dark"));
  await page.reload();
  await page
    .locator(".jig-primary-nav")
    .getByRole("button", { name: "Week", exact: true })
    .click();
  await capture(page, "desktop-week-dark");

  await page.evaluate(() => localStorage.setItem("jig-theme", "light"));
  await page.reload();
  await page
    .locator(".jig-primary-nav")
    .getByRole("button", { name: "History", exact: true })
    .click();
  await capture(page, "desktop-history");

  await page
    .locator(".jig-primary-nav")
    .getByRole("button", { name: "Settings", exact: true })
    .click();
  await capture(page, "desktop-settings");

  await page
    .locator(".jig-primary-nav")
    .getByRole("button", { name: "Day", exact: true })
    .click();
  await page.setViewportSize({ width: 414, height: 900 });
  await expect(page.locator(".jig-mobile-header")).toBeVisible();
  await capture(page, "mobile-day");

  const mobileCard = page
    .getByText("Legal — TTA workflow remediation", { exact: true })
    .locator("xpath=ancestor::li[contains(@class,'jig-task-card')][1]");
  await mobileCard
    .getByRole("button", { name: "Actions for Legal — TTA workflow remediation" })
    .click();
  await page.getByRole("menuitem", { name: "Edit", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await capture(page, "mobile-editor");
});
