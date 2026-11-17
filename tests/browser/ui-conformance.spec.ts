import { expect, test } from "@playwright/test";
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

test("desktop shell uses the governed rail and Day is the initial destination", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });

  await expect(page.locator(".jig-primary-nav")).toBeVisible();
  await expect(page.locator(".jig-topbar")).toHaveCount(0);
  await expect(page.locator(".jig-shell")).toHaveCount(0);
  await expect(page.locator(".jig-sidebar")).toHaveCount(0);
  await expect(page.getByRole("main")).toHaveCount(1);
  const navigation = page.locator(".jig-primary-nav");
  const destinationButtons = navigation.getByRole("button");
  await expect(destinationButtons).toHaveCount(4);
  await expect(destinationButtons.nth(0)).toHaveText("Day");
  await expect(destinationButtons.nth(1)).toHaveText("Week");
  await expect(destinationButtons.nth(2)).toHaveText("History");
  await expect(destinationButtons.nth(3)).toHaveText("Settings");
  for (const destination of ["Day", "Week", "History", "Settings"]) {
    const button = navigation.getByRole("button", {
      name: destination,
      exact: true,
    });
    await expect(button).toBeVisible();
    await expect(button.locator("svg")).toHaveCount(1);
  }
  await expect(
    page.locator(".jig-primary-nav").getByRole("button", {
      name: "Day",
      exact: true,
    }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    page.locator(".jig-status-control .jig-status-dot"),
  ).toBeVisible();
});

function expectNear(actual: number, expected: number, tolerance = 2): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}


test("desktop shell uses a compact rail and Week expands into reclaimed canvas", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });

  const sidebar = await page.locator(".jig-primary-nav").boundingBox();
  expect(sidebar).not.toBeNull();
  if (sidebar === null) return;
  expectNear(sidebar.x, 20);
  expectNear(sidebar.y, 20);
  expectNear(sidebar.width, 96);
  expectNear(sidebar.height, 860);

  const heading = await page.locator(".jig-reference-heading").boundingBox();
  expect(heading).not.toBeNull();
  if (heading === null) return;
  expectNear(heading.x, 132);
  expectNear(heading.y, 34);

  await page.getByRole("button", { name: "Week", exact: true }).click();
  const board = await page.locator(".jig-week-board").boundingBox();
  expect(board).not.toBeNull();
  if (board === null) return;
  expectNear(board.x, 132);
  expect(board.width).toBeGreaterThan(1200);

  const columns = page.locator(".jig-week-column");
  await expect(columns).toHaveCount(7);
  const first = await columns.first().boundingBox();
  expect(first).not.toBeNull();
  if (first !== null) {
    expect(first.width).toBeGreaterThan(170);
    expectNear(first.x, 132);
  }

  await page.setViewportSize({ width: 1920, height: 900 });
  const wideBoard = await board.boundingBox();
  const wideFirst = await columns.first().boundingBox();
  expect(wideBoard).not.toBeNull();
  expect(wideFirst).not.toBeNull();
  if (wideBoard !== null && wideFirst !== null) {
    expect(wideBoard.width).toBeGreaterThan(1650);
    expect(wideFirst.width).toBeGreaterThan(230);
  }
});

test("Day and Settings use the canonical desktop split geometry", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });

  const primary = await page.locator(".jig-day-primary").boundingBox();
  const inspector = await page.locator(".jig-task-inspector").boundingBox();
  expect(primary).not.toBeNull();
  expect(inspector).not.toBeNull();
  if (primary !== null && inspector !== null) {
    expectNear(primary.x, 132);
    expectNear(primary.width, 650);
    expectNear(inspector.x, 812);
    expectNear(inspector.y, 145);
    expectNear(inspector.width, 490);
  }
  await expect(
    page.getByRole("button", { name: "Previous day", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Next day", exact: true }),
  ).toHaveCount(0);

  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const cards = page.locator(".jig-settings-card");
  await expect(cards).toHaveCount(4);
  const planning = await cards.nth(0).boundingBox();
  const sync = await cards.nth(1).boundingBox();
  if (planning !== null && sync !== null) {
    expectNear(planning.x, 132);
    expectNear(planning.width, 560);
    expectNear(sync.x, 722);
    expectNear(sync.width, 580);
  }
});

