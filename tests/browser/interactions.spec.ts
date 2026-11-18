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

async function dragHandle(page: Page, title: string): Promise<Locator> {
  const card = await taskCard(page, title);
  return card.getByLabel(`Move ${title}`, { exact: true });
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
  await expect(page.locator(".jig-task-drop-indicator")).toBeVisible();

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
): Promise<{ readonly date: string; readonly index: number }> {
  const sourceBox = await source.boundingBox();
  if (sourceBox === null) {
    throw new Error("Touch drag source geometry unavailable");
  }

  const startPoint = {
    x: sourceBox.x + sourceBox.width / 2,
    y: sourceBox.y + sourceBox.height / 2,
  };

  const dispatchTouch = async (
    type: "touchstart" | "touchmove" | "touchend",
    point: { readonly x: number; readonly y: number },
  ): Promise<void> => {
    const payload = { type, x: point.x, y: point.y };
    if (type === "touchstart") {
      await source.evaluate((element, start) => {
        const dragWindow = window as Window & {
          __jigTouchDragTarget?: EventTarget;
        };
        dragWindow.__jigTouchDragTarget = element;
        const touch = new Touch({
          identifier: 1,
          target: element,
          clientX: start.x,
          clientY: start.y,
          screenX: start.x,
          screenY: start.y,
          pageX: start.x,
          pageY: start.y,
          radiusX: 1,
          radiusY: 1,
          rotationAngle: 0,
          force: 1,
        });
        element.dispatchEvent(
          new TouchEvent("touchstart", {
            bubbles: true,
            cancelable: true,
            composed: true,
            touches: [touch],
            targetTouches: [touch],
            changedTouches: [touch],
          }),
        );
      }, payload);
      return;
    }

    await page.evaluate((next) => {
      const dragWindow = window as Window & {
        __jigTouchDragTarget?: EventTarget;
      };
      const target = dragWindow.__jigTouchDragTarget;
      if (!(target instanceof Element)) {
        throw new Error("Synthetic touch drag target is unavailable");
      }
      const touch = new Touch({
        identifier: 1,
        target,
        clientX: next.x,
        clientY: next.y,
        screenX: next.x,
        screenY: next.y,
        pageX: next.x,
        pageY: next.y,
        radiusX: 1,
        radiusY: 1,
        rotationAngle: 0,
        force: 1,
      });
      const ending = next.type === "touchend";
      window.dispatchEvent(
        new TouchEvent(next.type, {
          bubbles: true,
          cancelable: true,
          composed: true,
          touches: ending ? [] : [touch],
          targetTouches: ending ? [] : [touch],
          changedTouches: [touch],
        }),
      );
      if (ending) {
        delete dragWindow.__jigTouchDragTarget;
      }
    }, payload);
  };

  await dispatchTouch("touchstart", startPoint);
  await page.waitForTimeout(280);
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
    await dispatchTouch("touchmove", {
      x: startPoint.x + (endPoint.x - startPoint.x) * progress,
      y: startPoint.y + (endPoint.y - startPoint.y) * progress,
    });
    await page.waitForTimeout(20);
  }
  await page.waitForTimeout(40);

  const dragScope = page.locator(".jig-task-drag-scope");
  await expect(dragScope).not.toHaveAttribute("data-jig-drop-date", "");
  await expect(page.locator(".jig-task-drop-indicator")).toBeVisible();

  const intent = await dragScope.evaluate((element) => ({
    date: element.getAttribute("data-jig-drop-date") ?? "",
    index: Number(element.getAttribute("data-jig-drop-index")),
  }));

  await dispatchTouch("touchend", endPoint);
  return intent;
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
  const dayOfWeek = await page.evaluate(() => new Date().getDay());
  const offset = dayOfWeek === 0 ? -1 : 1;
  const destinationDate = await browserCivilDate(page, offset);

  await createTask(page, "Pointer drag contract", today);
  await page.reload();

  const card = await taskCard(page, "Pointer drag contract");
  const sourceHandle = await dragHandle(page, "Pointer drag contract");
  const destination = page.locator(`[data-date="${destinationDate}"] .jig-week-task-area`);
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
}) => {
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

  const target = await taskCard(page, "Combined semantic target");
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

  const overlay = page.locator(".jig-drag-card-overlay");
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
    targetBox.y + targetBox.height / 2,
    { steps: 8 },
  );
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
  const target = await taskCard(page, "Desktop reorder third");
  const intent = await mouseDrag(page, source, target, 0.9);
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
}) => {
  await page.setViewportSize({ width: 390, height: 1600 });
  const today = await browserCivilDate(page);
  await createTask(page, "Touch first", today);
  await createTask(page, "Touch second", today);
  await page.reload();

  const source = await dragHandle(page, "Touch first");
  const target = await taskCard(page, "Touch second");
  const intent = await touchDrag(page, source, target, 0.9);
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
  const target = await taskCard(page, "Touch target first");
  const intent = await touchDrag(page, source, target, 0.1);
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
  const target = page.locator(`[data-date="${destinationDate}"] .jig-week-task-area`);
  const intent = await touchDrag(page, source, target);
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


test("desktop drag keeps a stable insertion intent through inter-card whitespace", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const today = await browserCivilDate(page);
  await createTask(page, "Gap source", today);
  await createTask(page, "Gap target one", today);
  await createTask(page, "Gap target two with a deliberately longer title for height", today);
  await page.reload();

  const source = await dragHandle(page, "Gap source");
  const firstTarget = await taskCard(page, "Gap target one");
  const secondTarget = await taskCard(
    page,
    "Gap target two with a deliberately longer title for height",
  );
  const sourceBox = await source.boundingBox();
  const firstBox = await firstTarget.boundingBox();
  const secondBox = await secondTarget.boundingBox();
  if (sourceBox === null || firstBox === null || secondBox === null) {
    throw new Error("Gap drag geometry unavailable");
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

  const gapY = (firstBox.y + firstBox.height + secondBox.y) / 2;
  const x = firstBox.x + firstBox.width / 2;
  await page.mouse.move(x, gapY - 1, { steps: 8 });
  const firstIntent = await page.locator(".jig-task-drag-scope").evaluate(
    (element) => ({
      date: element.getAttribute("data-jig-drop-date"),
      index: element.getAttribute("data-jig-drop-index"),
    }),
  );
  await page.mouse.move(x, gapY + 1, { steps: 2 });
  const secondIntent = await page.locator(".jig-task-drag-scope").evaluate(
    (element) => ({
      date: element.getAttribute("data-jig-drop-date"),
      index: element.getAttribute("data-jig-drop-index"),
    }),
  );

  expect(firstIntent).toEqual(secondIntent);
  await expect(page.locator(".jig-task-drop-indicator")).toBeVisible();
  await page.mouse.up();
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
