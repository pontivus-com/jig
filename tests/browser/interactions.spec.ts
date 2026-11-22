import {
  expect,
  test,
  type Locator,
  type Page,
} from "@playwright/test";

test.use({ hasTouch: true });
import {
  apiCommand,
  apiState,
  browserCivilDate,
  resetCanonicalTasks,
  taskByTitle,
} from "./helpers";

declare global {
  interface Window {
    __jigTouchDragTarget?: EventTarget;
  }
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await resetCanonicalTasks(page);
  await page.reload();
});

function activeWeek(page: Page): Locator {
  return page.locator(".jig-planner-surface");
}

async function taskCard(page: Page, title: string) {
  return activeWeek(page)
    .getByText(title, { exact: true })
    .locator("xpath=ancestor::li[contains(@class,'jig-task-card')][1]");
}

async function dragHandle(page: Page, title: string): Promise<Locator> {
  const card = await taskCard(page, title);
  return card.getByLabel(`Move ${title}`, { exact: true });
}

function dateDropZone(page: Page, date: string): Locator {
  return page.locator(
    `[data-jig-drop-date-container="${date}"]`,
  );
}

async function taskDropTarget(
  page: Page,
  date: string,
  destinationIndex: number,
  sourceTitle: string,
): Promise<{
  readonly target: Locator;
  readonly targetYRatio: number;
}> {
  const cards = page.locator(
    `[data-date="${date}"] .jig-task-card`,
  );
  const count = await cards.count();
  const available: number[] = [];
  for (let index = 0; index < count; index += 1) {
    const title = (
      await cards.nth(index).locator(".jig-task-title").innerText()
    ).trim();
    if (title !== sourceTitle) {
      available.push(index);
    }
  }

  if (available.length === 0) {
    return {
      target: dateDropZone(page, date),
      targetYRatio: 0.9,
    };
  }

  if (destinationIndex >= available.length) {
    return {
      target: cards.nth(available[available.length - 1] ?? 0),
      targetYRatio: 0.75,
    };
  }

  return {
    target: cards.nth(available[destinationIndex] ?? 0),
    targetYRatio: 0.25,
  };
}

