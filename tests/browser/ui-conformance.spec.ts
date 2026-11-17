import { expect, test, type Page } from "@playwright/test";
import {
  apiCommand,
  apiState,
  browserCivilDate,
  resetCanonicalTasks,
} from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await resetCanonicalTasks(page);
  await page.reload();
});

function expectNear(actual: number, expected: number, tolerance = 3): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

async function createTask(
  page: Page,
  title: string,
  date: string,
  priority: "HIGH" | "NORMAL" | "LOW" = "NORMAL",
): Promise<void> {
  await apiCommand(page, {
    type: "create",
    title,
    scheduled_date: date,
    priority,
    context: null,
    reference: null,
    note: null,
    reminder_time: null,
  });
}

async function displayedDateValue(
  page: Page,
  civilDate: string,
): Promise<string> {
  return page.evaluate((value) => {
    const [year, month, day] = value.split("-").map(Number);
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date(year ?? 0, (month ?? 1) - 1, day ?? 1));
  }, civilDate);
}

async function waitForResponsiveHeader(
  page: Page,
  width: number,
): Promise<void> {
  await expect(
    page.locator(
      width >= 1168
        ? ".jig-app-header-desktop"
        : ".jig-app-header-narrow",
    ),
  ).toBeVisible();
}

async function headerHeight(page: Page): Promise<number> {
  let height: number | null = null;
  await expect
    .poll(async () => {
      const box = await page.locator(".jig-app-header").boundingBox();
      height = box?.height ?? null;
      return height;
    })
    .not.toBeNull();

  if (height === null) {
    throw new Error("Application header geometry unavailable");
  }
  return height;
}

test("desktop uses explicit Planner navigation with one seven-date open canvas", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });

  await expect(page.locator(".jig-primary-nav")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Planner home" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Planner", exact: true }))
    .toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("button", { name: "History", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Settings", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add task", exact: true }).first()).toBeVisible();
  await expect(page.locator(".jig-week-column")).toHaveCount(7);
  await expect(page.locator(".jig-week-column-selected")).toHaveCount(0);
  await expect(page.locator(".jig-week-strip-date")).toHaveCount(0);
  await expect(page.locator(".jig-week-add-task")).toHaveCount(0);

  const labels = await page
    .locator(".jig-week-date-signifier > strong")
    .allTextContents();
  expect(labels.map((label) => label.split(" ")[0])).toEqual([
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ]);

  const chrome = await page.locator(".jig-week-column").first().evaluate(
    (element) => {
      const style = getComputedStyle(element);
      return {
        background: style.backgroundColor,
        top: style.borderTopWidth,
        right: style.borderRightWidth,
        bottom: style.borderBottomWidth,
        left: style.borderLeftWidth,
        shadow: style.boxShadow,
      };
    },
  );
  expect(chrome.background).toBe("rgba(0, 0, 0, 0)");
  expect(chrome.top).toBe("0px");
  expect(chrome.right).toBe("0px");
  expect(chrome.bottom).toBe("0px");
  expect(chrome.left).toBe("0px");
  expect(chrome.shadow).toBe("none");
});

test("temporal group stays page-centered in one row and navigation has no selected-day state", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });

  const center = page.locator(".jig-header-center");
  const temporal = page.locator(".jig-header-temporal");
  const range = page.locator(".jig-header-week-range");
  const centerBox = await center.boundingBox();
  const temporalBox = await temporal.boundingBox();
  expect(centerBox).not.toBeNull();
  expect(temporalBox).not.toBeNull();
  if (centerBox !== null && temporalBox !== null) {
    expectNear(centerBox.x + centerBox.width / 2, 720, 4);
    expectNear(
      temporalBox.x + temporalBox.width / 2,
      centerBox.x + centerBox.width / 2,
      1,
    );
    expect(temporalBox.height).toBeLessThanOrEqual(44);
  }

  const rangeBefore = await range.textContent();
  await expect(page.locator(".jig-week-column-today")).toHaveCount(1);

  await page.getByRole("button", { name: "Next week" }).click();
  await expect(range).not.toHaveText(rangeBefore ?? "");
  await expect(page.locator(".jig-week-column-today")).toHaveCount(0);
  await expect(page.locator('[aria-current="date"]')).toHaveCount(0);

  await page.getByRole("button", { name: "Today", exact: true }).click();
  await expect(range).toHaveText(rangeBefore ?? "");
  await expect(page.locator(".jig-week-column-today")).toHaveCount(1);
});