test("414px mobile geometry matches the canonical framed Day reference", async ({
  page,
}) => {
  await page.setViewportSize({ width: 414, height: 900 });

  const main = await page.locator(".jig-content-frame").boundingBox();
  expect(main).not.toBeNull();
  if (main === null) return;
  expectNear(main.x, 12);
  expectNear(main.y, 12);
  expectNear(main.width, 390);
  expectNear(main.height, 876);

  const dates = page.locator(".jig-week-strip-date");
  await expect(dates).toHaveCount(7);
  const firstDate = await dates.first().boundingBox();
  expect(firstDate).not.toBeNull();
  if (firstDate !== null) {
    expectNear(firstDate.x, 26);
    expectNear(firstDate.y, 108, 3);
    expectNear(firstDate.width, 44, 3);
    expectNear(firstDate.height, 56);
  }

  const quickAdd = await page
    .getByRole("button", { name: "Add task", exact: true })
    .last()
    .boundingBox();
  expect(quickAdd).not.toBeNull();
  if (quickAdd !== null) {
    expectNear(quickAdd.x, 318, 3);
    expectNear(quickAdd.y, 803, 3);
    expectNear(quickAdd.width, 62, 3);
    expectNear(quickAdd.height, 52, 3);
  }
});

test("Week keeps seven usable columns visible while consuming the desktop canvas", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("button", { name: "Week", exact: true }).click();

  const board = page.locator(".jig-week-board");
  await expect(board).toBeVisible();
  await expect(board.locator(".jig-week-column")).toHaveCount(7);
  await expect(
    page.getByText("Drop or add a task", { exact: true }),
  ).toHaveCount(0);

  const geometry = await board.evaluate((element) => {
    const boardRect = element.getBoundingClientRect();
    const columns = [...element.querySelectorAll(".jig-week-column")];
    return {
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
      visible: columns.every((column) => {
        const rect = column.getBoundingClientRect();
        return (
          rect.left >= boardRect.left - 1 &&
          rect.right <= boardRect.right + 1
        );
      }),
    };
  });

  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
  expect(geometry.visible).toBe(true);
});

test("Week card selection keeps Week active and opens a non-modal right task workspace", async ({
  page,
}) => {
  const today = await browserCivilDate(page);
  await apiCommand(page, {
    type: "create",
    title: "Week workspace contract",
    scheduled_date: today,
    priority: "NORMAL",
    context: "Planning",
    reference: null,
    note: "Keep the board in sight.",
    reminder_time: null,
  });
  await page.reload();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("button", { name: "Week", exact: true }).click();

  const card = page
    .getByText("Week workspace contract", { exact: true })
    .locator("xpath=ancestor::li[contains(@class,'jig-task-card')][1]");
  await card.click();

  await expect(
    page.locator(".jig-primary-nav").getByRole("button", {
      name: "Week",
      exact: true,
    }),
  ).toHaveAttribute("aria-current", "page");
  await expect(page.locator(".jig-week-board")).toBeVisible();

  const drawer = page.getByRole("dialog", {
    name: "Week workspace contract",
  });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText("Keep the board in sight.")).toBeVisible();

  await drawer.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Edit task" })).toBeVisible();
  await expect(page.getByLabel("Title")).toHaveValue("Week workspace contract");
  await expect(page.locator(".jig-week-board")).toBeVisible();
});

test("Day Add task edits in the docked workspace without opening a task dialog", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page
    .locator(".jig-day-toolbar")
    .getByRole("button", { name: "Add task", exact: true })
    .click();

  await expect(page.getByRole("dialog", { name: "Add task" })).toHaveCount(0);
  const workspace = page.locator('section[aria-label="Add task"]');
  await expect(workspace).toBeVisible();
  await expect(workspace.getByLabel("Title")).toBeVisible();
  await expect(workspace.getByRole("button", { name: "Add task" })).toBeVisible();
});

test("Week Quick add uses the right Drawer instead of a centered task modal", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("button", { name: "Week", exact: true }).click();
  await page.getByRole("button", { name: "Quick add", exact: false }).click();

  const drawer = page.getByRole("dialog", { name: "Add task" });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByLabel("Title")).toBeVisible();
  await expect(page.locator(".jig-week-board")).toBeVisible();
});