async function runTaskAction(
  page: Page,
  title: string,
  action: string,
): Promise<void> {
  await expect
    .poll(() =>
      activeWeek(page).evaluate(
        (element) =>
          element
            .getAnimations({ subtree: true })
            .filter((animation) => animation.playState === "running").length,
      ),
    )
    .toBe(0);

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
  targetYRatio = 0.5,
): Promise<{ readonly date: string; readonly index: number }> {
  const sourceBox = await source.boundingBox();
  if (sourceBox === null) {
    throw new Error("Drag source geometry unavailable");
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
  const targetBox = await target.boundingBox();
  if (targetBox === null) {
    throw new Error("Drag target geometry unavailable after lift");
  }
  await page.mouse.move(
    targetBox.x + targetBox.width / 2,
    targetBox.y + targetBox.height * targetYRatio,
    { steps: 12 },
  );

  const dragScope = page.locator(".jig-task-drag-scope");
  await expect(dragScope).not.toHaveAttribute("data-jig-drop-date", "");
  await expect(
    page.locator(".jig-task-prospective-footprint"),
  ).toHaveCount(1);

  const intent = await dragScope.evaluate((element) => ({
    date: element.getAttribute("data-jig-drop-date") ?? "",
    index: Number(element.getAttribute("data-jig-drop-index")),
  }));
  await page.mouse.up();
  return intent;
}

async function touchDrag(
  page: Page,
  source: Locator,
  target: Locator,
  targetYRatio = 0.5,
  beforeRelease?: () => Promise<void>,
): Promise<{ readonly date: string; readonly index: number }> {
  const sourceBox = await source.boundingBox();
  if (sourceBox === null) {
    throw new Error("Touch drag source geometry unavailable");
  }

  const startPoint = {
    x: sourceBox.x + sourceBox.width / 2,
    y: sourceBox.y + sourceBox.height / 2,
  };
  const client = await page.context().newCDPSession(page);

  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      {
        x: startPoint.x,
        y: startPoint.y,
        radiusX: 1,
        radiusY: 1,
        force: 1,
        id: 41,
      },
    ],
  });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [
      {
        x: startPoint.x + 4,
        y: startPoint.y + 4,
        radiusX: 1,
        radiusY: 1,
        force: 1,
        id: 41,
      },
    ],
  });
  await expect(page.locator(".jig-drag-card-overlay")).toHaveCount(0);
  await page.waitForTimeout(275);
  await expect(page.locator(".jig-drag-card-overlay")).toBeVisible();

  const targetBox = await target.boundingBox();
  if (targetBox === null) {
    throw new Error("Touch drag target geometry unavailable after lift");
  }
  const endPoint = {
    x: targetBox.x + targetBox.width / 2,
    y: targetBox.y + targetBox.height * targetYRatio,
  };

  for (let step = 1; step <= 12; step += 1) {
    const progress = step / 12;
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        {
          x: startPoint.x + (endPoint.x - startPoint.x) * progress,
          y: startPoint.y + (endPoint.y - startPoint.y) * progress,
          radiusX: 1,
          radiusY: 1,
          force: 1,
          id: 41,
        },
      ],
    });
  }

  const dragScope = page.locator(".jig-task-drag-scope");
  await expect(dragScope).not.toHaveAttribute("data-jig-drop-date", "");
  await expect(page.locator(".jig-task-prospective-footprint")).toHaveCount(1);

  const intent = await dragScope.evaluate((element) => ({
    date: element.getAttribute("data-jig-drop-date") ?? "",
    index: Number(element.getAttribute("data-jig-drop-index")),
  }));

  if (beforeRelease !== undefined) {
    await beforeRelease();
  }

  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await client.detach();

  return intent;
}

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
  await expect(workspace).toBeHidden();
  await expect(
    page.getByRole("status").filter({ hasText: "Task saved" }),
  ).toBeVisible();

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
  await expect(
    activeWeek(page).locator(".jig-week-date-signifier > strong"),
  ).toHaveCount(7);
});

test("rolling Planner never renders a past-date drag destination", async ({
  page,
}) => {
  const today = await browserCivilDate(page);
  const dates = await page.locator("[data-date]").evaluateAll(
    (elements, currentDate) =>
      elements
        .map((element) => element.getAttribute("data-date"))
        .filter((date): date is string => date !== null && date < currentDate),
    today,
  );
  expect(dates).toEqual([]);
});

