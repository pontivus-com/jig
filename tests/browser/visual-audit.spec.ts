import { dirname } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";

import { expect, test, type Page, type TestInfo } from "@playwright/test";

import { serializeSnapshot } from "../../src/core/portable";
import { buildJigDataConflictCase } from "../../src/core/synchronization-recovery";
import { validateTask, type Task } from "../../src/core/task";
import {
  apiCommand,
  apiState,
  browserCivilDate,
  resetCanonicalTasks,
  taskByTitle,
} from "./helpers";

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  narrow: { width: 390, height: 844 },
  desktopStress: { width: 1280, height: 800 },
  narrowStress: { width: 320, height: 844 },
} as const;

const THEMES = [
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

const NARROW_THEME_SAMPLE = new Set(["jig", "solarized", "tokyo-night"]);

type AuditEntry = {
  scenario: string;
  viewport: string;
  presentation: "desktop" | "narrow";
  theme: string | null;
  appearance: string | null;
  file: string;
};

async function settleVisualState(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
    const finiteAnimations = document.getAnimations().filter((animation) => {
      const timing = animation.effect?.getComputedTiming();
      return (
        timing !== undefined &&
        Number.isFinite(timing.endTime) &&
        timing.endTime > 0 &&
        animation.playState !== "finished"
      );
    });
    await Promise.all(
      finiteAnimations.map((animation) =>
        animation.finished.catch(() => undefined),
      ),
    );
  });

  await expect
    .poll(async () =>
      page.evaluate(async () => {
        const snapshot = () =>
          JSON.stringify(
            Array.from(
              document.querySelectorAll<HTMLElement>(
                ".jig-app-header, #astryx-app-shell-main, [role='dialog'], .jig-mobile-bottom-nav, .jig-mobile-add-fab",
              ),
            )
              .filter((element) => {
                const style = getComputedStyle(element);
                const box = element.getBoundingClientRect();
                return (
                  style.display !== "none" &&
                  style.visibility !== "hidden" &&
                  box.width > 0 &&
                  box.height > 0
                );
              })
              .map((element) => {
                const box = element.getBoundingClientRect();
                return [
                  element.getAttribute("role") ?? element.className,
                  Math.round(box.x * 10) / 10,
                  Math.round(box.y * 10) / 10,
                  Math.round(box.width * 10) / 10,
                  Math.round(box.height * 10) / 10,
                ];
              }),
          );
        const first = snapshot();
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() =>
            requestAnimationFrame(() => resolve()),
          ),
        );
        return first === snapshot();
      }),
    )
    .toBe(true);

  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow, "document horizontal overflow").toBeLessThanOrEqual(1);
}

async function assertPresentation(
  page: Page,
  presentation: "desktop" | "narrow",
): Promise<void> {
  if (presentation === "desktop") {
    await expect(page.locator(".jig-app-header-desktop")).toBeVisible();
    await expect(page.locator(".jig-app-header-narrow")).toHaveCount(0);
    return;
  }
  await expect(page.locator(".jig-app-header-narrow")).toBeVisible();
  await expect(page.locator(".jig-app-header-desktop")).toHaveCount(0);
}

async function capture(
  page: Page,
  testInfo: TestInfo,
  entries: AuditEntry[],
  scenario: string,
  presentation: "desktop" | "narrow",
  viewport: { width: number; height: number },
): Promise<void> {
  await page.setViewportSize(viewport);
  await assertPresentation(page, presentation);
  await settleVisualState(page);

  const appearance = await page.evaluate(() => ({
    theme: document.documentElement.getAttribute("data-astryx-theme"),
    mode: document.documentElement.getAttribute("data-theme"),
  }));

  const viewportLabel = `${viewport.width}x${viewport.height}`;
  const fileName =
    `${scenario}__${presentation}-${viewportLabel}.png`;
  const outputPath = testInfo.outputPath("visual-audit", fileName);
  await mkdir(dirname(outputPath), { recursive: true });
  await page.screenshot({
    path: outputPath,
    fullPage: true,
    animations: "disabled",
    caret: "hide",
  });

  entries.push({
    scenario,
    viewport: viewportLabel,
    presentation,
    theme: appearance.theme,
    appearance: appearance.mode,
    file: fileName,
  });
}

