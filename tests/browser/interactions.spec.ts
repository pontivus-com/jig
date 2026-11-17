import {
  expect,
  test,
  type Page,
} from "@playwright/test";
import {
  apiCommand,
  apiState,
  browserCivilDate,
  resetCanonicalTasks,
  taskByTitle,
} from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await resetCanonicalTasks(page);
  await page.reload();
});

async function taskCard(page: Page, title: string) {
  return page
    .getByText(title, { exact: true })
    .locator("xpath=ancestor::li[contains(@class,'jig-task-card')][1]");
}

async function runTaskAction(
  page: Page,
  title: string,
  action: string,
): Promise<void> {
  const card = await taskCard(page, title);
  await card.getByRole("button", { name: `Actions for ${title}` }).click();
  await page.getByRole("menuitem", { name: action, exact: true }).click();
}

async function createTask(
  page: Page,
  title: string,
  scheduledDate: string,
  options: Readonly<{
    reference?: string | null;
    priority?: "HIGH" | "NORMAL" | "LOW";
  }> = {},
): Promise<void> {
  await apiCommand(page, {
    type: "create",
    title,
    scheduled_date: scheduledDate,
    priority: options.priority ?? "NORMAL",
    context: null,
    reference: options.reference ?? null,
    note: null,
    reminder_time: null,
  });
}