test("Task cards expose content, grip and one overflow affordance without action words", async ({
  page,
}) => {
  const today = await browserCivilDate(page);
  await apiCommand(page, {
    type: "create",
    title: "Card interaction contract",
    scheduled_date: today,
    priority: "HIGH",
    context: "Planning",
    reference: null,
    note: null,
    reminder_time: null,
  });
  await page.reload();

  const card = page
    .getByText("Card interaction contract", { exact: true })
    .locator("xpath=ancestor::li[contains(@class,'jig-task-card')][1]");
  await expect(card).toBeVisible();
  await expect(card.getByText("≡", { exact: true })).toBeVisible();
  await expect(
    card.getByRole("button", { name: "Actions for Card interaction contract" }),
  ).toBeVisible();

  await expect(card.getByText("Drag", { exact: true })).toBeHidden();
  await expect(
    page.getByRole("menuitem", { name: "Edit", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("menuitem", { name: "Move up", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("menuitem", { name: "Move down", exact: true }),
  ).toHaveCount(0);

  await card
    .getByRole("button", {
      name: "Actions for Card interaction contract",
    })
    .click();
  await expect(
    page.getByRole("menuitem", { name: "Edit", exact: true }),
  ).toBeVisible();
});

test("Day renders one canonical Attention sequence and a desktop inspector", async ({
  page,
}) => {
  const today = await browserCivilDate(page);
  await apiCommand(page, {
    type: "create",
    title: "Inspector contract",
    scheduled_date: today,
    priority: "NORMAL",
    context: "Legal",
    reference: "https://example.com/context",
    note: "Review the exact wording.",
    reminder_time: "16:00",
  });
  await page.reload();
  await page.setViewportSize({ width: 1440, height: 900 });

  await expect(
    page.getByRole("heading", { name: "Attention", exact: true }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("heading", { name: "Carried over", exact: true }),
  ).toHaveCount(0);

  const card = page
    .getByText("Inspector contract", { exact: true })
    .locator("xpath=ancestor::li[contains(@class,'jig-task-card')][1]");
  await card.click();

  const inspector = page.getByRole("complementary", {
    name: "Task details for Inspector contract",
  });
  await expect(inspector).toBeVisible();
  await expect(inspector.getByText("Legal", { exact: true })).toBeVisible();
  await expect(inspector.getByText("Review the exact wording.")).toBeVisible();
  await expect(
    inspector.getByRole("button", { name: "Edit", exact: true }),
  ).toBeVisible();
});

test("History exposes canonical scheduled date and actual completion time", async ({
  page,
}) => {
  const today = await browserCivilDate(page);
  await apiCommand(page, {
    type: "create",
    title: "History semantics",
    scheduled_date: today,
    priority: "NORMAL",
    context: "Ops",
    reference: null,
    note: null,
    reminder_time: null,
  });
  const created = (await apiState(page)).tasks.find(
    (task) => task.title === "History semantics",
  );
  if (created === undefined) {
    throw new Error("created Task missing");
  }
  await apiCommand(page, {
    type: "complete",
    task_id: created.id,
  });
  await page.reload();
  await page.getByRole("button", { name: "History", exact: true }).click();

  const row = page
    .getByText("History semantics", { exact: true })
    .locator("xpath=ancestor::li[1]");
  await expect(row.getByText(/Scheduled /)).toBeVisible();
  await expect(row.locator("time")).not.toHaveText("");

  const groupHeading = page.locator(".jig-history-group-heading").first();
  const dateHeading = await groupHeading.getByRole("heading").boundingBox();
  const count = await groupHeading.locator(".jig-task-count").boundingBox();
  expect(dateHeading).not.toBeNull();
  expect(count).not.toBeNull();
  if (dateHeading !== null && count !== null) {
    expectNear(count.x, dateHeading.x, 1);
    expect(count.y).toBeGreaterThan(dateHeading.y);
  }
});

test("Day card density matches active/completed reference hierarchy", async ({
  page,
}) => {
  const today = await browserCivilDate(page);
  for (const [index, title] of [
    "Density active one",
    "Density active two",
    "Density active three",
    "Density active four",
  ].entries()) {
    await apiCommand(page, {
      type: "create",
      title,
      scheduled_date: today,
      priority: index === 0 ? "HIGH" : "NORMAL",
      context: "Planning",
      reference: null,
      note: null,
      reminder_time: index === 0 ? "10:00" : null,
    });
  }
  await apiCommand(page, {
    type: "create",
    title: "Density completed",
    scheduled_date: today,
    priority: "NORMAL",
    context: "Team",
    reference: null,
    note: null,
    reminder_time: null,
  });
  const completed = (await apiState(page)).tasks.find(
    (task) => task.title === "Density completed",
  );
  if (completed === undefined) throw new Error("completed density fixture missing");
  await apiCommand(page, { type: "complete", task_id: completed.id });
  await page.reload();

  await page.setViewportSize({ width: 1440, height: 900 });
  const desktopActive = page
    .getByText("Density active one", { exact: true })
    .locator("xpath=ancestor::li[contains(@class,'jig-task-card')][1]");
  const desktopCompleted = page
    .getByText("Density completed", { exact: true })
    .locator("xpath=ancestor::li[contains(@class,'jig-task-card')][1]");
  const desktopActiveBox = await desktopActive.boundingBox();
  const desktopCompletedBox = await desktopCompleted.boundingBox();
  expect(desktopActiveBox).not.toBeNull();
  expect(desktopCompletedBox).not.toBeNull();
  if (desktopActiveBox !== null && desktopCompletedBox !== null) {
    expectNear(desktopActiveBox.height, 86, 2);
    expectNear(desktopCompletedBox.height, 62, 2);
  }

  await page.setViewportSize({ width: 414, height: 900 });
  const mobileActiveBox = await desktopActive.boundingBox();
  const mobileCompletedBox = await desktopCompleted.boundingBox();
  const quickAdd = await page
    .getByRole("button", { name: "Add task", exact: true })
    .last()
    .boundingBox();
  expect(mobileActiveBox).not.toBeNull();
  expect(mobileCompletedBox).not.toBeNull();
  expect(quickAdd).not.toBeNull();
  if (
    mobileActiveBox !== null &&
    mobileCompletedBox !== null &&
    quickAdd !== null
  ) {
    expectNear(mobileActiveBox.y, 282, 4);
    expectNear(mobileActiveBox.height, 88, 2);
    expectNear(mobileCompletedBox.height, 66, 2);
    expect(quickAdd.y).toBeGreaterThanOrEqual(
      mobileCompletedBox.y + mobileCompletedBox.height,
    );
  }
});

test("mobile task editing uses the right-side task workspace rather than the old editor modal", async ({
  page,
}) => {
  const today = await browserCivilDate(page);
  await apiCommand(page, {
    type: "create",
    title: "Editor geometry",
    scheduled_date: today,
    priority: "HIGH",
    context: "Legal",
    reference: null,
    note: "Reference editor geometry",
    reminder_time: "10:00",
  });
  await page.reload();
  await page.setViewportSize({ width: 414, height: 980 });

  const card = page
    .getByText("Editor geometry", { exact: true })
    .locator("xpath=ancestor::li[contains(@class,'jig-task-card')][1]");
  await card.click();

  const details = page.getByRole("dialog", { name: "Editor geometry" });
  await expect(details).toBeVisible();
  await details.getByRole("button", { name: "Edit", exact: true }).click();

  const editor = page.getByRole("dialog", { name: "Edit task" });
  await expect(editor).toBeVisible();
  const frame = await editor.boundingBox();
  expect(frame).not.toBeNull();
  if (frame !== null) {
    expectNear(frame.x + frame.width, 414, 3);
    expect(frame.width).toBeGreaterThanOrEqual(350);
    expect(frame.height).toBeGreaterThan(900);
  }

  const fieldLabels = [
    "Title",
    "Date",
    "Context",
    "Priority",
    "Reminder",
    "Reference",
    "Notes",
  ];
  for (const label of fieldLabels) {
    await expect(editor.getByLabel(label, { exact: true })).toBeVisible();
  }
  await expect(editor.getByRole("button", { name: "Cancel" })).toBeVisible();
  await expect(editor.getByRole("button", { name: "Save" })).toBeVisible();
  await expect(page.locator(".jig-editor-mobile-frame")).toHaveCount(0);
});

test("narrow shell keeps all destinations reachable and the seven-date strip fits", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });

  await expect(page.locator(".jig-primary-nav")).toBeHidden();
  await expect(page.locator(".jig-mobile-header")).toBeVisible();
  await expect(page.locator(".jig-mobile-surface-nav")).toBeVisible();
  await expect(page.locator(".jig-mobile-destination-menu")).toHaveCount(0);
  await expect(page.locator(".jig-day-toolbar")).toHaveCount(0);
  await expect(page.locator(".jig-task-inspector")).toHaveCount(0);

  await page.locator(".jig-mobile-destination-trigger").click();
  const mobileNavigation = page.locator(".jig-primary-nav");
  await expect(mobileNavigation).toBeVisible();
  for (const label of ["Week", "Day", "History", "Settings"]) {
    await expect(
      mobileNavigation.getByRole("button", { name: label, exact: true }),
    ).toBeVisible();
  }
  await mobileNavigation
    .getByRole("button", { name: "Day", exact: true })
    .click();

  const strip = page.locator(".jig-week-strip");
  await expect(strip.locator(".jig-week-strip-date")).toHaveCount(7);
  const geometry = await strip.evaluate((element) => ({
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
  }));
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
  await expect(
    page.getByRole("button", { name: "Add task", exact: true }),
  ).toBeVisible();
});

test("Settings exposes product diagnostics without Git-management workflow", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Settings", exact: true }).click();

  for (const heading of [
    "Appearance",
    "Planning data",
    "Synchronization",
    "Diagnostics",
  ]) {
    await expect(
      page.getByRole("heading", { name: heading, exact: true }),
    ).toBeVisible();
  }

  const diagnostics = page.locator(".jig-settings-diagnostics");
  await expect(
    diagnostics.getByText("Local database", { exact: true }),
  ).toBeVisible();
  await expect(
    diagnostics.getByText("Portable data", { exact: true }),
  ).toBeVisible();
  await expect(diagnostics.getByText("Format v1", { exact: true })).toHaveCount(0);
  await expect(
    diagnostics.getByText("Repository adapter", { exact: true }),
  ).toHaveCount(0);

  const body = await page.locator("body").innerText();
  for (const forbidden of [
    "Migrate",
    "Git worktree",
    "Remote origin",
    "branch/ref",
  ]) {
    expect(body).not.toContain(forbidden);
  }
});