async function capturePair(
  page: Page,
  testInfo: TestInfo,
  entries: AuditEntry[],
  scenario: string,
): Promise<void> {
  await capture(
    page,
    testInfo,
    entries,
    scenario,
    "desktop",
    VIEWPORTS.desktop,
  );
  await capture(
    page,
    testInfo,
    entries,
    scenario,
    "narrow",
    VIEWPORTS.narrow,
  );
}

async function writeManifest(
  testInfo: TestInfo,
  entries: AuditEntry[],
): Promise<void> {
  const path = testInfo.outputPath("visual-audit", "manifest.json");
  await mkdir(dirname(path), { recursive: true });
  await writeFile(
    path,
    JSON.stringify(
      {
        commit:
          process.env.GITHUB_SHA ??
          process.env.GITHUB_HEAD_SHA ??
          "local",
        run_id: process.env.GITHUB_RUN_ID ?? null,
        standard: "docs/design/ux-ui-visual-audit-standard.md",
        entries,
      },
      null,
      2,
    ) + "\n",
  );
}

async function createTask(
  page: Page,
  title: string,
  date: string,
  priority: "HIGH" | "NORMAL" | "LOW" = "NORMAL",
  changes: {
    context?: string | null;
    reference?: string | null;
    note?: string | null;
  } = {},
): Promise<void> {
  await apiCommand(page, {
    type: "create",
    title,
    scheduled_date: date,
    priority,
    context: changes.context ?? null,
    reference: changes.reference ?? null,
    note: changes.note ?? null,
    reminder_time: null,
  });
}

async function syncNow(page: Page): Promise<void> {
  await page.evaluate(async () => {
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
  });
}

async function setAppearance(
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

function resolverConflictCase() {
  const datasetId = "018f47f0-7b5c-7d4d-8e2b-00000000b001";
  const firstId = "018f47f0-7b5c-7d4d-8e2b-00000000b101";
  const secondId = "018f47f0-7b5c-7d4d-8e2b-00000000b102";
  const thirdId = "018f47f0-7b5c-7d4d-8e2b-00000000b103";
  const ancestorFirst = resolverTask(firstId, "Conflict A", 0);
  const ancestorSecond = resolverTask(secondId, "Conflict B", 1);
  const stable = resolverTask(thirdId, "Stable Task", 2);

  const conflict = buildJigDataConflictCase(
    "a".repeat(40),
    "b".repeat(40),
    "c".repeat(40),
    12,
    serializeSnapshot(
      [ancestorFirst, ancestorSecond, stable],
      datasetId,
    ),
    serializeSnapshot(
      [
        resolverTask(firstId, "Local A", 0, {
          updated_at: "2026-11-22T12:10:00.000Z",
        }),
        stable,
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
        stable,
      ],
      datasetId,
    ),
  );
  if (conflict === null) {
    throw new Error("Expected visual-audit conflict case");
  }
  return conflict;
}

test("canonical configured surfaces and constrained stress states", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const entries: AuditEntry[] = [];
  await page.goto("/");
  await resetCanonicalTasks(page);

  const today = await browserCivilDate(page);
  const tomorrow = await browserCivilDate(page, 1);
  await createTask(
    page,
    "High priority quarterly planning review with deliberately long but valid title",
    today,
    "HIGH",
    {
      context: "Deep work / planning",
      reference:
        "https://example.com/projects/quarterly-planning/review/reference",
    },
  );
  await createTask(page, "Tomorrow follow-up", tomorrow, "NORMAL");
  await createTask(page, "Completed evidence", today, "LOW");
  const completed = await taskByTitle(page, "Completed evidence");
  await apiCommand(page, {
    type: "complete",
    task_id: completed.id,
  });
  await page.reload();

  await capturePair(page, testInfo, entries, "planner-populated");

  await page.setViewportSize(VIEWPORTS.desktopStress);
  await capture(
    page,
    testInfo,
    entries,
    "planner-populated-stress",
    "desktop",
    VIEWPORTS.desktopStress,
  );
  await capture(
    page,
    testInfo,
    entries,
    "planner-populated-stress",
    "narrow",
    VIEWPORTS.narrowStress,
  );

  await page.setViewportSize(VIEWPORTS.desktop);
  await page.getByRole("button", { name: "History", exact: true }).click();
  await capturePair(page, testInfo, entries, "history-populated");

  await page.setViewportSize(VIEWPORTS.desktop);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await capturePair(page, testInfo, entries, "settings-default");

  await page.setViewportSize(VIEWPORTS.desktop);
  await page
    .getByRole("button", { name: "Show diagnostics", exact: true })
    .click();
  await capturePair(page, testInfo, entries, "settings-diagnostics");
  await capture(
    page,
    testInfo,
    entries,
    "settings-diagnostics-stress",
    "desktop",
    VIEWPORTS.desktopStress,
  );
  await capture(
    page,
    testInfo,
    entries,
    "settings-diagnostics-stress",
    "narrow",
    VIEWPORTS.narrowStress,
  );

  await page.setViewportSize(VIEWPORTS.desktop);
  await page.getByRole("button", { name: "Planner", exact: true }).click();
  await page
    .getByText(
      "High priority quarterly planning review with deliberately long but valid title",
      { exact: true },
    )
    .click();
  await capturePair(page, testInfo, entries, "task-edit-default");

  await page.setViewportSize(VIEWPORTS.desktop);
  const workspace = page.getByRole("dialog", {
    name: "High priority quarterly planning review with deliberately long but valid title",
  });
  const repeat = workspace.getByRole("combobox", { name: "Repeat" });
  await repeat.click();
  await page.getByRole("option", { name: "Weekly", exact: true }).click();
  await capturePair(page, testInfo, entries, "task-edit-weekly");
  await capture(
    page,
    testInfo,
    entries,
    "task-edit-weekly-stress",
    "desktop",
    VIEWPORTS.desktopStress,
  );
  await capture(
    page,
    testInfo,
    entries,
    "task-edit-weekly-stress",
    "narrow",
    VIEWPORTS.narrowStress,
  );

  await page.setViewportSize(VIEWPORTS.narrow);
  await page.getByRole("dialog").getByRole("button", {
    name: "Close",
    exact: true,
  }).click();
  await page.setViewportSize(VIEWPORTS.desktop);
  await settleVisualState(page);

  await resetCanonicalTasks(page);
  await page.reload();
  await capturePair(page, testInfo, entries, "planner-empty");
  await page.setViewportSize(VIEWPORTS.desktop);
  await page.getByRole("button", { name: "History", exact: true }).click();
  await capturePair(page, testInfo, entries, "history-empty");

  await writeManifest(testInfo, entries);
});