test("dedicated-handle desktop drag moves exactly once without runtime errors or selection", async ({
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
  const destinationDate = await browserCivilDate(page, 1);

  await createTask(page, "Pointer drag contract", today);
  await page.reload();

  const card = await taskCard(page, "Pointer drag contract");
  const sourceHandle = await dragHandle(page, "Pointer drag contract");
  const destination = dateDropZone(page, destinationDate);
  await expect(card).toBeVisible();
  await expect(destination).toBeVisible();

  const intent = await mouseDrag(page, sourceHandle, destination);
  expect(intent).toEqual({ date: destinationDate, index: 0 });

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

test("selection focus and drag preserve the High-priority semantic cue", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const today = await browserCivilDate(page);
  await createTask(page, "Combined semantic source", today, { priority: "HIGH" });
  await createTask(page, "Combined semantic target", today);
  await page.reload();

  const source = await taskCard(page, "Combined semantic source");
  await source.click();
  await expect(source).toHaveClass(/jig-task-card-selected/);

  const selectedColors = await source.evaluate((element) => {
    const resolveColor = (token: string): string => {
      const probe = document.createElement("span");
      probe.style.color = `var(${token})`;
      document.body.append(probe);
      const color = getComputedStyle(probe).color;
      probe.remove();
      return color;
    };
    const style = getComputedStyle(element);
    return {
      leading: style.borderInlineStartColor,
      top: style.borderTopColor,
      priority: resolveColor("--jig-priority-high"),
      selected: resolveColor("--jig-state-task-selected-border"),
    };
  });
  expect(selectedColors.leading).toBe(selectedColors.priority);
  expect(selectedColors.top).toBe(selectedColors.selected);

  const actions = source.getByRole("button", {
    name: "Actions for Combined semantic source",
  });
  // Enter keyboard modality first. A subsequent script focus inherits the
  // browser's focus-visible state, allowing us to certify Astryx's public
  // :focus-visible / :has(:focus-visible) contract without depending on its
  // private DOM/class structure.
  await page.keyboard.press("Tab");
  await actions.focus();
  const focusTreatment = await source.evaluate((element) => {
    const focused = document.activeElement;
    if (!(focused instanceof HTMLElement)) {
      throw new Error("Focused Task control is unavailable");
    }
    const rowStyle = getComputedStyle(element);
    const controlStyle = getComputedStyle(focused);
    return {
      containsFocus: element.contains(focused),
      focusVisible: focused.matches(":focus-visible"),
      rowOutlineWidth: rowStyle.outlineWidth,
      rowOutlineStyle: rowStyle.outlineStyle,
      controlOutlineWidth: controlStyle.outlineWidth,
      controlOutlineStyle: controlStyle.outlineStyle,
    };
  });
  expect(focusTreatment.containsFocus).toBe(true);
  expect(focusTreatment.focusVisible).toBe(true);
  expect(
    (focusTreatment.rowOutlineWidth !== "0px" &&
      focusTreatment.rowOutlineStyle !== "none") ||
      (focusTreatment.controlOutlineWidth !== "0px" &&
        focusTreatment.controlOutlineStyle !== "none"),
  ).toBe(true);

  await page.keyboard.press("Escape");
  await page.locator(".jig-content").click({ position: { x: 2, y: 2 } });
  await expect(page.getByRole("dialog", { name: "Combined semantic source" })).toBeHidden();

  const combinedTarget = await taskDropTarget(
    page,
    today,
    1,
    "Combined semantic source",
  );
  const target = combinedTarget.target;
  const sourceHandle = await dragHandle(page, "Combined semantic source");
  const sourceBox = await sourceHandle.boundingBox();
  const targetBox = await target.boundingBox();
  if (sourceBox === null || targetBox === null) {
    throw new Error("Combined-state drag geometry unavailable");
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

  const overlay = page.locator(".jig-drag-card-overlay .jig-task-card");
  await expect(overlay).toBeVisible();
  const dragColors = await overlay.evaluate((element) => {
    const probe = document.createElement("span");
    probe.style.color = "var(--jig-priority-high)";
    document.body.append(probe);
    const priority = getComputedStyle(probe).color;
    probe.remove();
    return {
      leading: getComputedStyle(element).borderInlineStartColor,
      priority,
    };
  });
  expect(dragColors.leading).toBe(dragColors.priority);

  await page.mouse.move(
    targetBox.x + targetBox.width / 2,
    targetBox.y + targetBox.height * combinedTarget.targetYRatio,
    { steps: 8 },
  );
  await expect(page.locator(".jig-task-prospective-footprint")).toHaveCount(1);
  await page.screenshot({
    path: testInfo.outputPath("v1.1-drag-active-desktop.png"),
    fullPage: true,
  });
  await page.mouse.up();
});

test("dedicated-handle desktop drag reorders within a date at the exact target index", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const today = await browserCivilDate(page);
  await createTask(page, "Desktop reorder first", today);
  await createTask(page, "Desktop reorder second", today);
  await createTask(page, "Desktop reorder third", today);
  await page.reload();

  const source = await dragHandle(page, "Desktop reorder first");
  const { target, targetYRatio } = await taskDropTarget(
    page,
    today,
    2,
    "Desktop reorder first",
  );
  const intent = await mouseDrag(page, source, target, targetYRatio);
  expect(intent).toEqual({ date: today, index: 2 });

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
    .toEqual([
      "Desktop reorder second",
      "Desktop reorder third",
      "Desktop reorder first",
    ]);

  await page.reload();
  const persisted = (await apiState(page)).tasks
    .filter(
      (task) =>
        task.completed_at === null &&
        task.scheduled_date === today,
    )
    .sort(
      (left, right) =>
        (left.position ?? 0) - (right.position ?? 0),
    )
    .map((task) => task.title);
  expect(persisted).toEqual([
    "Desktop reorder second",
    "Desktop reorder third",
    "Desktop reorder first",
  ]);
});

test("narrow touch drag reorders within a date and does not open the workspace", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 1600 });
  const today = await browserCivilDate(page);
  await createTask(page, "Touch first", today);
  await createTask(page, "Touch second", today);
  await page.reload();

  const source = await dragHandle(page, "Touch first");
  const { target, targetYRatio } = await taskDropTarget(
    page,
    today,
    1,
    "Touch first",
  );
  const intent = await touchDrag(
    page,
    source,
    target,
    targetYRatio,
    async () => {
      await page.screenshot({
        path: testInfo.outputPath("v1.1-drag-active-mobile-390.png"),
        clip: { x: 0, y: 0, width: 390, height: 844 },
      });
    },
  );
  expect(intent).toEqual({ date: today, index: 1 });

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

test("narrow touch drag moves to the exact index in a non-empty adjacent date", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 1600 });
  const today = await browserCivilDate(page);
  const dates = await page.locator("[data-date]").evaluateAll((elements) =>
    elements
      .map((element) => element.getAttribute("data-date"))
      .filter((value): value is string => value !== null),
  );
  const sourceIndex = dates.indexOf(today);
  const destinationDate =
    sourceIndex >= 0 && sourceIndex < dates.length - 1
      ? dates[sourceIndex + 1]
      : sourceIndex > 0
        ? dates[sourceIndex - 1]
        : undefined;
  if (sourceIndex < 0 || destinationDate === undefined) {
    throw new Error("Planner current/adjacent dates unavailable");
  }

  await createTask(page, "Touch cross source", today);
  await createTask(page, "Touch target first", destinationDate);
  await createTask(page, "Touch target second", destinationDate);
  await page.reload();

  const source = await dragHandle(page, "Touch cross source");
  const { target, targetYRatio } = await taskDropTarget(
    page,
    destinationDate,
    0,
    "Touch cross source",
  );
  const intent = await touchDrag(
    page,
    source,
    target,
    targetYRatio,
  );
  expect(intent).toEqual({ date: destinationDate, index: 0 });

  await expect
    .poll(async () =>
      (await apiState(page)).tasks
        .filter(
          (task) =>
            task.completed_at === null &&
            task.scheduled_date === destinationDate,
        )
        .sort(
          (left, right) =>
            (left.position ?? 0) - (right.position ?? 0),
        )
        .map((task) => task.title),
    )
    .toEqual([
      "Touch cross source",
      "Touch target first",
      "Touch target second",
    ]);

  await page.reload();
  expect(
    (await taskByTitle(page, "Touch cross source")).scheduled_date,
  ).toBe(destinationDate);
});

