import { mkdir, rename } from "node:fs/promises";
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

async function headerHeight(page: Page): Promise<number> {
  const box = await page.locator(".jig-app-header").boundingBox();
  if (box === null) {
    throw new Error("Application header geometry unavailable");
  }
  return box.height;
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

test("temporal centerpiece stays page-centered and week navigation has no selected-day state", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });

  const center = page.locator(".jig-header-center");
  const range = page.locator(".jig-header-week-range");
  const controls = page.locator(".jig-header-week-controls");
  const centerBox = await center.boundingBox();
  const rangeBox = await range.boundingBox();
  const controlsBox = await controls.boundingBox();
  expect(centerBox).not.toBeNull();
  expect(rangeBox).not.toBeNull();
  expect(controlsBox).not.toBeNull();
  if (centerBox !== null && rangeBox !== null && controlsBox !== null) {
    expectNear(centerBox.x + centerBox.width / 2, 720, 4);
    expect(rangeBox.y).toBeLessThan(controlsBox.y);
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

test("header outer height is invariant across Planner History and Settings", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const plannerHeight = await headerHeight(page);

  await page.getByRole("button", { name: "History", exact: true }).click();
  const historyHeight = await headerHeight(page);

  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const settingsHeight = await headerHeight(page);

  expectNear(historyHeight, plannerHeight, 1);
  expectNear(settingsHeight, plannerHeight, 1);
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

  await expect(page.locator(".jig-week-board")).toHaveCount(0);
  await expect(page.locator(".jig-planner-narrow .jig-week-column")).toHaveCount(7);
  await expect(page.locator(".jig-week-strip-date")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Open navigation menu" })).toBeVisible();

  const labels = await page
    .locator(".jig-planner-narrow .jig-week-date-signifier > strong")
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


const V104_EVIDENCE_OUTPUT = "v1.0.4-evidence-output";
const V104_REMOTE = "/tmp/jig-playwright-remote.git";
const V104_OFFLINE_REMOTE = "/tmp/jig-playwright-remote.offline.git";

async function captureV104(page: Page, name: string): Promise<void> {
  await page.screenshot({
    path: `${V104_EVIDENCE_OUTPUT}/${name}.png`,
    fullPage: true,
    animations: "disabled",
  });
}

async function repositoryStatusForEvidence(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const response = await fetch("/api/v1/status");
    if (!response.ok) {
      throw new Error(`GET /status failed: ${response.status}`);
    }
    const body = (await response.json()) as { repository_status: string };
    return body.repository_status;
  });
}

test("temporary v1.0.4 visual evidence capture", async ({ page }) => {
  test.setTimeout(90_000);
  await mkdir(V104_EVIDENCE_OUTPUT, { recursive: true });

  const today = await browserCivilDate(page);
  const tomorrow = await browserCivilDate(page, 1);
  const inTwoDays = await browserCivilDate(page, 2);

  await apiCommand(page, {
    type: "create",
    title: "Review contract changes",
    scheduled_date: today,
    priority: "HIGH",
    context: "Client Alpha",
    reminder_time: "10:30",
    reference: "https://example.com/matter/alpha",
    note: null,
  });
  await apiCommand(page, {
    type: "create",
    title: "Prepare implementation notes",
    scheduled_date: today,
    priority: "NORMAL",
    context: "Jig",
    reminder_time: null,
    reference: null,
    note: "Keep the functional core boundary explicit.",
  });
  await apiCommand(page, {
    type: "create",
    title: "Follow up with counsel",
    scheduled_date: tomorrow,
    priority: "LOW",
    context: "Client Alpha",
    reminder_time: null,
    reference: null,
    note: null,
  });
  await apiCommand(page, {
    type: "create",
    title: "Archive completed brief",
    scheduled_date: inTwoDays,
    priority: "NORMAL",
    context: null,
    reminder_time: null,
    reference: null,
    note: null,
  });

  await page.reload();
  await page.setViewportSize({ width: 1440, height: 900 });
  await captureV104(page, "desktop-planner-light");

  await page.getByText("Prepare implementation notes", { exact: true }).click();
  const taskWorkspace = page.getByRole("dialog", {
    name: "Prepare implementation notes",
  });
  await expect(taskWorkspace).toBeVisible();
  await captureV104(page, "desktop-planner-task-drawer");
  await taskWorkspace.getByRole("button", { name: "Close", exact: true }).click();

  const dragCard = page
    .getByText("Review contract changes", { exact: true })
    .locator("xpath=ancestor::li[1]");
  const dragBody = dragCard.locator(".jig-task-body");
  const destination = page.locator(`[data-date="${tomorrow}"]`);
  const sourceBox = await dragBody.boundingBox();
  const destinationBox = await destination.boundingBox();
  if (sourceBox === null || destinationBox === null) {
    throw new Error("Evidence drag geometry unavailable");
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
    destinationBox.x + destinationBox.width / 2,
    destinationBox.y + Math.min(120, destinationBox.height / 2),
    { steps: 12 },
  );
  await expect(destination).toHaveClass(/jig-date-drop-zone-active/);
  await captureV104(page, "desktop-planner-drag-target");
  await page.mouse.up();

  await page.evaluate(() => localStorage.setItem("jig-theme", "dark"));
  await page.reload();
  await page.setViewportSize({ width: 1440, height: 900 });
  await captureV104(page, "desktop-planner-dark");

  const archiveTask = (await apiState(page)).tasks.find(
    (task) => task.title === "Archive completed brief",
  );
  if (archiveTask === undefined) {
    throw new Error("History evidence Task unavailable");
  }
  await apiCommand(page, { type: "complete", task_id: archiveTask.id });
  await page.reload();

  await page.getByRole("button", { name: "History", exact: true }).click();
  await captureV104(page, "desktop-history");

  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await captureV104(page, "desktop-settings");

  await page.evaluate(() => localStorage.setItem("jig-theme", "light"));
  await page.reload();
  await page.getByRole("button", { name: "Planner", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await captureV104(page, "mobile-planner");

  await page.getByText("Prepare implementation notes", { exact: true }).click();
  const bottomSheet = page.getByRole("dialog", {
    name: "Prepare implementation notes",
  });
  await expect(bottomSheet).toBeVisible();
  await captureV104(page, "mobile-task-bottom-sheet");
  await bottomSheet.getByRole("button", { name: "Close", exact: true }).click();

  await page.setViewportSize({ width: 1440, height: 900 });
  await rename(V104_REMOTE, V104_OFFLINE_REMOTE);
  try {
    await apiCommand(page, {
      type: "create",
      title: "Locally safe during outage",
      scheduled_date: today,
      priority: "NORMAL",
      context: null,
      reminder_time: null,
      reference: null,
      note: null,
    });
    await expect
      .poll(() => repositoryStatusForEvidence(page), { timeout: 10_000 })
      .toMatch(/^(retrying|sync-issue)$/);
    await page.reload();
    await captureV104(page, "sync-issue");
  } finally {
    await rename(V104_OFFLINE_REMOTE, V104_REMOTE);
  }

  await page.getByText("Prepare implementation notes", { exact: true }).click();
  const failureWorkspace = page.getByRole("dialog", {
    name: "Prepare implementation notes",
  });
  await expect(failureWorkspace).toBeVisible();
  await page.route("**/api/v1/commands", async (route) => {
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: "Evidence local save failure" }),
    });
  });
  await failureWorkspace
    .getByRole("textbox", { name: /Notes/ })
    .fill("This change must not persist.");
  await failureWorkspace
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await expect(
    failureWorkspace.getByText("Evidence local save failure", { exact: true }),
  ).toBeVisible();
  await captureV104(page, "local-save-failure");
});
