import { expect, test, type Page, type Request } from "@playwright/test";
import { apiState, resetCanonicalTasks } from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await resetCanonicalTasks(page);
  await page.reload();
});

async function navigateTo(
  page: Page,
  destination: "History" | "Settings",
): Promise<void> {
  const direct = page.getByRole("button", {
    name: destination,
    exact: true,
  });
  if (await direct.isVisible()) {
    await direct.click();
    return;
  }

  await page
    .getByRole("navigation", { name: "Primary" })
    .getByRole("button", { name: destination, exact: true })
    .click();
}

async function openGlobalAdd(page: Page): Promise<void> {
  const desktopAdd = page
    .locator(".jig-header-right")
    .getByRole("button", { name: "Add task", exact: true });
  if (await desktopAdd.isVisible()) {
    await desktopAdd.click();
    return;
  }

  await page
    .getByRole("button", { name: "Add task", exact: true })
    .last()
    .click();
}

async function addTitleOnlyTask(page: Page, title: string): Promise<void> {
  await openGlobalAdd(page);
  const workspace = page.getByRole("dialog", { name: "Add task" });
  await expect(workspace).toBeVisible();
  await workspace.getByLabel("Title").fill(title);
  await workspace.getByRole("button", { name: "Add task", exact: true }).click();
  await expect(workspace).toBeHidden();
  await expect(
    page.locator(".jig-task-card").filter({ hasText: title }).first(),
  ).toBeVisible();

  const detail = page.getByRole("dialog", { name: title });
  if (await detail.isVisible()) {
    await detail.getByRole("button", { name: "Close" }).click();
    await expect(detail).toBeHidden();
  }
}

test("real runtime supports title-first create, completion, History and reopen", async ({ page }) => {
  await expect(page.getByRole("button", { name: "Planner home" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Day", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Week", exact: true })).toHaveCount(0);

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
  const historyView = page.locator(".jig-history-view");
  await expect(
    historyView.getByText("Browser acceptance task", { exact: true }),
  ).toBeVisible();

  const historyRow = historyView
    .getByText("Browser acceptance task", { exact: true })
    .locator("xpath=ancestor::li[1]");
  await historyRow
    .getByRole("button", { name: "Actions for Browser acceptance task" })
    .click();
  await page
    .getByRole("menuitem", { name: "Reopen", exact: true })
    .click();
  await expect(
    historyView.getByText("Browser acceptance task", { exact: true }),
  ).toBeHidden();
});

test("stale revisions refetch canonical state and never blindly replay a mutation", async ({ page }) => {
  await addTitleOnlyTask(page, "Stale view seed");

  await openGlobalAdd(page);
  const workspace = page.getByRole("dialog", { name: "Add task" });
  await expect(workspace).toBeVisible();
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
  await expect(
    page.getByText("This view was out of date.", { exact: false }).first(),
  ).toBeVisible({ timeout: 5_000 });
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

test("configured presenter replacement preserves controller state and appearance remains presentation-only", async ({ page }) => {
  await page.setViewportSize({ width: 1168, height: 900 });
  await expect(
    page.locator('[data-jig-configured-presentation="desktop"]'),
  ).toHaveCount(1);
  await expect(
    page.locator('[data-jig-configured-presentation="narrow"]'),
  ).toHaveCount(0);

  await openGlobalAdd(page);
  let workspace = page.getByRole("dialog", { name: "Add task" });
  await workspace.getByLabel("Title").fill("Draft survives presenter replacement");

  let canonicalReadsDuringReflow = 0;
  let commandsDuringReflow = 0;
  const observeReflowRequest = (request: Request): void => {
    const url = new URL(request.url());
    if (url.pathname === "/api/v1/tasks" && request.method() === "GET") {
      canonicalReadsDuringReflow += 1;
    }
    if (url.pathname === "/api/v1/commands" && request.method() === "POST") {
      commandsDuringReflow += 1;
    }
  };
  page.on("request", observeReflowRequest);

  await page.setViewportSize({ width: 1167, height: 900 });
  await expect(
    page.locator('[data-jig-configured-presentation="desktop"]'),
  ).toHaveCount(0);
  await expect(
    page.locator('[data-jig-configured-presentation="narrow"]'),
  ).toHaveCount(1);
  workspace = page.getByRole("dialog", { name: "Add task" });
  await expect(workspace).toBeVisible();
  await expect(workspace.getByLabel("Title")).toHaveValue(
    "Draft survives presenter replacement",
  );

  await page.setViewportSize({ width: 1168, height: 900 });
  await expect(
    page.locator('[data-jig-configured-presentation="desktop"]'),
  ).toHaveCount(1);
  workspace = page.getByRole("dialog", { name: "Add task" });
  await expect(workspace.getByLabel("Title")).toHaveValue(
    "Draft survives presenter replacement",
  );
  page.off("request", observeReflowRequest);
  expect(canonicalReadsDuringReflow).toBe(0);
  expect(commandsDuringReflow).toBe(0);
  await workspace.getByRole("button", { name: "Cancel", exact: true }).click();

  await navigateTo(page, "Settings");
  await page.setViewportSize({ width: 1167, height: 900 });
  await expect(
    page
      .getByRole("navigation", { name: "Primary" })
      .getByRole("button", { name: "Settings", exact: true }),
  ).toHaveAttribute("aria-current", "page");

  const before = await page.evaluate(async () => fetch("/api/v1/tasks").then((r) => r.json()));
  await page.getByText("Dark", { exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem("jig-appearance-mode")),
    )
    .toBe("dark");
  const after = await page.evaluate(async () => fetch("/api/v1/tasks").then((r) => r.json()));
  expect(after).toEqual(before);
});

test("System, Light and Dark use the canonical Jig theme and remain presentation-only", async ({
  page,
}) => {
  await expect(page.locator(".jig-logo:visible")).toHaveCount(1);
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

  await navigateTo(page, "Settings");
  await expect(
    page.getByRole("heading", { name: "Settings", exact: true }),
  ).toBeVisible();

  for (const [label, stored] of [
    ["Light", "light"],
    ["Dark", "dark"],
    ["System", "system"],
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
        page.evaluate(() => localStorage.getItem("jig-appearance-mode")),
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