test("narrow touch drag moves into an empty adjacent date and persists", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 1600 });
  const today = await browserCivilDate(page);
  const dates = await page.locator("[data-date]").evaluateAll((elements) =>
    elements
      .map((element) => element.getAttribute("data-date"))
      .filter((value): value is string => value !== null),
  );
  const sourceIndex = dates.indexOf(today);
  const destinationDate =
    sourceIndex >= 0 && sourceIndex < dates.length - 1
      ? dates[sourceIndex + 1]
      : sourceIndex > 0
        ? dates[sourceIndex - 1]
        : undefined;
  if (sourceIndex < 0 || destinationDate === undefined) {
    throw new Error("Planner current/adjacent dates unavailable");
  }

  await createTask(page, "Touch cross-date", today);
  await page.reload();

  const source = await dragHandle(page, "Touch cross-date");
  const target = dateDropZone(page, destinationDate);
  const intent = await touchDrag(page, source, target, 0.9);
  expect(intent).toEqual({ date: destinationDate, index: 0 });

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


test("desktop drag projects one measured card footprint without pre-release mutation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const today = await browserCivilDate(page);
  await createTask(page, "Gap source", today);
  await createTask(page, "Gap target one", today);
  await createTask(
    page,
    "Gap target two with a deliberately longer title for height",
    today,
  );
  await page.reload();

  const sourceCard = await taskCard(page, "Gap source");
  const sourceHeight = await sourceCard.evaluate(
    (element) => element.getBoundingClientRect().height,
  );
  const source = await dragHandle(page, "Gap source");
  const sourceBox = await source.boundingBox();
  if (sourceBox === null) {
    throw new Error("Gap drag source geometry unavailable");
  }
  const { target } = await taskDropTarget(
    page,
    today,
    1,
    "Gap source",
  );

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

  const targetBox = await target.boundingBox();
  if (targetBox === null) {
    throw new Error("Sortable target geometry unavailable");
  }
  const x = targetBox.x + targetBox.width / 2;
  for (const ratio of [0.2, 0.35] as const) {
    await page.mouse.move(
      x,
      targetBox.y + targetBox.height * ratio,
      { steps: 6 },
    );
    await expect(page.locator(".jig-task-drag-scope")).toHaveAttribute(
      "data-jig-drop-index",
      "1",
    );
    await expect(page.locator(".jig-task-prospective-footprint")).toHaveCount(1);
    const footprintHeight = await page
      .locator(".jig-task-prospective-footprint")
      .evaluate((element) => element.getBoundingClientRect().height);
    expect(Math.abs(footprintHeight - sourceHeight)).toBeLessThanOrEqual(1);
    expect((await taskByTitle(page, "Gap source")).position).toBe(0);
  }

  await page.mouse.up();
  await expect(page.locator(".jig-task-prospective-footprint")).toHaveCount(0);
  await expect
    .poll(async () => (await taskByTitle(page, "Gap source")).position)
    .toBe(1);
});


