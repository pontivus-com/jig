import { execFile } from "node:child_process";
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

import { serializeSnapshot } from "../../src/core/portable";
import {
  buildJigDataConflictCase,
} from "../../src/core/synchronization-recovery";
import { validateTask, type Task } from "../../src/core/task";

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
  return new Promise((resolve, reject) => {
    execFile(
      "git",
      [...args],
      { cwd, encoding: "utf8" },
      (error, stdout, stderr) => {
        if (error !== null) {
          reject(
            new Error(
              "git " +
                args.join(" ") +
                " failed: " +
                (stderr || stdout),
            ),
          );
          return;
        }
        resolve(stdout.trim());
      },
    );
  });
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

const RESOLVER_THEMES = [
  "jig",
  "astryx-neutral",
  "astryx-butter",
  "astryx-chocolate",
  "astryx-matcha",
  "astryx-stone",
  "astryx-y2k",
  "gruvbox",
  "dracula",
  "solarized",
  "nord",
  "catppuccin",
  "tokyo-night",
] as const;

function resolverTask(
  id: string,
  title: string,
  position: number,
  changes: Partial<Task> = {},
): Task {
  return validateTask({
    id,
    title,
    scheduled_date: "2026-11-22",
    position,
    priority: "NORMAL",
    context: null,
    reference: null,
    note: null,
    reminder_time: null,
    recurrence_series_id: null,
    recurrence_occurrence_date: null,
    completed_at: null,
    created_at: "2026-11-22T12:00:00.000Z",
    updated_at: "2026-11-22T12:00:00.000Z",
    ...changes,
  });
}

function resolverThemeConflictCase() {
  const datasetId =
    "018f47f0-7b5c-7d4d-8e2b-00000000a001";
  const firstId =
    "018f47f0-7b5c-7d4d-8e2b-00000000a101";
  const secondId =
    "018f47f0-7b5c-7d4d-8e2b-00000000a102";
  const thirdId =
    "018f47f0-7b5c-7d4d-8e2b-00000000a103";
  const ancestorFirst = resolverTask(firstId, "Theme conflict A", 0);
  const ancestorSecond = resolverTask(secondId, "Theme conflict B", 1);
  const ancestorThird = resolverTask(thirdId, "Theme stable C", 2);

  const conflictCase = buildJigDataConflictCase(
    "a".repeat(40),
    "b".repeat(40),
    "c".repeat(40),
    12,
    serializeSnapshot(
      [ancestorFirst, ancestorSecond, ancestorThird],
      datasetId,
    ),
    serializeSnapshot(
      [
        resolverTask(firstId, "Local A", 0, {
          updated_at: "2026-11-22T12:10:00.000Z",
        }),
        resolverTask(thirdId, "Theme stable C", 1),
      ],
      datasetId,
    ),
    serializeSnapshot(
      [
        resolverTask(firstId, "Remote A", 0, {
          note: "remote A",
          updated_at: "2026-11-22T12:20:00.000Z",
        }),
        resolverTask(secondId, "Remote changed B", 1, {
          note: "remote B",
          updated_at: "2026-11-22T12:21:00.000Z",
        }),
        ancestorThird,
      ],
      datasetId,
    ),
  );
  if (conflictCase === null) {
    throw new Error("Expected synthetic resolver conflict case");
  }
  return conflictCase;
}

