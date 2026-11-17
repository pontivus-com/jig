import { expect, test, type Page } from "@playwright/test";
import { apiState, resetCanonicalTasks } from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await resetCanonicalTasks(page);
  await page.reload();
});

async function navigateTo(
  page: Page,
  destination: "Week" | "Day" | "History" | "Settings",
): Promise<void> {
  const navigation = page
    .locator(".jig-primary-nav")
    .getByRole("button", { name: destination, exact: true });
  if (await navigation.isVisible()) {
    await navigation.click();
    return;
  }

  await page.locator(".jig-mobile-destination-trigger").click();
  await page
    .locator(".jig-primary-nav")
    .getByRole("button", { name: destination, exact: true })
    .click();
}

async function addTitleOnlyTask(page: Page, title: string): Promise<void> {
  await page.getByRole("button", { name: /Add task$/ }).first().click();
  const workspace = page.locator('section[aria-label="Add task"]');
  await expect(workspace).toBeVisible();
  await workspace.getByLabel("Title").fill(title);
  await workspace.getByRole("button", { name: "Add task", exact: true }).click();
  await expect(workspace).toBeHidden();
  await expect(
    page.locator(".jig-task-card").filter({ hasText: title }).first(),
  ).toBeVisible();
}

test("real runtime supports title-first create, completion, History and reopen", async ({ page }) => {
  await expect(
    page.getByRole("button", { name: "Day", exact: true }),
  ).toHaveAttribute("aria-current", "page");

  await addTitleOnlyTask(page, "Browser acceptance task");
  await page.getByLabel("Complete Browser acceptance task").click();
  await expect
    .poll(async () =>
      (await apiState(page)).tasks.find(
        (task) => task.title === "Browser acceptance task",
      )?.completed_at ?? null,
    )
    .not.toBeNull();

  await page.getByRole("button", { name: "History", exact: true }).click();
  await expect(page.getByRole("heading", { name: "History", exact: true })).toBeVisible();
  await expect(page.getByText("Browser acceptance task", { exact: true })).toBeVisible();

  const historyRow = page
    .getByText("Browser acceptance task", { exact: true })
    .locator("xpath=ancestor::li[1]");
  await historyRow
    .getByRole("button", { name: "Actions for Browser acceptance task" })
    .click();
  await page
    .getByRole("menuitem", { name: "Reopen", exact: true })
    .click();
  await expect(page.getByText("Browser acceptance task", { exact: true })).toBeHidden();
});

test("stale revisions refetch canonical state and never blindly replay a mutation", async ({ page }) => {
  await addTitleOnlyTask(page, "Stale view seed");

  await page.getByRole("button", { name: /Add task$/ }).first().click();
  const workspace = page.locator('section[aria-label="Add task"]');
  await workspace.getByLabel("Title").fill("Must not replay");

  await page.evaluate(async () => {
    const state = await fetch("/api/v1/tasks").then((response) => response.json()) as {
      revision: number;
    };
    const token = (window as typeof window & { __JIG_WRITE_TOKEN__?: string }).__JIG_WRITE_TOKEN__;
    if (token === undefined) throw new Error("write token unavailable");
    const response = await fetch("/api/v1/commands", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-jig-write-token": token,
      },
      body: JSON.stringify({
        expected_revision: state.revision,
        command: {
          type: "create",
          title: "Concurrent canonical task",
          scheduled_date: new Date().toLocaleDateString("en-CA"),
          priority: "NORMAL",
          context: null,
          reference: null,
          note: null,
          reminder_time: null,
        },
      }),
    });
    if (!response.ok) throw new Error("concurrent mutation failed");
  });

  await workspace.getByRole("button", { name: "Add task", exact: true }).click();
  await expect(workspace.getByText("This view was out of date.", { exact: false })).toBeVisible();
  const tasks = await page.evaluate(async () => {
    const state = await fetch("/api/v1/tasks").then((response) => response.json()) as {
      tasks: Array<{ title: string }>;
    };
    return state.tasks.map((task) => task.title);
  });
  expect(tasks).toContain("Concurrent canonical task");
  expect(tasks.filter((title) => title === "Must not replay")).toHaveLength(0);

  await workspace.getByRole("button", { name: "Cancel", exact: true }).click();
});

test("responsive reflow preserves an open workspace draft and appearance remains presentation-only", async ({ page }) => {
  await page.getByRole("button", { name: /Add task$/ }).first().click();
  const dockedWorkspace = page.locator('section[aria-label="Add task"]');
  await dockedWorkspace.getByLabel("Title").fill("Draft survives reflow");

  await page.setViewportSize({ width: 640, height: 900 });
  const drawer = page.getByRole("dialog", { name: "Add task" });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByLabel("Title")).toHaveValue("Draft survives reflow");
  await drawer.getByRole("button", { name: "Cancel", exact: true }).click();

  const before = await page.evaluate(async () => fetch("/api/v1/tasks").then((r) => r.json()));
  await navigateTo(page, "Settings");
  await page.getByText("Dark", { exact: true }).click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("jig-theme"))).toBe("dark");
  const after = await page.evaluate(async () => fetch("/api/v1/tasks").then((r) => r.json()));
  expect(after).toEqual(before);
});

test("System, Light and Dark use the canonical Jig theme and remain presentation-only", async ({
  page,
}) => {
  await expect(page.locator(".jig-brand-logo:visible")).toHaveCount(1);
  await expect
    .poll(() =>
      page.evaluate(() =>
        document.documentElement.getAttribute("data-astryx-theme"),
      ),
    )
    .toBe("jig");

  const resolvedColors = async (): Promise<{
    background: string;
    accent: string;
  }> =>
    page.evaluate(() => {
      const probe = document.createElement("div");
      probe.style.color = "var(--color-accent)";
      document.body.append(probe);
      const accent = getComputedStyle(probe).color;
      probe.remove();
      return {
        background: getComputedStyle(document.body).backgroundColor,
        accent,
      };
    });

  const before = await page.evaluate(async () =>
    fetch("/api/v1/tasks").then((response) => response.json()),
  );

  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Settings", exact: true }),
  ).toBeVisible();

  for (const [label, stored] of [
    ["Light", "light"],
    ["Dark", "dark"],
    ["System", null],
  ] as const) {
    const option = page.getByRole("radio", {
      name: label,
      exact: true,
    });
    await option.click();
    await expect(option).toHaveAttribute("aria-checked", "true");
    await expect(
      page.getByRole("heading", { name: "Appearance", exact: true }),
    ).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() => localStorage.getItem("jig-theme")),
      )
      .toBe(stored);

    if (label === "Light") {
      await expect
        .poll(() => resolvedColors())
        .toEqual({
          background: "rgb(247, 244, 239)",
          accent: "rgb(184, 108, 0)",
        });
    }
    if (label === "Dark") {
      await expect
        .poll(() => resolvedColors())
        .toEqual({
          background: "rgb(11, 20, 38)",
          accent: "rgb(245, 158, 11)",
        });
    }
  }

  const after = await page.evaluate(async () =>
    fetch("/api/v1/tasks").then((response) => response.json()),
  );
  expect(after).toEqual(before);
});