test("dedicated-handle drag survives twenty sequential cycles without stranded state", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const today = await browserCivilDate(page);
  await createTask(page, "Repeated drag source", today);
  await createTask(page, "Repeated drag peer", today);
  await page.reload();

  const orderedTitles = async (): Promise<readonly string[]> =>
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
      .map((task) => task.title);

  for (let cycle = 0; cycle < 20; cycle += 1) {
    const moveToEnd = cycle % 2 === 0;
    const source = await dragHandle(page, "Repeated drag source");
    const targetSlot = moveToEnd ? 2 : 0;
    const target = page.locator(
      `[data-date="${today}"] [data-jig-drop-slot="${targetSlot}"]`,
    );
    const intent = await mouseDrag(page, source, target);
    expect(intent).toEqual({
      date: today,
      index: moveToEnd ? 1 : 0,
    });

    await expect
      .poll(orderedTitles)
      .toEqual(
        moveToEnd
          ? ["Repeated drag peer", "Repeated drag source"]
          : ["Repeated drag source", "Repeated drag peer"],
      );

    await expect(page.locator(".jig-drag-card-overlay")).toHaveCount(0);
    await expect(page.locator(".jig-task-insertion-slot-active")).toHaveCount(0);
    await expect(page.locator(".jig-task-drag-scope")).toHaveAttribute(
      "data-jig-drag-active",
      "false",
    );
  }
});

test("outside drop restores exactly without mutation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const today = await browserCivilDate(page);
  await createTask(page, "Outside-drop source", today);
  await createTask(page, "Outside-drop peer", today);
  await page.reload();

  const before = await taskByTitle(page, "Outside-drop source");
  const source = await dragHandle(page, "Outside-drop source");
  const sourceBox = await source.boundingBox();
  if (sourceBox === null) {
    throw new Error("Outside-drop source geometry unavailable");
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
  await page.mouse.move(4, 4, { steps: 8 });
  await expect(page.locator(".jig-task-drag-scope")).toHaveAttribute(
    "data-jig-drop-date",
    "",
  );
  await page.mouse.up();

  await expect(page.locator(".jig-drag-card-overlay")).toHaveCount(0);
  await expect(page.locator(".jig-task-insertion-slot-active")).toHaveCount(0);
  await expect(page.locator(".jig-task-drag-scope")).toHaveAttribute(
    "data-jig-drag-active",
    "false",
  );
  const after = await taskByTitle(page, "Outside-drop source");
  expect({
    date: after.scheduled_date,
    position: after.position,
  }).toEqual({
    date: before.scheduled_date,
    position: before.position,
  });
});