test("onboarding is reviewed as paired presentation evidence", async ({
  page,
}, testInfo) => {
  test.setTimeout(60_000);
  const entries: AuditEntry[] = [];

  await page.route("**/api/v1/setup/status", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        mode: "bootstrap",
        local_repository_available: true,
      }),
    });
  });
  await page.route("**/api/v1/github/status", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        onboarding_available: true,
        reconnect_available: false,
      }),
    });
  });
  await page.route("**/api/v1/setup/github/connect", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        available: true,
        state: "connecting",
        authorization: null,
        provider_url: null,
        repositories: [],
        error: null,
      }),
    });
  });
  await page.route("**/api/v1/setup/github/state", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        available: true,
        state: "repository-selection",
        authorization: null,
        provider_url: null,
        repositories: [
          {
            id: 42,
            owner: "pontivus-com",
            name: "planning",
            clone_url: "https://github.com/pontivus-com/planning.git",
            installation_id: 7,
            account_login: "pontivus-com",
            account_type: "Organization",
          },
          {
            id: 43,
            owner: "pontivus-com",
            name: "planning-archive-with-a-long-valid-repository-name",
            clone_url:
              "https://github.com/pontivus-com/planning-archive-with-a-long-valid-repository-name.git",
            installation_id: 7,
            account_login: "pontivus-com",
            account_type: "Organization",
          },
        ],
        error: null,
      }),
    });
  });

  await page.setViewportSize(VIEWPORTS.desktop);
  await page.goto("/");
  await expect(
    page.locator('[data-jig-setup-presentation="desktop"]'),
  ).toBeVisible();
  await capturePair(page, testInfo, entries, "onboarding-initial");

  await page.setViewportSize(VIEWPORTS.desktop);
  await page.getByRole("button", {
    name: "Connect GitHub repository",
    exact: true,
  }).click();
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(
    page.getByRole("heading", {
      name: "Choose your planning repository",
      exact: true,
    }),
  ).toBeVisible();
  await capturePair(
    page,
    testInfo,
    entries,
    "onboarding-repository-choice",
  );

  await writeManifest(testInfo, entries);
});