test("desktop lanes keep equal widths but content-driven independent heights", async ({
  page,
}) => {
  const today = await browserCivilDate(page);
  const tomorrow = await browserCivilDate(page, 1);
  for (let index = 0; index < 8; index += 1) {
    await createTask(page, `Tall lane task ${index + 1}`, today);
  }
  await createTask(page, "Short lane task", tomorrow);
  await page.reload();
  await page.setViewportSize({ width: 1440, height: 900 });

  const board = page.locator(".jig-week-board");
  const columns = board.locator(".jig-week-column");
  const geometry = await columns.evaluateAll((elements) =>
    elements.map((element) => {
      const box = element.getBoundingClientRect();
      return { width: box.width, height: box.height };
    }),
  );

  expect(geometry).toHaveLength(7);
  for (const column of geometry) {
    expectNear(column.width, geometry[0]?.width ?? column.width, 1);
    expect(column.width).toBeGreaterThanOrEqual(160);
  }
  expect(Math.max(...geometry.map((column) => column.height)))
    .toBeGreaterThan(Math.min(...geometry.map((column) => column.height)));

  const todayColumn = page.locator(`[data-date="${today}"]`);
  await expect(todayColumn.getByRole("button", { name: /^Add task to / })).toBeVisible();
});

test("global Add exposes the full form and derives the current weekday in the displayed week", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const today = await browserCivilDate(page);

  await page.getByRole("button", { name: "Add task", exact: true }).first().click();
  let workspace = page.getByRole("dialog", { name: "Add task" });
  await expect(workspace.getByLabel("Title")).toBeVisible();
  await expect(workspace.getByLabel("Date")).toHaveValue(
    await displayedDateValue(page, today),
  );
  await expect(workspace.getByLabel("Context")).toBeVisible();
  await expect(workspace.getByText("Priority", { exact: true }).first()).toBeVisible();
  await expect(workspace.getByLabel("Reminder")).toBeVisible();
  await expect(workspace.getByLabel("Reference")).toBeVisible();
  await expect(workspace.getByLabel("Notes")).toBeVisible();
  await workspace.getByRole("button", { name: "Cancel", exact: true }).click();

  await page.getByRole("button", { name: "Next week" }).click();
  const correspondingNextWeekDate = await browserCivilDate(page, 7);
  await page.getByRole("button", { name: "Add task", exact: true }).first().click();
  workspace = page.getByRole("dialog", { name: "Add task" });
  await expect(workspace.getByLabel("Date")).toHaveValue(
    await displayedDateValue(page, correspondingNextWeekDate),
  );
});

test("per-date plus opens the same full form for its explicit date", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const firstDate = await page.locator(".jig-week-column").first().getAttribute("data-date");
  if (firstDate === null) {
    throw new Error("First Planner date is unavailable");
  }

  await page
    .locator(".jig-week-column")
    .first()
    .getByRole("button", { name: /^Add task to / })
    .click();

  const workspace = page.getByRole("dialog", { name: "Add task" });
  await expect(workspace.getByLabel("Date")).toHaveValue(
    await displayedDateValue(page, firstDate),
  );
  await expect(workspace.getByLabel("Context")).toBeVisible();
  await expect(workspace.getByLabel("Notes")).toBeVisible();
});

test("Task click opens the editable Drawer directly and blank content dismisses without saving", async ({
  page,
}) => {
  const today = await browserCivilDate(page);
  await createTask(page, "Editable directly", today);
  await page.reload();
  await page.setViewportSize({ width: 1440, height: 900 });

  const board = page.locator(".jig-week-board");
  const before = await board.boundingBox();
  await page.getByText("Editable directly", { exact: true }).click();

  const workspace = page.getByRole("dialog", { name: "Editable directly" });
  await expect(workspace).toBeVisible();
  await expect(workspace.getByLabel("Title")).toHaveValue("Editable directly");
  await expect(workspace.getByLabel("Date")).toHaveValue(
    await displayedDateValue(page, today),
  );
  await workspace.getByLabel("Title").fill("Unsaved replacement");

  const after = await board.boundingBox();
  expect(before).not.toBeNull();
  expect(after).not.toBeNull();
  if (before !== null && after !== null) {
    expectNear(after.width, before.width, 1);
  }

  await page.locator(".jig-content").click({ position: { x: 2, y: 2 } });
  await expect(workspace).toBeHidden();
  expect((await apiState(page)).tasks.some((task) => task.title === "Unsaved replacement"))
    .toBe(false);
});