test("pointer cancellation clears touch drag without mutation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const today = await browserCivilDate(page);
  await createTask(page, "Pointer-cancel source", today);
  await createTask(page, "Pointer-cancel peer", today);
  await page.reload();

  const before = await taskByTitle(page, "Pointer-cancel source");
  const source = await dragHandle(page, "Pointer-cancel source");
  const sourceBox = await source.boundingBox();
  if (sourceBox === null) {
    throw new Error("Pointer-cancel source geometry unavailable");
  }

  const client = await page.context().newCDPSession(page);
  const point = (x: number, y: number) => ({
    x,
    y,
    radiusX: 1,
    radiusY: 1,
    force: 1,
    id: 41,
  });
  const x = sourceBox.x + sourceBox.width / 2;
  const y = sourceBox.y + sourceBox.height / 2;

  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [point(x, y)],
  });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [point(x + 8, y + 8)],
  });
  await expect(page.locator(".jig-drag-card-overlay")).toBeVisible();

  await client.send("Input.dispatchTouchEvent", {
    type: "touchCancel",
    touchPoints: [],
  });
  await client.detach();

  await expect(page.locator(".jig-drag-card-overlay")).toHaveCount(0);
  await expect(page.locator(".jig-task-insertion-slot-active")).toHaveCount(0);
  await expect(page.locator(".jig-task-drag-scope")).toHaveAttribute(
    "data-jig-drag-active",
    "false",
  );
  const after = await taskByTitle(page, "Pointer-cancel source");
  expect({
    date: after.scheduled_date,
    position: after.position,
  }).toEqual({
    date: before.scheduled_date,
    position: before.position,
  });
});

test("default KeyboardSensor moves from the dedicated grip and commits once", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const today = await browserCivilDate(page);
  await createTask(page, "Keyboard drag source", today);
  await createTask(page, "Keyboard drag peer", today);
  await page.reload();

  const handle = await dragHandle(page, "Keyboard drag source");
  await handle.focus();
  await page.keyboard.press("Space");
  await expect(page.locator(".jig-drag-card-overlay")).toBeVisible();

  const scope = page.locator(".jig-task-drag-scope");
  let reachedTarget = false;
  for (let step = 0; step < 96; step += 1) {
    await page.keyboard.press("ArrowDown");
    const date = await scope.getAttribute("data-jig-drop-date");
    const index = await scope.getAttribute("data-jig-drop-index");
    if (date === today && index === "1") {
      reachedTarget = true;
      break;
    }
  }
  expect(reachedTarget).toBe(true);
  await page.keyboard.press("Space");

  await expect(page.locator(".jig-drag-card-overlay")).toHaveCount(0);
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
    .toEqual(["Keyboard drag peer", "Keyboard drag source"]);
});

test("long Planner drag auto-scroll preserves a valid explicit insertion target", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 600 });
  const today = await browserCivilDate(page);
  for (let index = 0; index < 24; index += 1) {
    await createTask(page, `Auto-scroll task ${index + 1}`, today);
  }
  await page.reload();

  const source = await dragHandle(page, "Auto-scroll task 1");
  const sourceBox = await source.boundingBox();
  if (sourceBox === null) {
    throw new Error("Auto-scroll source geometry unavailable");
  }
  const scrollOwner = page.locator("#astryx-app-shell-main");
  await expect.poll(
    async () => scrollOwner.evaluate((element) => element.scrollTop),
  ).toBe(0);

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

  for (let attempt = 0; attempt < 12; attempt += 1) {
    await page.mouse.move(
      sourceBox.x + sourceBox.width / 2,
      575,
      { steps: 4 },
    );
    await page.waitForTimeout(100);
    const scrollTop = await scrollOwner.evaluate((element) => element.scrollTop);
    if (scrollTop > 0) {
      break;
    }
  }

  const scrollTop = await scrollOwner.evaluate((element) => element.scrollTop);
  expect(scrollTop).toBeGreaterThan(0);
  await expect(page.locator(".jig-task-drag-scope")).toHaveAttribute(
    "data-jig-drop-date",
    today,
  );
  await expect(page.locator(".jig-task-insertion-slot-active")).toBeVisible();
  await page.mouse.up();

  await expect(page.locator(".jig-drag-card-overlay")).toHaveCount(0);
  await expect(page.locator(".jig-task-insertion-slot-active")).toHaveCount(0);
});


