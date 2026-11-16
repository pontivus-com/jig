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

test("Day carry-over is derived without date mutation and explicit Move to date reschedules", async ({
  page,
}) => {
  const today = await browserCivilDate(page);
  const yesterday = await browserCivilDate(page, -1);
  await createTask(page, "Carry-over contract", yesterday);
  await page.reload();

  await page.getByRole("button", { name: "Day", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Carried over" }),
  ).toBeVisible();
  await expect(
    page.getByText("Carry-over contract", { exact: true }),
  ).toBeVisible();

  expect(
    (await taskByTitle(page, "Carry-over contract")).scheduled_date,
  ).toBe(yesterday);

  await page
    .getByRole("button", {
      name: "Move Carry-over contract to another date",
    })
    .click();

  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "Move task to date" }),
  ).toBeVisible();
  await dialog.getByLabel("Destination date").fill(today);
  await dialog
    .getByRole("button", { name: "Move task", exact: true })
    .click();

  await expect(dialog).toBeHidden();
  await expect
    .poll(
      async () =>
        (await taskByTitle(page, "Carry-over contract")).scheduled_date,
    )
    .toBe(today);
  await expect(
    page.getByRole("heading", { name: "Carried over" }),
  ).toBeHidden();
});

test("non-drag movement uses the same exact index semantics", async ({
  page,
}) => {
  const today = await browserCivilDate(page);
  await createTask(page, "First exact task", today);
  await createTask(page, "Second exact task", today);
  await page.reload();

  await page
    .getByRole("button", { name: "Move First exact task down" })
    .click();

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

  await page
    .getByRole("button", { name: "Move First exact task up" })
    .click();

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

  await page
    .getByRole("button", { name: "Edit Priority edited task" })
    .click({ timeout: 5_000 });
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible({ timeout: 5_000 });
  const highPriority = dialog.getByRole("radio", {
    name: "High",
    exact: true,
  });
  await highPriority.click({ timeout: 5_000 });
  await expect(highPriority).toHaveAttribute("aria-checked", "true");
  await dialog
    .getByRole("button", { name: "Save", exact: true })
    .click({ timeout: 5_000 });
  await expect(dialog).toBeHidden({ timeout: 5_000 });

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

  await page
    .getByRole("button", { name: "Edit Editable metadata task" })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Context").fill("Client Alpha");
  await dialog
    .getByLabel("Reference")
    .fill("../matters/client-alpha");
  await dialog.getByLabel("Notes").fill("Prepare clause comments.");
  await dialog
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await expect(dialog).toBeHidden();

  const edited = await taskByTitle(page, "Editable metadata task");
  expect(edited.context).toBe("Client Alpha");
  expect(edited.reference).toBe("../matters/client-alpha");
  expect(edited.note).toBe("Prepare clause comments.");
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

  const handle = page.getByRole("button", {
    name: "Drag Pointer drag contract",
  });
  const destination = page.locator(
    `[data-date="${destinationDate}"]`,
  );
  await expect(handle).toBeVisible();
  await expect(destination).toBeVisible();

  const sourceBox = await handle.boundingBox();
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
    copyOnlyRow.getByRole("button", { name: "Copy reference" }),
  ).toBeVisible();
  await expect(copyOnlyRow.getByRole("link")).toHaveCount(0);
});

test("deletion requires confirmation and removes the canonical Task", async ({
  page,
}) => {
  const today = await browserCivilDate(page);
  await createTask(page, "Delete contract task", today);
  await page.reload();

  await page
    .getByRole("button", { name: "Edit Delete contract task" })
    .click();
  const editor = page.getByRole("dialog");
  await editor
    .getByRole("button", { name: "Delete task…" })
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

  await expect(page.locator(".jig-week-board")).toHaveCount(0);
  await expect(page.locator(".jig-week-strip-date")).toHaveCount(7);
  await expect(
    page.getByText("Narrow selected task", { exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Today", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Day", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByText("Narrow selected task", { exact: true }),
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

  await page
    .getByRole("button", { name: "Move Reduced motion first down" })
    .click();

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
