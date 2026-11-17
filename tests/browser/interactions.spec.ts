import {
  expect,
  test,
  type Locator,
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

async function mouseDrag(
  page: Page,
  source: Locator,
  target: Locator,
): Promise<void> {
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  if (sourceBox === null || targetBox === null) {
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
  await expect(page.locator(".jig-drag-card-overlay")).toBeVisible();
  await page.mouse.move(
    targetBox.x + targetBox.width / 2,
    targetBox.y + targetBox.height / 2,
    { steps: 12 },
  );
  await page.mouse.up();
}

async function touchDrag(
  page: Page,
  source: Locator,
  target: Locator,
): Promise<void> {
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  if (sourceBox === null || targetBox === null) {
    throw new Error("Touch drag geometry unavailable");
  }

  const pointerId = 41;
  const start = {
    x: sourceBox.x + sourceBox.width / 2,
    y: sourceBox.y + sourceBox.height / 2,
  };
  const end = {
    x: targetBox.x + targetBox.width / 2,
    y: targetBox.y + targetBox.height / 2,
  };

  await source.dispatchEvent("pointerdown", {
    pointerId,
    pointerType: "touch",
    isPrimary: true,
    button: 0,
    buttons: 1,
    clientX: start.x,
    clientY: start.y,
  });
  await page.waitForTimeout(280);
  await expect(page.locator(".jig-drag-card-overlay")).toBeVisible();

  for (let step = 1; step <= 8; step += 1) {
    const progress = step / 8;
    await page.evaluate(
      ({ id, x, y }) => {
        document.dispatchEvent(
          new PointerEvent("pointermove", {
            pointerId: id,
            pointerType: "touch",
            isPrimary: true,
            button: 0,
            buttons: 1,
            clientX: x,
            clientY: y,
            bubbles: true,
            cancelable: true,
          }),
        );
      },
      {
        id: pointerId,
        x: start.x + (end.x - start.x) * progress,
        y: start.y + (end.y - start.y) * progress,
      },
    );
  }

  await page.evaluate(
    ({ id, x, y }) => {
      document.dispatchEvent(
        new PointerEvent("pointerup", {
          pointerId: id,
          pointerType: "touch",
          isPrimary: true,
          button: 0,
          buttons: 0,
          clientX: x,
          clientY: y,
          bubbles: true,
          cancelable: true,
        }),
      );
    },
    { id: pointerId, x: end.x, y: end.y },
  );
}

test("unfinished prior-day cards roll into today in the canonical Planner", async ({
  page,
}) => {
  const today = await browserCivilDate(page);
  const yesterday = await browserCivilDate(page, -1);
  await createTask(page, "Rollover contract", yesterday);
  await page.reload();

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

  await runTaskAction(page, "Priority edited task", "Priority: High");

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

  await runTaskAction(page, "Editable metadata task", "Open / edit");
  const workspace = page.getByRole("dialog", { name: "Editable metadata task" });
  await workspace.getByLabel("Context").fill("Client Alpha");
  await workspace
    .getByLabel("Reference")
    .fill("../matters/client-alpha");
  await workspace.getByLabel("Notes").fill("Prepare clause comments.");
  await workspace
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await expect(workspace).toBeVisible();

  const edited = await taskByTitle(page, "Editable metadata task");
  expect(edited.context).toBe("Client Alpha");
  expect(edited.reference).toBe("../matters/client-alpha");
  expect(edited.note).toBe("Prepare clause comments.");
});

test("date headers are signifiers rather than selectable Planner state", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.locator('[aria-current="date"]')).toHaveCount(0);
  await expect(page.locator(".jig-date-heading-button")).toHaveCount(0);
  await expect(page.locator(".jig-week-date-signifier > strong")).toHaveCount(7);
});

