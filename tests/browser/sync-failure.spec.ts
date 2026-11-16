import { rename } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import {
  apiCommand,
  apiState,
  browserCivilDate,
  resetCanonicalTasks,
} from "./helpers";

const REMOTE = "/tmp/jig-playwright-remote.git";
const OFFLINE_REMOTE = "/tmp/jig-playwright-remote.offline.git";

async function repositoryStatus(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const response = await fetch("/api/v1/status");
    if (!response.ok) {
      throw new Error(`GET /status failed: ${response.status}`);
    }
    const status = (await response.json()) as {
      repository_status: string;
    };
    return status.repository_status;
  });
}

async function syncNow(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const token = (
      window as typeof window & {
        __JIG_WRITE_TOKEN__?: string;
      }
    ).__JIG_WRITE_TOKEN__;
    if (token === undefined) {
      throw new Error("Jig write token is unavailable");
    }
    const response = await fetch("/api/v1/sync", {
      method: "POST",
      headers: {
        "x-jig-write-token": token,
      },
    });
    if (!response.ok) {
      throw new Error(
        `POST /sync failed: ${response.status} ${await response.text()}`,
      );
    }
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await resetCanonicalTasks(page);
  await syncNow(page);
  await expect
    .poll(() => repositoryStatus(page), { timeout: 10_000 })
    .toBe("synchronized");
  await page.reload();
});

test("local save survives repository transport failure and later synchronization recovers", async ({
  page,
}) => {
  await rename(REMOTE, OFFLINE_REMOTE);
  try {
    const today = await browserCivilDate(page);
    await apiCommand(page, {
      type: "create",
      title: "Locally safe during sync outage",
      scheduled_date: today,
      priority: "NORMAL",
      context: null,
      reference: null,
      note: null,
      reminder_time: null,
    });

    expect(
      (await apiState(page)).tasks.some(
        (task) => task.title === "Locally safe during sync outage",
      ),
    ).toBe(true);

    await expect
      .poll(() => repositoryStatus(page), { timeout: 10_000 })
      .toMatch(/^(retrying|sync-issue)$/);
  } finally {
    await rename(OFFLINE_REMOTE, REMOTE);
  }

  await syncNow(page);
  await expect
    .poll(() => repositoryStatus(page), { timeout: 10_000 })
    .toBe("synchronized");
  expect(
    (await apiState(page)).tasks.some(
      (task) => task.title === "Locally safe during sync outage",
    ),
  ).toBe(true);
});
