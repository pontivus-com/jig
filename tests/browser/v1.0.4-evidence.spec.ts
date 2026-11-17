import { rename } from "node:fs/promises";
import { mkdir } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import {
  apiCommand,
  browserCivilDate,
  resetCanonicalTasks,
} from "./helpers";

const OUTPUT = "test-results/v1.0.4-evidence";
const REMOTE = "/tmp/jig-playwright-remote.git";
const OFFLINE_REMOTE = "/tmp/jig-playwright-remote.offline.git";

async function createFixtureTask(
  page: Page,
  title: string,
  date: string,
  priority: "HIGH" | "NORMAL" | "LOW",
  extras: {
    context?: string | null;
    reminder_time?: string | null;
    reference?: string | null;
    note?: string | null;
  } = {},
): Promise<void> {
  await apiCommand(page, {
    type: "create",
    title,
    scheduled_date: date,
    priority,
    context: extras.context ?? null,
    reminder_time: extras.reminder_time ?? null,
    reference: extras.reference ?? null,
    note: extras.note ?? null,
  });
}

async function repositoryStatus(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const response = await fetch("/api/v1/status");
    const body = (await response.json()) as { repository_status: string };
    return body.repository_status;
  });
}

async function capture(page: Page, name: string): Promise<void> {
  await page.screenshot({
    path: `${OUTPUT}/${name}.png`,
    fullPage: true,
    animations: "disabled",
  });
}

test("capture governed v1.0.4 visual states", async ({ page }) => {
  await mkdir(OUTPUT, { recursive: true });
  await page.goto("/");
  await page.waitForFunction(
    () =>
      (window as typeof window & { __JIG_WRITE_TOKEN__?: string })
        .__JIG_WRITE_TOKEN__ !== undefined,
  );
  await resetCanonicalTasks(page);

  const today = await browserCivilDate(page);
  const tomorrow = await browserCivilDate(page, 1);
  const inTwoDays = await browserCivilDate(page, 2);

  await createFixtureTask(page, "Review contract changes", today, "HIGH", {
    context: "Client Alpha",
    reminder_time: "10:30",
    reference: "https://example.com/matter/alpha",
  });
  await createFixtureTask(page, "Prepare implementation notes", today, "NORMAL", {
    context: "Jig",
    note: "Keep the functional core boundary explicit.",
  });
  await createFixtureTask(page, "Follow up with counsel", tomorrow, "LOW", {
    context: "Client Alpha",
  });
  await createFixtureTask(page, "Archive completed brief", inTwoDays, "NORMAL");

  await page.reload();
  await page.setViewportSize({ width: 1440, height: 900 });
  await capture(page, "desktop-planner-light");

  await page.getByText("Prepare implementation notes", { exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Prepare implementation notes" }),
  ).toBeVisible();
  await capture(page, "desktop-planner-task-drawer");

  await page.getByRole("button", { name: "Close", exact: true }).click();
  const dragCard = page
    .getByText("Review contract changes", { exact: true })
    .locator("xpath=ancestor::li[1]");
  const dragBody = dragCard.locator(".jig-task-body");
  const destination = page.locator(`[data-date="${tomorrow}"]`);
  const sourceBox = await dragBody.boundingBox();
  const destinationBox = await destination.boundingBox();
  if (sourceBox === null || destinationBox === null) {
    throw new Error("Evidence drag geometry unavailable");
  }
  await page.mouse.move(
    sourceBox.x + sourceBox.width / 2,
    sourceBox.y + sourceBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    destinationBox.x + destinationBox.width / 2,
    destinationBox.y + Math.min(120, destinationBox.height / 2),
    { steps: 12 },
  );
  await capture(page, "desktop-planner-drag-target");
  await page.mouse.up();

  await page.evaluate(() => localStorage.setItem("jig-theme", "dark"));
  await page.reload();
  await page.setViewportSize({ width: 1440, height: 900 });
  await capture(page, "desktop-planner-dark");

  await page.getByRole("button", { name: "History", exact: true }).click();
  await capture(page, "desktop-history");

  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await capture(page, "desktop-settings");

  await page.evaluate(() => localStorage.setItem("jig-theme", "light"));
  await page.reload();
  await page.getByRole("button", { name: "Planner", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await capture(page, "mobile-planner");

  await page.getByText("Prepare implementation notes", { exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Prepare implementation notes" }),
  ).toBeVisible();
  await capture(page, "mobile-task-bottom-sheet");
  await page.getByRole("button", { name: "Close", exact: true }).click();

  await page.setViewportSize({ width: 1440, height: 900 });
  await rename(REMOTE, OFFLINE_REMOTE);
  try {
    await createFixtureTask(page, "Locally safe during outage", today, "NORMAL");
    await expect
      .poll(() => repositoryStatus(page), { timeout: 10_000 })
      .toMatch(/^(retrying|sync-issue)$/);
    await page.reload();
    await capture(page, "sync-issue");
  } finally {
    await rename(OFFLINE_REMOTE, REMOTE);
  }

  await page.getByText("Prepare implementation notes", { exact: true }).click();
  const workspace = page.getByRole("dialog", {
    name: "Prepare implementation notes",
  });
  await expect(workspace).toBeVisible();

  await page.route("**/api/v1/commands", async (route) => {
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: "Evidence local save failure" }),
    });
  });
  await workspace.getByLabel("Notes").fill("This change must not persist.");
  await workspace.getByRole("button", { name: "Save", exact: true }).click();
  await expect(workspace.getByRole("alert")).toContainText(
    "Evidence local save failure",
  );
  await capture(page, "local-save-failure");
});

test.afterAll(async () => {
  try {
    await rename(OFFLINE_REMOTE, REMOTE);
  } catch {
    // The evidence test restores the fixture itself; this is crash cleanup only.
  }
});
