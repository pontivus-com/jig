import { expect, test, type Page } from "@playwright/test";
import { resetCanonicalTasks } from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await resetCanonicalTasks(page);
  await page.reload();
});

async function addTitleOnlyTask(page: Page, title: string): Promise<void> {
  await page.getByRole("button", { name: "Add task", exact: true }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Start with a title. Everything else is optional.")).toBeVisible();
  await dialog.getByLabel("Title").fill(title);
  await dialog.getByRole("button", { name: "Add task", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText(title, { exact: true })).toBeVisible();
}

test("real runtime supports title-first create, completion, History and reopen", async ({ page }) => {
  await expect(page.getByRole("heading", { name: /–/ })).toBeVisible();

  await addTitleOnlyTask(page, "Browser acceptance task");
  await page.getByLabel("Complete Browser acceptance task").click();

  await page.getByRole("button", { name: "History", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Completed work", exact: true })).toBeVisible();
  await expect(page.getByText("Browser acceptance task", { exact: true })).toBeVisible();

  await page.getByLabel("Reopen Browser acceptance task").click();
  await expect(page.getByText("Browser acceptance task", { exact: true })).toBeHidden();
});

test("stale revisions refetch canonical state and never blindly replay a mutation", async ({ page }) => {
  await addTitleOnlyTask(page, "Stale view seed");

  await page.getByRole("button", { name: "Add task", exact: true }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Title").fill("Must not replay");

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

  await dialog.getByRole("button", { name: "Add task", exact: true }).click();
  await expect(dialog.getByText("This view was out of date.", { exact: false })).toBeVisible();
  const tasks = await page.evaluate(async () => {
    const state = await fetch("/api/v1/tasks").then((response) => response.json()) as {
      tasks: Array<{ title: string }>;
    };
    return state.tasks.map((task) => task.title);
  });
  expect(tasks).toContain("Concurrent canonical task");
  expect(tasks.filter((title) => title === "Must not replay")).toHaveLength(0);

  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
});

test("responsive reflow preserves an open editor draft and appearance remains presentation-only", async ({ page }) => {
  await page.getByRole("button", { name: "Add task", exact: true }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Title").fill("Draft survives reflow");

  await page.setViewportSize({ width: 640, height: 900 });
  await expect(dialog.getByLabel("Title")).toHaveValue("Draft survives reflow");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();

  const before = await page.evaluate(async () => fetch("/api/v1/tasks").then((r) => r.json()));
  await page.getByRole("button", { name: "Settings", exact: true }).click();
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
    page.getByRole("heading", { name: "Jig settings", exact: true }),
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