test("selecting another Task retargets the open editable workspace", async ({ page }) => {
  const today = await browserCivilDate(page);
  await createTask(page, "Retarget first", today);
  await createTask(page, "Retarget second", today);
  await page.reload();

  await page.getByText("Retarget first", { exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Retarget first" })).toBeVisible();

  await page.getByText("Retarget second", { exact: true }).click();
  const second = page.getByRole("dialog", { name: "Retarget second" });
  await expect(second).toBeVisible();
  await expect(second.getByLabel("Title")).toHaveValue("Retarget second");
});

test("header is flat compact and invariant across destinations", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await waitForResponsiveHeader(page, 1440);
  const plannerHeight = await headerHeight(page);
  expect(plannerHeight).toBeLessThanOrEqual(44);

  const headerChrome = await page.locator(".jig-app-header").evaluate((element) => {
    const style = getComputedStyle(element);
    const body = getComputedStyle(document.body);
    return {
      background: style.backgroundColor,
      bodyBackground: body.backgroundColor,
      borderBottom: style.borderBottomWidth,
      radius: style.borderRadius,
      shadow: style.boxShadow,
    };
  });
  expect(headerChrome.background).toBe(headerChrome.bodyBackground);
  expect(headerChrome.borderBottom).not.toBe("0px");
  expect(headerChrome.radius).toBe("0px");
  expect(headerChrome.shadow).toBe("none");

  await page.getByRole("button", { name: "History", exact: true }).click();
  const historyHeight = await headerHeight(page);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const settingsHeight = await headerHeight(page);

  expectNear(historyHeight, plannerHeight, 1);
  expectNear(settingsHeight, plannerHeight, 1);

  await page.setViewportSize({ width: 390, height: 844 });
  await waitForResponsiveHeader(page, 390);
  const narrowHeight = await headerHeight(page);
  expect(narrowHeight).toBeLessThanOrEqual(56);
});

test("selected Task today priority and status use distinct governed semantics", async ({
  page,
}) => {
  const today = await browserCivilDate(page);
  await createTask(page, "Selected semantic task", today, "NORMAL");
  await page.reload();

  const todayHeader = page
    .locator(`[data-date="${today}"] .jig-week-column-header`);
  const task = page
    .getByText("Selected semantic task", { exact: true })
    .locator("xpath=ancestor::li[1]");
  await task.click();

  const semantics = await page.evaluate(() => {
    const todayElement = document.querySelector<HTMLElement>(
      ".jig-week-column-today .jig-week-column-header",
    );
    const selected = document.querySelector<HTMLElement>(
      ".jig-task-card-selected",
    );
    const status = document.querySelector<HTMLElement>(
      ".jig-status-control",
    );
    if (todayElement === null || selected === null || status === null) {
      throw new Error("Semantic state fixture unavailable");
    }
    return {
      todayBorder: getComputedStyle(todayElement).borderBottomColor,
      selectedBackground: getComputedStyle(selected).backgroundColor,
      selectedBorder: getComputedStyle(selected).borderColor,
      statusColor: getComputedStyle(status).color,
    };
  });

  await expect(todayHeader).toBeVisible();
  expect(semantics.todayBorder).not.toBe(semantics.selectedBorder);
  expect(semantics.todayBorder).not.toBe(semantics.statusColor);
  expect(semantics.selectedBackground).not.toBe("rgba(0, 0, 0, 0)");
});

test("narrow Planner shows all seven dated sections and preserves the same workspace draft", async ({
  page,
}) => {
  const today = await browserCivilDate(page);
  await createTask(page, "Mobile workspace task", today);
  await page.reload();
  await page.setViewportSize({ width: 390, height: 844 });

  await expect(page.locator(".jig-week-board")).toHaveCount(1);
  await expect(page.locator(".jig-week-board .jig-week-column")).toHaveCount(7);
  await expect(page.locator(".jig-planner-narrow")).toHaveCount(0);
  await expect(page.locator(".jig-week-strip-date")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Open navigation menu" })).toBeVisible();

  const labels = await page
    .locator(".jig-week-board .jig-week-date-signifier > strong")
    .allTextContents();
  expect(labels.map((label) => label.split(" ")[0])).toEqual([
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ]);

  await page.getByText("Mobile workspace task", { exact: true }).click();
  let workspace = page.getByRole("dialog", { name: "Mobile workspace task" });
  await workspace.getByLabel("Title").fill("Draft survives reflow");

  await page.setViewportSize({ width: 1440, height: 900 });
  workspace = page.getByRole("dialog", { name: "Mobile workspace task" });
  await expect(workspace.getByLabel("Title")).toHaveValue("Draft survives reflow");
});

test("desktop and narrow navigation share the same destinations and semantic icons", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });

  for (const label of ["Planner", "History", "Settings"]) {
    const button = page.getByRole("button", { name: label, exact: true });
    await expect(button).toBeVisible();
    await expect(button.locator("svg")).toHaveCount(1);
  }
  await expect(
    page.getByRole("button", { name: "Add task", exact: true }).first().locator("svg"),
  ).toHaveCount(1);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open navigation menu" }).click();

  const labels = await page.getByRole("menuitem").allTextContents();
  expect(labels.map((label) => label.trim().replace("Current page", "").trim()))
    .toEqual(["Planner", "History", "Settings"]);

  for (const label of ["Planner", "History", "Settings"]) {
    const iconCount = await page
      .getByRole("menuitem", { name: new RegExp(`^${label}`) })
      .locator("svg")
      .count();
    expect(iconCount).toBeGreaterThanOrEqual(1);
  }
});