test("explicit insertion slots cover every gap without pre-release mutation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const today = await browserCivilDate(page);
  const destinationDate = await browserCivilDate(page, 1);

  await createTask(page, "Gap-matrix source", today);
  await createTask(page, "Gap-matrix destination 1", destinationDate);
  await createTask(page, "Gap-matrix destination 2", destinationDate);
  await createTask(page, "Gap-matrix destination 3", destinationDate);
  await page.reload();

  const source = await dragHandle(page, "Gap-matrix source");
  const sourceBox = await source.boundingBox();
  if (sourceBox === null) {
    throw new Error("Gap-matrix source geometry unavailable");
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

  const scope = page.locator(".jig-task-drag-scope");
  for (let slotIndex = 0; slotIndex <= 3; slotIndex += 1) {
    const slot = page.locator(
      `[data-date="${destinationDate}"] [data-jig-drop-slot="${slotIndex}"]`,
    );
    const box = await slot.boundingBox();
    if (box === null) {
      throw new Error(`Gap-matrix slot ${slotIndex} geometry unavailable`);
    }
    await page.mouse.move(
      box.x + box.width / 2,
      box.y + box.height / 2,
      { steps: 6 },
    );
    await expect(scope).toHaveAttribute(
      "data-jig-drop-date",
      destinationDate,
    );
    await expect(scope).toHaveAttribute(
      "data-jig-drop-index",
      String(slotIndex),
    );
    expect(
      (await taskByTitle(page, "Gap-matrix source")).scheduled_date,
    ).toBe(today);
  }

  await page.mouse.move(4, 4, { steps: 6 });
  await page.mouse.up();
  await expect(page.locator(".jig-drag-card-overlay")).toHaveCount(0);
  expect(
    (await taskByTitle(page, "Gap-matrix source")).scheduled_date,
  ).toBe(today);
});

test("drag persists first middle and last positions within and across dates", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const today = await browserCivilDate(page);
  const destinationDate = await browserCivilDate(page, 1);

  const orderedTitles = async (date: string): Promise<readonly string[]> =>
    (await apiState(page)).tasks
      .filter(
        (task) =>
          task.completed_at === null &&
          task.scheduled_date === date,
      )
      .sort(
        (left, right) =>
          (left.position ?? 0) - (right.position ?? 0),
      )
      .map((task) => task.title);

  const sameDateCases = [
    { label: "first", sourceFirst: false, slot: 0, index: 0 },
    { label: "middle", sourceFirst: true, slot: 2, index: 1 },
    { label: "last", sourceFirst: true, slot: 3, index: 2 },
  ] as const;

  for (const scenario of sameDateCases) {
    await resetCanonicalTasks(page);
    if (scenario.sourceFirst) {
      await createTask(page, `Same ${scenario.label} source`, today);
    }
    await createTask(page, `Same ${scenario.label} peer 1`, today);
    await createTask(page, `Same ${scenario.label} peer 2`, today);
    if (!scenario.sourceFirst) {
      await createTask(page, `Same ${scenario.label} source`, today);
    }
    await page.reload();

    const sourceTitle = `Same ${scenario.label} source`;
    const intent = await mouseDrag(
      page,
      await dragHandle(page, sourceTitle),
      page.locator(
        `[data-date="${today}"] [data-jig-drop-slot="${scenario.slot}"]`,
      ),
    );
    expect(intent).toEqual({ date: today, index: scenario.index });
    await expect
      .poll(async () => (await orderedTitles(today))[scenario.index])
      .toBe(sourceTitle);
  }

  const crossDateCases = [
    { label: "first", slot: 0, index: 0 },
    { label: "middle", slot: 1, index: 1 },
    { label: "last", slot: 3, index: 3 },
  ] as const;

  for (const scenario of crossDateCases) {
    await resetCanonicalTasks(page);
    const sourceTitle = `Cross ${scenario.label} source`;
    await createTask(page, sourceTitle, today);
    await createTask(page, `Cross ${scenario.label} peer 1`, destinationDate);
    await createTask(page, `Cross ${scenario.label} peer 2`, destinationDate);
    await createTask(page, `Cross ${scenario.label} peer 3`, destinationDate);
    await page.reload();

    const intent = await mouseDrag(
      page,
      await dragHandle(page, sourceTitle),
      page.locator(
        `[data-date="${destinationDate}"] [data-jig-drop-slot="${scenario.slot}"]`,
      ),
    );
    expect(intent).toEqual({
      date: destinationDate,
      index: scenario.index,
    });
    await expect
      .poll(async () => (await orderedTitles(destinationDate))[scenario.index])
      .toBe(sourceTitle);
    expect((await taskByTitle(page, sourceTitle)).scheduled_date).toBe(
      destinationDate,
    );
  }
});


