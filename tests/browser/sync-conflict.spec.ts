import { expect, test, type Page } from "@playwright/test";

import { serializeSnapshot } from "../../src/core/portable";
import {
  buildJigDataConflictCase,
} from "../../src/core/synchronization-recovery";
import { validateTask, type Task } from "../../src/core/task";
import {
  apiState,
  resetCanonicalTasks,
} from "./helpers";

const ROOT = "/tmp/jig-playwright-repository";
const REMOTE = "/tmp/jig-playwright-remote.git";

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
  const conflictCase = resolverThemeConflictCase();
  let resolved = false;

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
            state: resolved ? "synchronized" : "sync-issue",
            remote_name: "origin",
            remote_location: REMOTE,
          },
        },
      }),
    });
  });
  await page.route("**/api/v1/sync/conflict", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(resolved ? null : conflictCase),
    });
  });
  await page.route(
    "**/api/v1/sync/conflict/resolve",
    async (route) => {
      const payload = JSON.parse(
        route.request().postData() ?? "null",
      ) as Record<string, unknown>;
      expect(payload).toMatchObject({
        ancestor_head: conflictCase.ancestor_head,
        local_head: conflictCase.local_head,
        remote_head: conflictCase.remote_head,
        expected_revision: conflictCase.expected_revision,
      });
      resolved = true;
      await route.fulfill({
        status: 202,
        contentType: "application/json",
        body: JSON.stringify({
          repository_status: {
            local_git: "committed",
            remote: {
              state: "synchronized",
              remote_name: "origin",
              remote_location: REMOTE,
            },
          },
        }),
      });
    },
  );

  const canonicalBefore = await apiState(page);
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
  await page.screenshot({
    path: test.info().outputPath(
      "v1.1-sync-conflict-desktop-choices.png",
    ),
    fullPage: true,
  });
  await desktopResolver.getByRole("radio").first().click();
  await expect(
    desktopResolver.getByRole("radio").first(),
  ).toBeChecked();
  await desktopResolver
    .getByRole("button", { name: "Next conflict", exact: true })
    .click();
  await desktopResolver
    .locator(".jig-sync-conflict-choice")
    .filter({ hasText: "Keep changed Task" })
    .click();
  await expect(
    desktopResolver.getByRole("heading", {
      name: "Review Task order",
      exact: true,
    }),
  ).toBeVisible();
  await page.screenshot({
    path: test.info().outputPath(
      "v1.1-sync-conflict-desktop-order-review.png",
    ),
    fullPage: true,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  const narrowResolver = page.getByRole("dialog", {
    name: "Resolve sync conflict",
  });
  await expect(narrowResolver).toBeVisible();
  await expect(
    narrowResolver.getByRole("heading", {
      name: "Review Task order",
      exact: true,
    }),
  ).toBeVisible();
  await page.screenshot({
    path: test.info().outputPath(
      "v1.1-sync-conflict-narrow-order-review.png",
    ),
    fullPage: true,
  });

  await page.setViewportSize({ width: 320, height: 844 });
  const resolverClose = narrowResolver.getByRole("button", {
    name: "Close",
    exact: true,
  });
  await expect(resolverClose).toBeVisible();
  const closeGeometry = await resolverClose.evaluate((button) => {
    const walker = document.createTreeWalker(
      button,
      NodeFilter.SHOW_TEXT,
    );
    let textNode: Node | null = walker.nextNode();
    while (
      textNode !== null &&
      textNode.textContent?.trim() !== "Close"
    ) {
      textNode = walker.nextNode();
    }
    if (textNode === null) {
      throw new Error("Resolver Close label text node unavailable");
    }
    const range = document.createRange();
    range.selectNode(textNode);
    const text = range.getBoundingClientRect();
    const control = button.getBoundingClientRect();
    return {
      controlLeft: control.left,
      controlRight: control.right,
      textLeft: text.left,
      textRight: text.right,
    };
  });
  expect(closeGeometry.textLeft).toBeGreaterThanOrEqual(
    closeGeometry.controlLeft - 1,
  );
  expect(closeGeometry.textRight).toBeLessThanOrEqual(
    closeGeometry.controlRight + 1,
  );
  await page.setViewportSize({ width: 390, height: 844 });

  await narrowResolver
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await expect(narrowResolver).toHaveCount(0);
  expect(await apiState(page)).toStrictEqual(canonicalBefore);
  await expect.poll(() => currentConflict(page)).not.toBeNull();

  await resolveAction.click();
  const reopened = page.getByRole("dialog", {
    name: "Resolve sync conflict",
  });
  await expect(reopened).toBeVisible();
  await page.screenshot({
    path: test.info().outputPath(
      "v1.1-sync-conflict-narrow-reopened-choices.png",
    ),
    fullPage: true,
  });
  await expect(
    reopened.getByRole("heading", {
      name: "Review Task order",
      exact: true,
    }),
  ).toHaveCount(0);

  await reopened.getByRole("radio").first().click();
  await expect(
    reopened.getByRole("radio").first(),
  ).toBeChecked();
  await reopened
    .getByRole("button", { name: "Next conflict", exact: true })
    .click();
  await reopened
    .locator(".jig-sync-conflict-choice")
    .filter({ hasText: "Keep changed Task" })
    .click();
  await reopened
    .getByRole("button", { name: "Confirm order", exact: true })
    .click();
  await expect(
    reopened.getByRole("heading", {
      name: "Resolution ready",
      exact: true,
    }),
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
  await expect.poll(() => currentConflict(page)).toBeNull();
  expect(await apiState(page)).toStrictEqual(canonicalBefore);
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
      if (theme === "jig") {
        await page.screenshot({
          path: test.info().outputPath(
            `v1.1-sync-conflict-jig-${mode}-technical.png`,
          ),
          fullPage: true,
        });
      }

      await technicalTrigger.click();
      await resolver.getByRole("radio").first().click();
      await expect(radios.first()).toBeChecked();
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
      await resolver
        .getByText("Keep changed Task", { exact: true })
        .click();

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
      await page.screenshot({
        path: test.info().outputPath(
          `v1.1-sync-conflict-${theme}-${mode}-final.png`,
        ),
        fullPage: true,
      });

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
