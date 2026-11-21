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

async function repositoryStatus(
  page: Page,
): Promise<{
  readonly local_git: string;
  readonly remote: {
    readonly state: string;
    readonly remote_name: string | null;
    readonly remote_location: string | null;
  };
}> {
  return page.evaluate(async () => {
    const response = await fetch("/api/v1/status");
    if (!response.ok) {
      throw new Error(`GET /status failed: ${response.status}`);
    }
    const status = (await response.json()) as {
      repository_status: {
        local_git: string;
        remote: {
          state: string;
          remote_name: string | null;
          remote_location: string | null;
        };
      };
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
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await resetCanonicalTasks(page);
  await syncNow(page);
  await expect
    .poll(async () => {
      const status = await repositoryStatus(page);
      return `${status.local_git}:${status.remote.state}`;
    }, { timeout: 10_000 })
    .toBe("committed:synchronized");
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
      .poll(async () => {
        const status = await repositoryStatus(page);
        return `${status.local_git}:${status.remote.state}`;
      }, { timeout: 10_000 })
      .toMatch(/^committed:(retrying|sync-issue)$/);
  } finally {
    await rename(OFFLINE_REMOTE, REMOTE);
  }

  await syncNow(page);
  await expect
    .poll(async () => {
      const status = await repositoryStatus(page);
      return `${status.local_git}:${status.remote.state}`;
    }, { timeout: 10_000 })
    .toBe("committed:synchronized");
  expect(
    (await apiState(page)).tasks.some(
      (task) => task.title === "Locally safe during sync outage",
    ),
  ).toBe(true);
});