test("outstanding Task action menus are identical at desktop and narrow widths", async ({
  page,
}) => {
  const today = await browserCivilDate(page);
  await createTask(page, "Menu first", today);
  await createTask(page, "Menu parity", today);
  await createTask(page, "Menu last", today);
  await page.reload();

  const menuLabels = async (): Promise<string[]> => {
    const row = page
      .getByText("Menu parity", { exact: true })
      .locator("xpath=ancestor::li[1]");
    await row.getByRole("button", { name: "Actions for Menu parity" }).click();
    const labels = (await page.getByRole("menuitem").allTextContents())
      .map((label) => label.trim());
    await page.keyboard.press("Escape");
    return labels;
  };

  await page.setViewportSize({ width: 1440, height: 900 });
  const desktop = await menuLabels();
  expect(desktop).toEqual([
    "Open / edit",
    "Complete",
    "Priority: High",
    "Priority: Normal",
    "Priority: Low",
    "Move up",
    "Move down",
    "Delete…",
  ]);

  await page.setViewportSize({ width: 390, height: 844 });
  expect(await menuLabels()).toEqual(desktop);
});

test("desktop History and Settings use an 800px centered content column", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await waitForResponsiveHeader(page, 1440);

  for (const destination of ["History", "Settings"] as const) {
    await page.getByRole("button", { name: destination, exact: true }).click();
    const selector =
      destination === "History" ? ".jig-history-view" : ".jig-settings-view";
    const box = await page.locator(selector).boundingBox();
    expect(box, destination).not.toBeNull();
    if (box !== null) {
      expectNear(box.width, 800, 1);
      expectNear(box.x, 320, 1);
    }
    if (destination === "Settings") {
      const overflow = await page.locator(".jig-settings-grid").evaluate(
        (element) => element.scrollWidth - element.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(1);
    }
  }

  await page.getByRole("button", { name: "Planner", exact: true }).click();
  const planner = await page.locator(".jig-week-board").boundingBox();
  expect(planner).not.toBeNull();
  if (planner !== null) {
    expectNear(planner.x, 0, 1);
    expectNear(planner.width, 1440, 1);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await waitForResponsiveHeader(page, 390);

  for (const destination of ["History", "Settings"] as const) {
    await page.getByRole("button", { name: "Open navigation menu" }).click();
    await page
      .getByRole("menuitem", { name: new RegExp(`^${destination}`) })
      .click();
    const selector =
      destination === "History" ? ".jig-history-view" : ".jig-settings-view";
    const box = await page.locator(selector).boundingBox();
    expect(box, destination).not.toBeNull();
    if (box !== null) {
      expectNear(box.x, 0, 1);
      expectNear(box.width, 390, 1);
    }
  }
});

test("application frame is full-bleed and switches at the 73rem boundary", async ({
  page,
}) => {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await waitForResponsiveHeader(page, viewport.width);
    for (const selector of [
      ".jig-app-shell",
      ".jig-app-header",
      ".jig-content-frame",
      ".jig-content",
    ]) {
      const box = await page.locator(selector).boundingBox();
      expect(box, selector).not.toBeNull();
      if (box !== null) {
        expectNear(box.x, 0, 1);
        expectNear(box.width, viewport.width, 1);
      }
    }

    const frame = await page.locator(".jig-content-frame").evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        margin: style.margin,
        padding: style.padding,
        border: style.borderWidth,
        radius: style.borderRadius,
        shadow: style.boxShadow,
      };
    });
    expect(frame.margin).toBe("0px");
    expect(frame.padding).toBe("0px");
    expect(frame.border).toBe("0px");
    expect(frame.radius).toBe("0px");
    expect(frame.shadow).toBe("none");
  }

  await page.setViewportSize({ width: 1168, height: 900 });
  await waitForResponsiveHeader(page, 1168);
  const desktopGeometry = await page.locator(".jig-week-column").evaluateAll(
    (elements) => elements.slice(0, 2).map((element) => {
      const box = element.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width };
    }),
  );
  expect(desktopGeometry).toHaveLength(2);
  expectNear(desktopGeometry[0]?.y ?? 0, desktopGeometry[1]?.y ?? 0, 1);
  expect(desktopGeometry[0]?.width ?? 0).toBeGreaterThanOrEqual(160);

  await page.setViewportSize({ width: 1167, height: 900 });
  await waitForResponsiveHeader(page, 1167);
  const narrowGeometry = await page.locator(".jig-week-column").evaluateAll(
    (elements) => elements.slice(0, 2).map((element) => {
      const box = element.getBoundingClientRect();
      return { y: box.y };
    }),
  );
  expect(narrowGeometry).toHaveLength(2);
  expect(narrowGeometry[1]?.y ?? 0).toBeGreaterThan(narrowGeometry[0]?.y ?? 0);
});