async function setResolverAppearance(
  page: Page,
  theme: string,
  mode: "light" | "dark",
): Promise<void> {
  await page.evaluate(
    ({ themeValue, modeValue }) => {
      localStorage.setItem("jig-theme-family", themeValue);
      localStorage.setItem("jig-appearance-mode", modeValue);
      localStorage.removeItem("jig-theme");
    },
    { themeValue: theme, modeValue: mode },
  );
  await page.reload();
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


test("resolver states remain theme-safe across every Theme × Light/Dark combination", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const conflictCase = resolverThemeConflictCase();

  await page.route("**/api/v1/status", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ready: true,
        repository_path: ROOT,
        repository_status: {
          local_git: "committed",
          remote: {
            state: "sync-issue",
            remote_name: "origin",
            remote_location: REMOTE,
          },
        },
      }),
    });
  });
  await page.route("**/api/v1/sync/conflict", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(conflictCase),
    });
  });

  for (const theme of RESOLVER_THEMES) {
    for (const mode of ["light", "dark"] as const) {
      await page.setViewportSize({ width: 1440, height: 900 });
      await setResolverAppearance(page, theme, mode);
      await page
        .getByRole("button", { name: "Settings", exact: true })
        .click();
      const resolveAction = page.getByRole("button", {
        name: "Resolve sync conflict",
        exact: true,
      });
      await expect(resolveAction, theme + "/" + mode).toBeVisible();
      await resolveAction.click();

      const resolver = page.getByRole("dialog", {
        name: "Resolve sync conflict",
      });
      await expect(resolver, theme + "/" + mode).toBeVisible();
      const useResolution = resolver.getByRole("button", {
        name: "Use this resolution",
        exact: true,
      });
      await expect(useResolution).toBeDisabled();

      const radios = resolver.getByRole("radio");
      await expect(radios).toHaveCount(2);
      const neutralStyles = await radios.evaluateAll((elements) =>
        elements.map((element) => {
          const container =
            element.closest("label") ??
            element.parentElement ??
            element;
          const style = getComputedStyle(container);
          return {
            color: style.color,
            background: style.backgroundColor,
            border: style.borderColor,
          };
        }),
      );
      expect(
        neutralStyles[0],
        theme + "/" + mode + " Local/Remote neutral styling",
      ).toEqual(neutralStyles[1]);

      const technicalTrigger = resolver.getByRole("button", {
        name: "Technical details",
        exact: true,
      });
      await technicalTrigger.click();
      await expect(
        resolver.getByText("semantic-conflict", { exact: true }),
      ).toBeVisible();
      await expect(
        resolver.getByText("aaaaaaaaaaaa", { exact: true }),
      ).toBeVisible();
      await expect(
        resolver.getByText("bbbbbbbbbbbb", { exact: true }),
      ).toBeVisible();
      await expect(
        resolver.getByText("cccccccccccc", { exact: true }),
      ).toBeVisible();
      await expect(
        resolver.getByRole("button", {
          name: "Copy conflict JSON",
          exact: true,
        }),
      ).toBeVisible();
      await expect(resolver.locator("pre")).toContainText(
        '"kind": "task"',
      );

      await radios.first().check();
      await resolver
        .getByRole("button", {
          name: "Next conflict",
          exact: true,
        })
        .click();
      await expect(
        resolver.getByText("Keep deleted", { exact: true }),
      ).toBeVisible();
      await expect(
        resolver.getByText("Keep changed Task", { exact: true }),
      ).toBeVisible();
      await resolver.getByRole("radio").nth(1).check();

      await expect(
        resolver.getByRole("heading", {
          name: "Review Task order",
          exact: true,
        }),
      ).toBeVisible();
      await expect(useResolution).toBeDisabled();
      await expect(
        resolver.getByText("Theme stable C", { exact: true }),
      ).toBeVisible();

      const overflow = await resolver.evaluate(
        (element) => element.scrollWidth - element.clientWidth,
      );
      expect(
        overflow,
        theme + "/" + mode + " resolver horizontal overflow",
      ).toBeLessThanOrEqual(1);

      await resolver
        .getByRole("button", {
          name: "Confirm order",
          exact: true,
        })
        .click();
      await expect(
        resolver.getByRole("heading", {
          name: "Resolution ready",
          exact: true,
        }),
      ).toBeVisible();
      await expect(useResolution).toBeEnabled();

      const themeState = await page.evaluate(() => ({
        theme: document.documentElement.getAttribute(
          "data-astryx-theme",
        ),
        mode: document.documentElement.getAttribute("data-theme"),
      }));
      expect(themeState.theme).toBe(theme);
      expect(themeState.mode).toBe(mode);

      await resolver
        .getByRole("button", { name: "Cancel", exact: true })
        .click();
      await expect(resolver).toHaveCount(0);
    }
  }
});
