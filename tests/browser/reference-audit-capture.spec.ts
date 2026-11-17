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

  const today = await browserCivilDate(page);
  const target = await browserCivilDate(page, 2);
  const next = await browserCivilDate(page, 1);
  const plusThree = await browserCivilDate(page, 3);
  const plusFour = await browserCivilDate(page, 4);
  const plusFive = await browserCivilDate(page, 5);

  await create(page, "Legal — TTA workflow remediation", target, {
    priority: "HIGH",
    context: "Legal App",
    note: "Details live in the project.",
    reminder: "10:00",
  });
  await create(page, "Review Order lifecycle changes", target, {
    context: "Order",
    reminder: "14:00",
  });
  await create(page, "SPAN docs validation", target, {
    priority: "LOW",
    context: "SPAN",
  });
  await create(page, "Plan tomorrow", target, {
    context: "Planning",
    reminder: "17:00",
  });
  await create(page, "Today planning seed", today, { context: "Planning" });
  await create(page, "Prepare Jig design", next, { context: "Planning" });
  await create(page, "Review outstanding fixes", plusThree, { context: "Legal" });
  await create(page, "Prepare next week", plusThree, { context: "Order" });
  await create(page, "Reading and notes", plusFour, { context: "Personal" });
  await create(page, "Weekly review", plusFive, { context: "Planning" });
  await create(page, "Daily standup", target, { context: "Team" });

  const standup = (await apiState(page)).tasks.find(
    (task) => task.title === "Daily standup",
  );
  if (standup === undefined) throw new Error("standup fixture missing");
  await apiCommand(page, { type: "complete", task_id: standup.id });

  await syncNow(page);
  await page.reload();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.locator(".jig-day-view")).toBeVisible();
  await page.locator(".jig-week-strip-date").nth(3).click();

  const firstCard = page
    .getByText("Legal — TTA workflow remediation", { exact: true })
    .locator("xpath=ancestor::li[contains(@class,'jig-task-card')][1]");
  await firstCard.click();
  console.log(
    "JIG_REFERENCE_METRICS:desktop-day:" +
      JSON.stringify({
        primary: await page.locator(".jig-day-primary").boundingBox(),
        inspector: await page.locator(".jig-task-inspector").boundingBox(),
        firstCard: await firstCard.boundingBox(),
        completedRow: await page
          .getByText("Daily standup", { exact: true })
          .locator("xpath=ancestor::li[contains(@class,'jig-task-card')][1]")
          .boundingBox(),
      }),
  );
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
  console.log(
    "JIG_REFERENCE_METRICS:desktop-settings:" +
      JSON.stringify({
        grid: await page.locator(".jig-settings-grid").boundingBox(),
        planning: await page.locator(".jig-settings-card").nth(0).boundingBox(),
        sync: await page.locator(".jig-settings-card").nth(1).boundingBox(),
      }),
  );
  await capture(page, "desktop-settings");

  await page
    .locator(".jig-primary-nav")
    .getByRole("button", { name: "Day", exact: true })
    .click();
  await page.setViewportSize({ width: 414, height: 900 });
  await expect(page.locator(".jig-mobile-header")).toBeVisible();
  await page.locator(".jig-week-strip-date").nth(3).click();
  console.log(
    "JIG_REFERENCE_METRICS:mobile-day:" +
      JSON.stringify({
        frame: await page.locator(".jig-content-frame").boundingBox(),
        firstDate: await page.locator(".jig-week-strip-date").first().boundingBox(),
        heading: await page.locator(".jig-mobile-day-heading").boundingBox(),
        attention: await page
          .getByRole("heading", { name: "Attention", exact: true })
          .boundingBox(),
        firstCard: await page
          .getByText("Legal — TTA workflow remediation", { exact: true })
          .locator("xpath=ancestor::li[contains(@class,'jig-task-card')][1]")
          .boundingBox(),
        quickAdd: await page
          .getByRole("button", { name: "Add task", exact: true })
          .last()
          .boundingBox(),
      }),
  );
  await capture(page, "mobile-day");

  const mobileCard = page
    .getByText("Legal — TTA workflow remediation", { exact: true })
    .locator("xpath=ancestor::li[contains(@class,'jig-task-card')][1]");
  await mobileCard
    .getByRole("button", { name: "Actions for Legal — TTA workflow remediation" })
    .click();
  await page.getByRole("menuitem", { name: "Edit", exact: true }).click();
  await page.setViewportSize({ width: 414, height: 980 });
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.waitForTimeout(500);
  console.log(
    "JIG_REFERENCE_METRICS:mobile-editor:" +
      JSON.stringify({
        frame: await page.locator(".jig-editor-mobile-frame").boundingBox(),
        formBlocks: await page.locator(".jig-editor-form").evaluate((form) =>
          [...form.children].map((element) => {
            const rect = element.getBoundingClientRect();
            return {
              text: (element.textContent ?? "").trim().slice(0, 80),
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height,
            };
          }),
        ),
        behavior: await page.locator(".jig-editor-date-behavior").boundingBox(),
        deleteAction: await page.getByRole("button", { name: "Delete task…", exact: true }).boundingBox(),
        save: await page.getByRole("button", { name: "Save", exact: true }).boundingBox(),
        cancel: await page.getByRole("button", { name: "Cancel", exact: true }).last().boundingBox(),
      }),
  );
  await capture(page, "mobile-editor");
});

test("capture governed rollover evidence", async ({ page }) => {
  await page.goto("/");
  await resetCanonicalTasks(page);
  const yesterday = await browserCivilDate(page, -1);
  const today = await browserCivilDate(page);

  await create(page, "Rolled forward from yesterday", yesterday, {
    priority: "HIGH",
    context: "Planning",
    reminder: "09:00",
  });
  await page.reload();
  await page.setViewportSize({ width: 1440, height: 900 });

  await expect(
    page
      .getByText("Rolled forward from yesterday", { exact: true })
      .locator("xpath=ancestor::li[contains(@class,'jig-task-card')][1]"),
  ).toBeVisible();
  const state = await apiState(page);
  const rolled = state.tasks.find(
    (task) => task.title === "Rolled forward from yesterday",
  );
  expect(rolled?.scheduled_date).toBe(today);
  await capture(page, "desktop-day-rollover");
});

test("capture governed sync-issue evidence", async ({ page }) => {
  await page.goto("/");
  await resetCanonicalTasks(page);
  const status = await page.evaluate(async () => {
    const response = await fetch("/api/v1/status");
    return response.json() as Promise<Record<string, unknown>>;
  });

  await page.route("**/api/v1/status", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ...status,
        ready: true,
        repository_status: "sync-issue",
      }),
    });
  });

  await page.reload();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(
    page.getByText("Repository synchronization issue", { exact: true }),
  ).toBeVisible();
  await capture(page, "sync-issue");
});

test("capture governed local-save-failure evidence", async ({ page }) => {
  await page.goto("/");
  await resetCanonicalTasks(page);
  const today = await browserCivilDate(page);
  await create(page, "Local save failure evidence", today, {
    context: "Planning",
  });
  await page.reload();
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.route("**/api/v1/commands", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: "Local database write failed" }),
    });
  });

  await page
    .getByRole("checkbox", { name: "Complete Local save failure evidence" })
    .click();
  await expect(
    page.getByText("Jig could not complete the operation", { exact: true }),
  ).toBeVisible();
  await capture(page, "local-save-failure");
});

