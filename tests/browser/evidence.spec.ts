import { mkdir, rename } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import {
  apiCommand,
  apiState,
  browserCivilDate,
  resetCanonicalTasks,
  taskByTitle,
} from "./helpers";

const EVIDENCE_DIR = "test-results/v1-evidence";
const REMOTE = "/tmp/jig-playwright-remote.git";
const OFFLINE_REMOTE = "/tmp/jig-playwright-evidence-remote.offline.git";

async function screenshot(page: Page, name: string): Promise<void> {
  await mkdir(EVIDENCE_DIR, { recursive: true });
  await page.screenshot({
    path: `${EVIDENCE_DIR}/${name}`,
    fullPage: true,
  });
}

async function setAppearance(
  page: Page,
  value: "System" | "Light" | "Dark",
): Promise<void> {
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const option = page.getByRole("radio", { name: value, exact: true });
  await option.click();
  await expect(option).toHaveAttribute("aria-checked", "true");
}

async function repositoryStatus(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const response = await fetch("/api/v1/status");
    if (!response.ok) throw new Error("Unable to read Jig status");
    return ((await response.json()) as { repository_status: string })
      .repository_status;
  });
}

async function syncNow(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const token = (
      window as typeof window & { __JIG_WRITE_TOKEN__?: string }
    ).__JIG_WRITE_TOKEN__;
    if (token === undefined) throw new Error("write token unavailable");
    const response = await fetch("/api/v1/sync", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-jig-write-token": token,
      },
      body: "{}",
    });
    if (!response.ok) throw new Error("Unable to synchronize Jig");
  });
}

test("capture v1 release-candidate browser evidence", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/");
  await resetCanonicalTasks(page);

  const today = await browserCivilDate(page);
  const yesterday = await browserCivilDate(page, -1);
  const tomorrow = await browserCivilDate(page, 1);

  await apiCommand(page, {
    type: "create",
    title: "Prepare customer review",
    scheduled_date: today,
    priority: "HIGH",
    context: "Client Alpha",
    reference: "https://example.com/matter",
    note: "Review the latest marked draft.",
    reminder_time: null,
  });
  await apiCommand(page, {
    type: "create",
    title: "Follow up on open question",
    scheduled_date: today,
    priority: "NORMAL",
    context: null,
    reference: null,
    note: null,
    reminder_time: null,
  });
  await apiCommand(page, {
    type: "create",
    title: "Earlier unfinished item",
    scheduled_date: yesterday,
    priority: "NORMAL",
    context: null,
    reference: "../matters/client-alpha",
    note: null,
    reminder_time: null,
  });
  await apiCommand(page, {
    type: "create",
    title: "Tomorrow planning note",
    scheduled_date: tomorrow,
    priority: "LOW",
    context: null,
    reference: null,
    note: null,
    reminder_time: null,
  });

  await page.reload();
  await setAppearance(page, "Light");
  await page.getByRole("button", { name: "Week", exact: true }).click();
  await screenshot(page, "week-light.png");

  await page.getByRole("button", { name: "Day", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Carried over", exact: true }),
  ).toBeVisible();
  await screenshot(page, "day-carry-over-light.png");

  const completed = await taskByTitle(page, "Prepare customer review");
  await apiCommand(page, {
    type: "complete",
    task_id: completed.id,
  });
  await page.reload();
  await page.getByRole("button", { name: "History", exact: true }).click();
  await screenshot(page, "history-light.png");

  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await screenshot(page, "settings-light.png");

  await setAppearance(page, "Dark");
  await page.getByRole("button", { name: "Week", exact: true }).click();
  await screenshot(page, "week-dark.png");

  await setAppearance(page, "Light");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await screenshot(page, "mobile-day.png");
  await page
    .getByRole("button", { name: "Add task", exact: true })
    .first()
    .click();
  await screenshot(page, "mobile-editor.png");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancel", exact: true })
    .click();

  await page.setViewportSize({ width: 1280, height: 900 });
  await syncNow(page);
  await expect
    .poll(() => repositoryStatus(page), { timeout: 10_000 })
    .toBe("synchronized");

  await rename(REMOTE, OFFLINE_REMOTE);
  try {
    await apiCommand(page, {
      type: "create",
      title: "Saved locally while repository is unavailable",
      scheduled_date: today,
      priority: "NORMAL",
      context: null,
      reference: null,
      note: null,
      reminder_time: null,
    });
    await expect
      .poll(() => repositoryStatus(page), { timeout: 10_000 })
      .toMatch(/^(retrying|sync-issue)$/);
    await page.reload();
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await screenshot(page, "sync-issue-light.png");
  } finally {
    await rename(OFFLINE_REMOTE, REMOTE);
    await syncNow(page);
  }

  await page.getByRole("button", { name: "Week", exact: true }).click();
  await page
    .getByRole("button", { name: "Add task", exact: true })
    .first()
    .click();
  const editor = page.getByRole("dialog");
  await editor.getByLabel("Title").fill("Local save failure evidence");
  await page.route("**/api/v1/commands", async (route) => {
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({
        error: "Local save could not be completed",
      }),
    });
  });
  await editor
    .getByRole("button", { name: "Add task", exact: true })
    .click();
  await expect(
    editor.getByText("Local save could not be completed", {
      exact: true,
    }),
  ).toBeVisible();
  await screenshot(page, "local-save-failure-light.png");
  await page.unroute("**/api/v1/commands");

  expect(
    (await apiState(page)).tasks.some(
      (task) => task.title === "Local save failure evidence",
    ),
  ).toBe(false);
});