test("whole-card desktop drag moves exactly once without runtime errors or selection", async ({
  page,
}) => {
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") {
      runtimeErrors.push(message.text());
    }
  });

  const today = await browserCivilDate(page);
  const dayOfWeek = await page.evaluate(() => new Date().getDay());
  const offset = dayOfWeek === 0 ? -1 : 1;
  const destinationDate = await browserCivilDate(page, offset);

  await createTask(page, "Pointer drag contract", today);
  await page.reload();

  const card = await taskCard(page, "Pointer drag contract");
  const destination = page.locator(`[data-date="${destinationDate}"]`);
  await expect(card).toBeVisible();
  await expect(destination).toBeVisible();

  await mouseDrag(page, card, destination);

  await expect
    .poll(
      async () =>
        (await taskByTitle(page, "Pointer drag contract")).scheduled_date,
    )
    .toBe(destinationDate);
  await expect(
    page.getByRole("dialog", { name: "Pointer drag contract" }),
  ).toHaveCount(0);
  await page.reload();
  expect(
    (await taskByTitle(page, "Pointer drag contract")).scheduled_date,
  ).toBe(destinationDate);
  expect(runtimeErrors).toEqual([]);
});

test("narrow touch drag reorders within a date and does not open the workspace", async ({
  page,
}) => {
  const today = await browserCivilDate(page);
  await createTask(page, "Touch first", today);
  await createTask(page, "Touch second", today);
  await page.reload();
  await page.setViewportSize({ width: 390, height: 844 });

  const source = await taskCard(page, "Touch first");
  const target = await taskCard(page, "Touch second");
  await touchDrag(page, source, target);

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
    .toEqual(["Touch second", "Touch first"]);
  await expect(page.getByRole("dialog", { name: "Touch first" })).toHaveCount(0);
});

test("narrow touch drag moves into an empty adjacent date and persists", async ({
  page,
}) => {
  const today = await browserCivilDate(page);
  const dayOfWeek = await page.evaluate(() => new Date().getDay());
  const offset = dayOfWeek === 0 ? -1 : 1;
  const destinationDate = await browserCivilDate(page, offset);

  await createTask(page, "Touch cross-date", today);
  await page.reload();
  await page.setViewportSize({ width: 390, height: 844 });

  const source = await taskCard(page, "Touch cross-date");
  const target = page.locator(`[data-date="${destinationDate}"]`);
  await touchDrag(page, source, target);

  await expect
    .poll(
      async () =>
        (await taskByTitle(page, "Touch cross-date")).scheduled_date,
    )
    .toBe(destinationDate);
  await page.reload();
  expect((await taskByTitle(page, "Touch cross-date")).scheduled_date).toBe(
    destinationDate,
  );
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
  const inspector = page.getByRole("dialog", {
    name: "Delete contract task",
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

test("narrow Planner reflows the same seven-date semantic board", async ({
  page,
}) => {
  const today = await browserCivilDate(page);
  await createTask(page, "Narrow stacked task", today);
  await page.reload();
  await page.setViewportSize({ width: 390, height: 844 });

  await expect(page.locator(".jig-week-board")).toHaveCount(1);
  await expect(page.locator(".jig-week-board .jig-week-column")).toHaveCount(7);
  await expect(page.locator(".jig-planner-narrow")).toHaveCount(0);
  await expect(page.locator(".jig-week-strip-date")).toHaveCount(0);
  await expect(
    page
      .locator(".jig-task-card")
      .filter({ hasText: "Narrow stacked task" })
      .first(),
  ).toBeVisible();

  await page.getByRole("button", { name: "Today", exact: true }).click();
  await expect(
    page
      .locator(".jig-task-card")
      .filter({ hasText: "Narrow stacked task" })
      .first(),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Day", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Week", exact: true })).toHaveCount(0);
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

test("long Planner lanes grow with content without an internal lane scroller", async ({
  page,
}) => {
  const today = await browserCivilDate(page);
  for (let index = 0; index < 18; index += 1) {
    await createTask(page, `Long list task ${index + 1}`, today);
  }
  await page.reload();

  const column = page.locator(`[data-date="${today}"]`);
  await expect(column).toBeVisible();
  const geometry = await column.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      overflowY: style.overflowY,
    };
  });
  expect(geometry.scrollHeight).toBeLessThanOrEqual(geometry.clientHeight + 1);
  expect(geometry.overflowY).not.toBe("auto");
  expect(geometry.overflowY).not.toBe("scroll");

  await expect(
    column.getByRole("button", {
      name: /^Add task to /,
    }),
  ).toBeVisible();
});
