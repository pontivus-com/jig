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
  for (const destination of ["Week", "Day", "History", "Settings"]) {
    await expect(
      page.locator(".jig-primary-nav").getByRole("button", {
        name: destination,
        exact: true,
      }),
    ).toBeVisible();
  }
  await expect(
    page.locator(".jig-primary-nav").getByRole("button", {
      name: "Day",
      exact: true,
    }),
  ).toHaveAttribute("aria-current", "page");
});

function expectNear(actual: number, expected: number, tolerance = 2): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}


test("desktop geometry matches the canonical 1440×900 reference coordinates", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });

  const sidebar = await page.locator(".jig-primary-nav").boundingBox();
  expect(sidebar).not.toBeNull();
  if (sidebar === null) return;
  expectNear(sidebar.x, 20);
  expectNear(sidebar.y, 20);
  expectNear(sidebar.width, 190);
  expectNear(sidebar.height, 860);

  const heading = await page.locator(".jig-reference-heading").boundingBox();
  expect(heading).not.toBeNull();
  if (heading === null) return;
  expectNear(heading.x, 240);
  expectNear(heading.y, 34);

  await page.getByRole("button", { name: "Week", exact: true }).click();
  const board = await page.locator(".jig-week-board").boundingBox();
  expect(board).not.toBeNull();
  if (board === null) return;
  expectNear(board.x, 240);
  expectNear(board.y, 145);
  expectNear(board.width, 1168);

  const columns = page.locator(".jig-week-column");
  await expect(columns).toHaveCount(7);
  for (let index = 0; index < 7; index += 1) {
    const box = await columns.nth(index).boundingBox();
    expect(box).not.toBeNull();
    if (box === null) continue;
    expectNear(box.width, 160);
    expectNear(box.x, 240 + index * 168);
    expectNear(box.y, 145);
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
    expectNear(primary.x, 240);
    expectNear(primary.width, 650);
    expectNear(inspector.x, 920);
    expectNear(inspector.y, 145);
    expectNear(inspector.width, 490);
  }

  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const cards = page.locator(".jig-settings-card");
  await expect(cards).toHaveCount(4);
  const planning = await cards.nth(0).boundingBox();
  const sync = await cards.nth(1).boundingBox();
  if (planning !== null && sync !== null) {
    expectNear(planning.x, 240);
    expectNear(planning.width, 560);
    expectNear(sync.x, 830);
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

test("Week fits seven visible columns at the canonical desktop viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("button", { name: "Week", exact: true }).click();

  const board = page.locator(".jig-week-board");
  await expect(board).toBeVisible();
  await expect(board.locator(".jig-week-column")).toHaveCount(7);

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