test("sync resolver choices order and final confirmation are settled pairs", async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  const entries: AuditEntry[] = [];
  const conflict = resolverConflictCase();

  await page.goto("/");
  await resetCanonicalTasks(page);
  await syncNow(page);

  await page.route("**/api/v1/status", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ready: true,
        repository_path: "/tmp/jig-playwright-repository",
        repository_status: {
          local_git: "committed",
          remote: {
            state: "sync-issue",
            remote_name: "origin",
            remote_location: "/tmp/jig-playwright-remote.git",
          },
        },
      }),
    });
  });
  await page.route("**/api/v1/sync/conflict", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(conflict),
    });
  });

  await page.reload();
  await page.setViewportSize(VIEWPORTS.desktop);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", {
    name: "Resolve sync conflict",
    exact: true,
  }).click();

  const resolver = page.getByRole("dialog", {
    name: "Resolve sync conflict",
  });
  await expect(resolver).toBeVisible();
  await capturePair(page, testInfo, entries, "resolver-choices");

  await page.setViewportSize(VIEWPORTS.desktop);
  await resolver.getByRole("button", {
    name: "Technical details",
    exact: true,
  }).click();
  await capturePair(page, testInfo, entries, "resolver-technical");

  await page.setViewportSize(VIEWPORTS.desktop);
  await resolver.getByRole("button", {
    name: "Technical details",
    exact: true,
  }).click();
  await resolver.getByRole("radio").first().click();
  await resolver.getByRole("button", {
    name: "Next conflict",
    exact: true,
  }).click();
  await resolver
    .locator(".jig-sync-conflict-choice")
    .filter({ hasText: "Keep changed Task" })
    .click();
  await expect(
    resolver.getByRole("heading", {
      name: "Review Task order",
      exact: true,
    }),
  ).toBeVisible();
  await capturePair(page, testInfo, entries, "resolver-order-review");
  await capture(
    page,
    testInfo,
    entries,
    "resolver-order-review-stress",
    "desktop",
    VIEWPORTS.desktopStress,
  );
  await capture(
    page,
    testInfo,
    entries,
    "resolver-order-review-stress",
    "narrow",
    VIEWPORTS.narrowStress,
  );

  await page.setViewportSize(VIEWPORTS.desktop);
  await resolver.getByRole("button", {
    name: "Confirm order",
    exact: true,
  }).click();
  await expect(
    resolver.getByRole("heading", {
      name: "Resolution ready",
      exact: true,
    }),
  ).toBeVisible();
  await capturePair(page, testInfo, entries, "resolver-resolution-ready");

  await writeManifest(testInfo, entries);
});

test("theme visual matrix is constrained to one full desktop surface plus representative narrow families", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  const entries: AuditEntry[] = [];
  await page.goto("/");
  await resetCanonicalTasks(page);
  const today = await browserCivilDate(page);
  await createTask(page, "Theme surface evidence", today, "HIGH");

  for (const theme of THEMES) {
    for (const mode of ["light", "dark"] as const) {
      await page.setViewportSize(VIEWPORTS.desktop);
      await setAppearance(page, theme, mode);
      await capture(
        page,
        testInfo,
        entries,
        `theme-${theme}-${mode}`,
        "desktop",
        VIEWPORTS.desktop,
      );

      if (NARROW_THEME_SAMPLE.has(theme)) {
        await capture(
          page,
          testInfo,
          entries,
          `theme-${theme}-${mode}`,
          "narrow",
          VIEWPORTS.narrow,
        );
      }
    }
  }

  await writeManifest(testInfo, entries);
});

test("the governed 73rem boundary selects presentation only", async ({
  page,
}) => {
  await page.goto("/");
  await page.setViewportSize({ width: 1168, height: 844 });
  await expect(page.locator(".jig-app-header-desktop")).toBeVisible();
  await expect(page.locator(".jig-app-header-narrow")).toHaveCount(0);

  await page.setViewportSize({ width: 1167, height: 844 });
  await expect(page.locator(".jig-app-header-narrow")).toBeVisible();
  await expect(page.locator(".jig-app-header-desktop")).toHaveCount(0);
});