test("unfinished prior-day cards roll into today across Day and Week", async ({
  page,
}) => {
  const today = await browserCivilDate(page);
  const yesterday = await browserCivilDate(page, -1);
  await createTask(page, "Rollover contract", yesterday);
  await page.reload();

  await expect(
    page.getByRole("button", { name: "Day", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    page
      .locator(".jig-task-card")
      .filter({ hasText: "Rollover contract" })
      .first(),
  ).toBeVisible();

  await expect
    .poll(
      async () => (await taskByTitle(page, "Rollover contract")).scheduled_date,
    )
    .toBe(today);

  await page.getByRole("button", { name: "Week", exact: true }).click();
  const todayColumn = page.locator(`[data-date="${today}"]`);
  await expect(
    todayColumn.getByText("Rollover contract", { exact: true }),
  ).toBeVisible();

  const state = await apiState(page);
  expect(
    state.tasks.some(
      (task) =>
        task.title === "Rollover contract" &&
        task.scheduled_date === yesterday,
    ),
  ).toBe(false);

  await page.reload();
  expect(
    (await taskByTitle(page, "Rollover contract")).scheduled_date,
  ).toBe(today);
});

test("non-drag movement uses the same exact index semantics", async ({
  page,
}) => {
  const today = await browserCivilDate(page);
  await createTask(page, "First exact task", today);
  await createTask(page, "Second exact task", today);
  await page.reload();

  await runTaskAction(page, "First exact task", "Move down");

  await expect
    .poll(async () =>
      (await apiState(page)).tasks
        .filter(
          (task) =>
            task.completed_at === null &&
            task.scheduled_date === today,
        )
        .sort(
          (left, right) =>
            (left.position ?? 0) - (right.position ?? 0),
        )
        .map((task) => task.title),
    )
    .toEqual(["Second exact task", "First exact task"]);

  await runTaskAction(page, "First exact task", "Move up");

  await expect
    .poll(async () =>
      (await apiState(page)).tasks
        .filter(
          (task) =>
            task.completed_at === null &&
            task.scheduled_date === today,
        )
        .sort(
          (left, right) =>
            (left.position ?? 0) - (right.position ?? 0),
        )
        .map((task) => task.title),
    )
    .toEqual(["First exact task", "Second exact task"]);
});

test("priority edits preserve established manual order", async ({
  page,
}) => {
  const today = await browserCivilDate(page);
  await createTask(page, "Priority anchor", today);
  await createTask(page, "Priority edited task", today);
  await page.reload();

  const beforeOrder = (await apiState(page)).tasks
    .filter(
      (task) =>
        task.completed_at === null &&
        task.scheduled_date === today,
    )
    .sort(
      (left, right) =>
        (left.position ?? 0) - (right.position ?? 0),
    )
    .map((task) => task.id);

  await runTaskAction(page, "Priority edited task", "Edit");
  const workspace = page.locator('section[aria-label="Edit task Priority edited task"]');
  await expect(workspace).toBeVisible({ timeout: 5_000 });
  const highPriority = workspace.getByRole("radio", {
    name: "High",
    exact: true,
  });
  await highPriority.click({ timeout: 5_000 });
  await expect(highPriority).toHaveAttribute("aria-checked", "true");
  await workspace
    .getByRole("button", { name: "Save", exact: true })
    .click({ timeout: 5_000 });
  await expect(workspace).toBeHidden({ timeout: 5_000 });

  expect((await taskByTitle(page, "Priority edited task")).priority).toBe(
    "HIGH",
  );
  const afterOrder = (await apiState(page)).tasks
    .filter(
      (task) =>
        task.completed_at === null &&
        task.scheduled_date === today,
    )
    .sort(
      (left, right) =>
        (left.position ?? 0) - (right.position ?? 0),
    )
    .map((task) => task.id);
  expect(afterOrder).toEqual(beforeOrder);
});

test("optional metadata edits round-trip through the canonical Task", async ({
  page,
}) => {
  const today = await browserCivilDate(page);
  await createTask(page, "Editable metadata task", today);
  await page.reload();

  await runTaskAction(page, "Editable metadata task", "Edit");
  const workspace = page.locator('section[aria-label="Edit task Editable metadata task"]');
  await workspace.getByLabel("Context").fill("Client Alpha");
  await workspace
    .getByLabel("Reference")
    .fill("../matters/client-alpha");
  await workspace.getByLabel("Notes").fill("Prepare clause comments.");
  await workspace
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await expect(workspace).toBeHidden();

  const edited = await taskByTitle(page, "Editable metadata task");
  expect(edited.context).toBe("Client Alpha");
  expect(edited.reference).toBe("../matters/client-alpha");
  expect(edited.note).toBe("Prepare clause comments.");
});

test("Move to date uses the same task workspace and canonical exact move command", async ({
  page,
}) => {
  const today = await browserCivilDate(page);
  const tomorrow = await browserCivilDate(page, 1);
  await createTask(page, "Workspace move contract", today);
  await page.reload();

  await runTaskAction(page, "Workspace move contract", "Move to date…");
  const workspace = page.locator('section[aria-label="Move task Workspace move contract"]');
  await expect(workspace).toBeVisible();
  await workspace.getByLabel("Destination date").fill(tomorrow);
  await workspace.getByRole("button", { name: "Move task", exact: true }).click();

  await expect
    .poll(async () =>
      (await taskByTitle(page, "Workspace move contract")).scheduled_date,
    )
    .toBe(tomorrow);
  await expect(
    page.getByRole("complementary", {
      name: "Task details for Workspace move contract",
    }),
  ).toBeVisible();
});

test("real pointer drag moves a Task across dated Week drop zones", async ({
  page,
}) => {
  const today = await browserCivilDate(page);
  const dayOfWeek = await page.evaluate(() => new Date().getDay());
  const offset = dayOfWeek === 0 ? -1 : 1;
  const destinationDate = await browserCivilDate(page, offset);

  await createTask(page, "Pointer drag contract", today);
  await page.reload();
  await page.getByRole("button", { name: "Week", exact: true }).click();

  const card = await taskCard(page, "Pointer drag contract");
  const destination = page.locator(
    `[data-date="${destinationDate}"]`,
  );
  await expect(card).toBeVisible();
  await expect(destination).toBeVisible();

  const dragHandle = card.locator(".jig-task-drag-handle");
  const sourceBox = await dragHandle.boundingBox();
  const destinationBox = await destination.boundingBox();
  expect(sourceBox).not.toBeNull();
  expect(destinationBox).not.toBeNull();
  if (sourceBox === null || destinationBox === null) {
    throw new Error("Drag geometry unavailable");
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
    destinationBox.y + Math.min(120, destinationBox.height / 2),
    { steps: 12 },
  );
  await page.mouse.up();

  await expect
    .poll(
      async () =>
        (await taskByTitle(page, "Pointer drag contract")).scheduled_date,
    )
    .toBe(destinationDate);
});

test("references stay data-only: HTTP(S) opens and non-HTTP stays copy-only", async ({
  page,
}) => {
  const today = await browserCivilDate(page);
  await createTask(
    page,
    "Safe web reference",
    today,
    { reference: "https://example.com/legal" },
  );
  await createTask(
    page,
    "Copy-only reference",
    today,
    { reference: "../private/client-folder" },
  );
  await page.reload();

  const safeRow = page
    .getByText("Safe web reference", { exact: true })
    .locator("xpath=ancestor::li[1]");
  await expect(
    safeRow.getByRole("link", { name: "Open reference" }),
  ).toHaveAttribute("href", "https://example.com/legal");

  const copyOnlyRow = page
    .getByText("Copy-only reference", { exact: true })
    .locator("xpath=ancestor::li[1]");
  await expect(
    copyOnlyRow.locator('button[aria-label="Copy reference"]'),
  ).toBeVisible();
  await expect(copyOnlyRow.getByRole("link")).toHaveCount(0);
});

test("deletion requires confirmation and removes the canonical Task", async ({
  page,
}) => {
  const today = await browserCivilDate(page);
  await createTask(page, "Delete contract task", today);
  await page.reload();

  const deleteCard = await taskCard(page, "Delete contract task");
  await deleteCard.click();
  const inspector = page.getByRole("complementary", {
    name: "Task details for Delete contract task",
  });
  await expect(inspector).toBeVisible();
  await inspector
    .getByRole("button", { name: "Delete…", exact: true })
    .click();

  const confirmation = page.getByRole("alertdialog");
  await expect(
    confirmation.getByRole("heading", { name: "Delete task?" }),
  ).toBeVisible();

  const deleteAction = confirmation.getByRole("button", {
    name: "Delete task",
    exact: true,
  });
  await expect(deleteAction).toBeEnabled();
  await deleteAction.click({ timeout: 5_000 });
  await expect(confirmation).toBeHidden({ timeout: 5_000 });

  await expect
    .poll(
      async () =>
        (await apiState(page)).tasks.some(
          (task) => task.title === "Delete contract task",
        ),
      { timeout: 5_000 },
    )
    .toBe(false);
});

test("narrow Week reflows to one selected attention list and Today is a Day shortcut", async ({
  page,
}) => {
  const today = await browserCivilDate(page);
  await createTask(page, "Narrow selected task", today);
  await page.reload();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator(".jig-mobile-destination-trigger").click();
  await page
    .locator(".jig-primary-nav")
    .getByRole("button", { name: "Week", exact: true })
    .click();

  await expect(page.locator(".jig-week-board")).toHaveCount(0);
  await expect(page.locator(".jig-week-strip-date")).toHaveCount(7);
  await expect(
    page
      .locator(".jig-task-card")
      .filter({ hasText: "Narrow selected task" })
      .first(),
  ).toBeVisible();

  await page.getByRole("button", { name: "Today", exact: true }).click();
  await expect(page.locator(".jig-mobile-destination-trigger")).toHaveText(
    /Day/,
  );
  await expect(
    page
      .locator(".jig-task-card")
      .filter({ hasText: "Narrow selected task" })
      .first(),
  ).toBeVisible();
});

test("reduced motion preserves non-drag movement semantics", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const today = await browserCivilDate(page);
  await createTask(page, "Reduced motion first", today);
  await createTask(page, "Reduced motion second", today);
  await page.reload();

  await runTaskAction(page, "Reduced motion first", "Move down");

  await expect
    .poll(async () =>
      (await apiState(page)).tasks
        .filter(
          (task) =>
            task.completed_at === null &&
            task.scheduled_date === today,
        )
        .sort(
          (left, right) =>
            (left.position ?? 0) - (right.position ?? 0),
        )
        .map((task) => task.title),
    )
    .toEqual(["Reduced motion second", "Reduced motion first"]);

  await expect(
    page.locator(".jig-date-drop-zone").first(),
  ).toHaveCSS("transition-property", "none");
});

test("long Week columns keep sticky date controls reachable while tasks scroll", async ({
  page,
}) => {
  const today = await browserCivilDate(page);
  for (let index = 0; index < 18; index += 1) {
    await createTask(page, `Long list task ${index + 1}`, today);
  }
  await page.reload();
  await page.getByRole("button", { name: "Week", exact: true }).click();

  const column = page.locator(`[data-date="${today}"]`);
  await expect(column).toBeVisible();
  const lastTask = column.getByText("Long list task 18", {
    exact: true,
  });
  await lastTask.scrollIntoViewIfNeeded();
  await expect(lastTask).toBeVisible();

  await expect(
    column.getByRole("button", {
      name: /^Add task on /,
    }),
  ).toBeVisible();
});
