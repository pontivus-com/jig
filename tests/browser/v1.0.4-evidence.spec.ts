import { mkdir, rename } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { runGit } from "../../src/shell/git";
import {
  apiCommand,
  apiState,
  browserCivilDate,
  resetCanonicalTasks,
  taskByTitle,
} from "./helpers";

const EVIDENCE_DIR = "test-results/v1.0.4-evidence";
const ROOT = "/tmp/jig-playwright-repository";
const REMOTE = "/tmp/jig-playwright-remote.git";
const OFFLINE_REMOTE = "/tmp/jig-playwright-remote.offline.git";

async function capture(page: Page, name: string): Promise<void> {
  await page.waitForTimeout(250);
  await page.screenshot({
    path: `${EVIDENCE_DIR}/${name}.jpg`,
    type: "jpeg",
    quality: 90,
    fullPage: false,
  });
}

async function createTask(
  page: Page,
  title: string,
  date: string,
  priority: "HIGH" | "NORMAL" | "LOW",
  options: {
    context?: string | null;
    reference?: string | null;
    reminder_time?: string | null;
  } = {},
): Promise<void> {
  await apiCommand(page, {
    type: "create",
    title,
    scheduled_date: date,
    priority,
    context: options.context ?? null,
    reference: options.reference ?? null,
    note: null,
    reminder_time: options.reminder_time ?? null,
  });
}

async function repositoryStatus(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const response = await fetch("/api/v1/status");
    if (!response.ok) {
      throw new Error(`GET /status failed: ${response.status}`);
    }
    const value = (await response.json()) as { repository_status: string };
    return value.repository_status;
  });
}

async function syncNow(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const token = (
      window as typeof window & { __JIG_WRITE_TOKEN__?: string }
    ).__JIG_WRITE_TOKEN__;
    if (token === undefined) {
      throw new Error("Jig write token is unavailable");
    }
    const response = await fetch("/api/v1/sync", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-jig-write-token": token,
      },
      body: "{}",
    });
    if (!response.ok) {
      throw new Error(
        `POST /sync failed: ${response.status} ${await response.text()}`,
      );
    }
    const value = (await response.json()) as { repository_status: string };
    return value.repository_status;
  });
}

async function setTheme(page: Page, theme: "Light" | "Dark"): Promise<void> {
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("radio", { name: theme, exact: true }).click();
  await page.getByRole("button", { name: "Planner", exact: true }).click();
}

test("capture reviewed v1.0.4 visual states", async ({ page }) => {
  test.skip(
    process.env.JIG_CAPTURE_EVIDENCE !== "1",
    "Temporary v1.0.4 evidence capture only",
  );

  await mkdir(EVIDENCE_DIR, { recursive: true });
  await page.goto("/");
  await resetCanonicalTasks(page);

  const today = await browserCivilDate(page);
  const tomorrow = await browserCivilDate(page, 1);
  const dayAfter = await browserCivilDate(page, 2);

  await createTask(page, "Prepare client review", today, "HIGH", {
    context: "Client",
    reminder_time: "15:30",
  });
  await createTask(page, "Refine implementation notes", today, "NORMAL", {
    context: "Jig",
    reference: "https://example.com/reference",
  });
  await createTask(page, "Review follow-up", tomorrow, "LOW", {
    context: "Planning",
  });
  await createTask(page, "Confirm next steps", dayAfter, "NORMAL");

  await syncNow(page);
  await page.reload();
  await page.setViewportSize({ width: 1440, height: 900 });
  await setTheme(page, "Light");
  await capture(page, "desktop-planner-light");

  await page.getByText("Refine implementation notes", { exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Refine implementation notes" }),
  ).toBeVisible();
  await capture(page, "desktop-selected-task-drawer");
  await page
    .getByRole("dialog", { name: "Refine implementation notes" })
    .getByRole("button", { name: "Close" })
    .click();

  const source = page
    .getByText("Prepare client review", { exact: true })
    .locator("xpath=ancestor::li[1]")
    .locator(".jig-task-body");
  const destination = page.locator(`[data-date="${tomorrow}"]`);
  const sourceBox = await source.boundingBox();
  const destinationBox = await destination.boundingBox();
  if (sourceBox === null || destinationBox === null) {
    throw new Error("Drag evidence geometry unavailable");
  }
  await page.mouse.move(
    sourceBox.x + sourceBox.width / 2,
    sourceBox.y + sourceBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    sourceBox.x + sourceBox.width / 2 + 8,
    sourceBox.y + sourceBox.height / 2 + 8,
    { steps: 3 },
  );
  await page.mouse.move(
    destinationBox.x + destinationBox.width / 2,
    destinationBox.y + Math.min(destinationBox.height / 2, 180),
    { steps: 12 },
  );
  await expect(page.locator(".jig-drag-card-overlay")).toBeVisible();
  await expect(destination).toHaveClass(/jig-date-drop-zone-active/);
  await capture(page, "desktop-drag-target");
  await page.mouse.up();
  await expect
    .poll(async () => (await taskByTitle(page, "Prepare client review")).scheduled_date)
    .toBe(tomorrow);

  await setTheme(page, "Dark");
  await capture(page, "desktop-planner-dark");
  await setTheme(page, "Light");

  const completed = await taskByTitle(page, "Confirm next steps");
  await apiCommand(page, { type: "complete", task_id: completed.id });
  await page.reload();
  await page.getByRole("button", { name: "History", exact: true }).click();
  await capture(page, "desktop-history");

  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await capture(page, "desktop-settings");

  await page.getByRole("button", { name: "Planner", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await capture(page, "mobile-planner");

  await page.getByText("Refine implementation notes", { exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Refine implementation notes" }),
  ).toBeVisible();
  await capture(page, "mobile-task-bottom-sheet");
  await page
    .getByRole("dialog", { name: "Refine implementation notes" })
    .getByRole("button", { name: "Close" })
    .click();

  await page.setViewportSize({ width: 1440, height: 900 });
  await runGit(ROOT, ["remote", "remove", "origin"]);
  await syncNow(page);
  await expect.poll(() => repositoryStatus(page)).toBe("local-only");
  await page.reload();
  await expect(page.getByRole("button", { name: "Local only" })).toBeVisible();
  await capture(page, "desktop-local-only");

  await runGit(ROOT, ["remote", "add", "origin", REMOTE]);
  await syncNow(page);
  await expect
    .poll(() => repositoryStatus(page), { timeout: 10_000 })
    .toBe("synchronized");

  await rename(REMOTE, OFFLINE_REMOTE);
  try {
    const stateBeforeOutage = await apiState(page);
    await apiCommand(page, {
      type: "create",
      title: "Local work remains safe",
      scheduled_date: today,
      priority: "NORMAL",
      context: "Offline",
      reference: null,
      note: null,
      reminder_time: null,
    });
    expect((await apiState(page)).revision).toBeGreaterThan(stateBeforeOutage.revision);

    for (let attempt = 0; attempt < 8; attempt += 1) {
      await syncNow(page);
    }
    await expect
      .poll(() => repositoryStatus(page), { timeout: 10_000 })
      .toBe("sync-issue");
    await page.reload();
    await expect(page.getByText("Repository synchronization issue")).toBeVisible();
    await capture(page, "desktop-sync-issue");
  } finally {
    await rename(OFFLINE_REMOTE, REMOTE);
  }

  await syncNow(page);
  await expect
    .poll(() => repositoryStatus(page), { timeout: 10_000 })
    .toBe("synchronized");
});
