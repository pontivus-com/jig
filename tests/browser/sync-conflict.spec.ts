import {
  chmod,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

import { runGit } from "../../src/shell/git/process";
import {
  apiCommand,
  apiState,
  browserCivilDate,
  resetCanonicalTasks,
  taskByTitle,
} from "./helpers";

const ROOT = "/tmp/jig-playwright-repository";
const REMOTE = "/tmp/jig-playwright-remote.git";
const REJECT_HOOK = join(REMOTE, "hooks", "pre-receive");

async function git(
  cwd: string,
  args: readonly string[],
): Promise<string> {
  const result = await runGit(cwd, args);
  if (result.exit_code !== 0) {
    throw new Error(result.stderr || result.stdout);
  }
  return result.stdout.trim();
}

async function repositoryStatus(
  page: Page,
): Promise<string> {
  return page.evaluate(async () => {
    const response = await fetch("/api/v1/status");
    if (!response.ok) {
      throw new Error("GET /status failed");
    }
    const payload = await response.json() as {
      repository_status: {
        local_git: string;
        remote: { state: string };
      };
    };
    return (
      payload.repository_status.local_git +
      ":" +
      payload.repository_status.remote.state
    );
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
        "POST /sync failed: " +
          response.status +
          " " +
          await response.text(),
      );
    }
  });
}

async function currentConflict(
  page: Page,
): Promise<unknown> {
  return page.evaluate(async () => {
    const response = await fetch("/api/v1/sync/conflict");
    if (!response.ok) {
      throw new Error("GET /sync/conflict failed");
    }
    return response.json();
  });
}

test.beforeEach(async ({ page }) => {
  await rm(REJECT_HOOK, { force: true });
  await page.goto("/");
  await resetCanonicalTasks(page);
  await syncNow(page);
  await expect
    .poll(() => repositoryStatus(page), { timeout: 10_000 })
    .toBe("committed:synchronized");
  await page.reload();
});

test("eligible sync conflict keeps one draft across responsive hosts and Cancel is non-mutating", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const today = await browserCivilDate(page);

  await apiCommand(page, {
    type: "create",
    title: "Shared conflict base",
    scheduled_date: today,
    priority: "NORMAL",
    context: null,
    reference: null,
    note: null,
    reminder_time: null,
  });
  await syncNow(page);
  await expect
    .poll(() => repositoryStatus(page), { timeout: 10_000 })
    .toBe("committed:synchronized");

  const shared = await taskByTitle(page, "Shared conflict base");
  const writer = await mkdtemp(join(tmpdir(), "jig-browser-conflict-"));
  try {
    await git(tmpdir(), [
      "clone",
      "--branch",
      "jig-data",
      REMOTE,
      writer,
    ]);
    await git(writer, ["config", "user.name", "Conflict Fixture"]);
    await git(writer, [
      "config",
      "user.email",
      "conflict-fixture@local.invalid",
    ]);

    await writeFile(
      REJECT_HOOK,
      "#!/bin/sh\nexit 1\n",
      "utf8",
    );
    await chmod(REJECT_HOOK, 0o755);

    await apiCommand(page, {
      type: "edit",
      task_id: shared.id,
      changes: { title: "Local conflict choice" },
    });
    await syncNow(page);
    await expect
      .poll(() => repositoryStatus(page), { timeout: 10_000 })
      .toMatch(/^committed:(retrying|sync-issue)$/);
    expect((await apiState(page)).tasks[0]).toMatchObject({
      id: shared.id,
      title: "Local conflict choice",
    });

    await rm(REJECT_HOOK, { force: true });

    const taskPath = join(writer, "tasks", shared.id + ".json");
    const remoteTask = JSON.parse(
      await readFile(taskPath, "utf8"),
    ) as Record<string, unknown>;
    await writeFile(
      taskPath,
      JSON.stringify({
        ...remoteTask,
        title: "Remote conflict choice",
        updated_at: "2026-11-22T14:30:00.000Z",
      }) + "\n",
      "utf8",
    );
    await git(writer, ["add", "-A"]);
    await git(writer, ["commit", "-m", "Remote browser conflict"]);
    await git(writer, [
      "push",
      REMOTE,
      "jig-data:jig-data",
    ]);

    await syncNow(page);
    await expect
      .poll(() => repositoryStatus(page), { timeout: 10_000 })
      .toBe("committed:sync-issue");
    await expect
      .poll(() => currentConflict(page), { timeout: 10_000 })
      .not.toBeNull();

    await page.reload();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page
      .getByRole("button", { name: "Settings", exact: true })
      .click();
    const resolveAction = page.getByRole("button", {
      name: "Resolve sync conflict",
      exact: true,
    });
    await expect(resolveAction).toBeVisible();
    await resolveAction.click();

    const desktopResolver = page.getByRole("dialog", {
      name: "Resolve sync conflict",
    });
    await expect(desktopResolver).toBeVisible();
    await expect(
      desktopResolver.getByText(
        "Both installations changed the same planning data. Your local work is still saved.",
        { exact: true },
      ),
    ).toBeVisible();

    await desktopResolver.getByRole("radio").first().check();
    await expect(
      desktopResolver.getByRole("heading", {
        name: "Review Task order",
      }),
    ).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    const narrowResolver = page.getByRole("dialog", {
      name: "Resolve sync conflict",
    });
    await expect(narrowResolver).toBeVisible();
    await expect(
      narrowResolver.getByRole("heading", {
        name: "Review Task order",
      }),
    ).toBeVisible();

    await narrowResolver
      .getByRole("button", { name: "Cancel", exact: true })
      .click();
    await expect(narrowResolver).toHaveCount(0);
    expect((await apiState(page)).tasks[0]).toMatchObject({
      id: shared.id,
      title: "Local conflict choice",
    });
    await expect
      .poll(() => currentConflict(page), { timeout: 10_000 })
      .not.toBeNull();

    await resolveAction.click();
    const reopened = page.getByRole("dialog", {
      name: "Resolve sync conflict",
    });
    await expect(reopened).toBeVisible();
    await expect(
      reopened.getByRole("heading", {
        name: "Review Task order",
      }),
    ).toHaveCount(0);

    await reopened.getByRole("radio").first().check();
    await reopened
      .getByRole("button", { name: "Confirm order", exact: true })
      .click();
    await expect(
      reopened.getByRole("heading", { name: "Resolution ready" }),
    ).toBeVisible();
    await reopened
      .getByRole("button", {
        name: "Use this resolution",
        exact: true,
      })
      .click();

    await expect(reopened).toHaveCount(0);
    await expect
      .poll(() => repositoryStatus(page), { timeout: 10_000 })
      .toBe("committed:synchronized");
    await expect
      .poll(() => currentConflict(page), { timeout: 10_000 })
      .toBeNull();
    expect((await apiState(page)).tasks[0]).toMatchObject({
      id: shared.id,
      title: "Local conflict choice",
    });

    expect(
      await git(ROOT, [
        "show",
        "-s",
        "--format=%s",
        "refs/heads/jig-data",
      ]),
    ).toBe("Resolve Jig sync conflict");
    expect(
      await git(ROOT, [
        "show",
        "refs/heads/jig-data:tasks/" + shared.id + ".json",
      ]),
    ).toContain('"title": "Local conflict choice"');
  } finally {
    await rm(REJECT_HOOK, { force: true });
    await rm(writer, { recursive: true, force: true });
  }
});