test("Task-body touch scroll never activates drag", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 600 });
  const today = await browserCivilDate(page);
  for (let index = 0; index < 12; index += 1) {
    await createTask(page, `Body-scroll task ${index + 1}`, today);
  }
  await page.reload();

  const scrollOwner = page.locator("#astryx-app-shell-main");
  const scrollGeometry = await scrollOwner.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }));
  expect(scrollGeometry.scrollHeight).toBeGreaterThan(
    scrollGeometry.clientHeight,
  );

  const body = (await taskCard(page, "Body-scroll task 2")).locator(
    ".jig-task-body",
  );
  await body.scrollIntoViewIfNeeded();
  const bodyBox = await body.boundingBox();
  if (bodyBox === null) {
    throw new Error("Task-body scroll geometry unavailable");
  }

  const client = await page.context().newCDPSession(page);
  await client.send("Emulation.setTouchEmulationEnabled", {
    enabled: true,
    maxTouchPoints: 1,
  });
  const point = (x: number, y: number) => ({
    x,
    y,
    radiusX: 1,
    radiusY: 1,
    force: 1,
    id: 1,
  });
  const x = bodyBox.x + bodyBox.width / 2;
  const startY = bodyBox.y + Math.min(bodyBox.height / 2, 24);

  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [point(x, startY)],
  });
  await page.waitForTimeout(40);
  for (let step = 1; step <= 6; step += 1) {
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [point(x, startY - step * 24)],
    });
    await page.waitForTimeout(40);
  }
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await page.waitForTimeout(80);
  await client.send("Emulation.setTouchEmulationEnabled", {
    enabled: false,
  });
  await client.detach();

  await expect(page.locator(".jig-drag-card-overlay")).toHaveCount(0);
  await expect(page.locator(".jig-task-drag-scope")).toHaveAttribute(
    "data-jig-drag-active",
    "false",
  );
  await expect(
    page.getByRole("dialog", { name: "Body-scroll task 2" }),
  ).toHaveCount(0);
  await expect
    .poll(async () =>
      scrollOwner.evaluate((element) => element.scrollTop),
    )
    .toBeGreaterThan(0);
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
  await page.setViewportSize({ width: 390, height: 1600 });

  await expect(activeWeek(page).locator(".jig-week-board")).toHaveCount(1);
  await expect(activeWeek(page).locator(".jig-week-column")).toHaveCount(7);
  await expect(page.locator(".jig-planner-narrow")).toHaveCount(0);
  await expect(page.locator(".jig-week-strip-date")).toHaveCount(0);
  await expect(
    activeWeek(page)
      .locator(".jig-task-card")
      .filter({ hasText: "Narrow stacked task" })
      .first(),
  ).toBeVisible();

  await page.getByRole("button", { name: "Today", exact: true }).click();
  await expect(
    activeWeek(page)
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
  await expect(page.locator(".jig-content-configured")).toHaveCSS(
    "animation-name",
    "none",
  );
  await expect(page.locator(".jig-task-card").first()).toHaveCSS(
    "transition-property",
    "none",
  );
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

  const futureDate = await browserCivilDate(page, 1);
  await expect(
    page.locator(`[data-date="${futureDate}"]`).getByRole("button", {
      name: /^Add task to /,
    }),
  ).toHaveCount(1);
});