test("Task cards remain visibly separated from the canvas in Light and Dark responsive modes", async ({
  page,
}) => {
  const today = await browserCivilDate(page);
  await createTask(page, "Contrast contract", today);
  await page.reload();

  for (const theme of ["light", "dark"] as const) {
    await page.evaluate((value) => {
      localStorage.setItem("jig-theme", value);
    }, theme);
    await page.reload();

    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      const colors = await page.evaluate(() => {
        const card = document.querySelector<HTMLElement>(".jig-task-card");
        if (card === null) {
          throw new Error("Task card unavailable");
        }
        return {
          card: getComputedStyle(card).backgroundColor,
          canvas: getComputedStyle(document.body).backgroundColor,
          border: getComputedStyle(card).borderColor,
        };
      });
      expect(colors.card).not.toBe(colors.canvas);
      expect(colors.border).not.toBe("rgba(0, 0, 0, 0)");
    }
  }
});

test("History keeps its destination active while using the same editable workspace and complete menu", async ({
  page,
}) => {
  const today = await browserCivilDate(page);
  await createTask(page, "History detail contract", today);
  const created = (await apiState(page)).tasks.find(
    (task) => task.title === "History detail contract",
  );
  if (created === undefined) {
    throw new Error("History fixture missing");
  }
  await apiCommand(page, { type: "complete", task_id: created.id });
  await page.reload();

  await page.getByRole("button", { name: "History", exact: true }).click();
  await expect(page.getByRole("button", { name: "History", exact: true }))
    .toHaveAttribute("aria-current", "page");

  const row = page
    .getByText("History detail contract", { exact: true })
    .locator("xpath=ancestor::li[1]");
  await row.getByRole("button", { name: "Actions for History detail contract" }).click();
  await expect(page.getByRole("menuitem", { name: "Open / edit", exact: true })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Reopen", exact: true })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Priority: High", exact: true })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Delete…", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByText("History detail contract", { exact: true }).click();
  await expect(page.getByRole("dialog", { name: "History detail contract" })).toBeVisible();
  await expect(page.getByRole("button", { name: "History", exact: true }))
    .toHaveAttribute("aria-current", "page");
});
