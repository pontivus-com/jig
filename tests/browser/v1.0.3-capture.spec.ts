import { test, expect, type Page } from "@playwright/test";
import {
  apiCommand,
  apiState,
  browserCivilDate,
  resetCanonicalTasks,
} from "./helpers";

const EVIDENCE = "docs/evidence/v1.0.3/browser";

async function capture(page: Page, name: string): Promise<void> {
  await page.screenshot({
    path: `${EVIDENCE}/${name}.jpg`,
    type: "jpeg",
    quality: 62,
  });
}

async function create(
  page: Page,
  title: string,
  date: string,
  options: Readonly<{
    priority?: "HIGH" | "NORMAL" | "LOW";
    context?: string | null;
    note?: string | null;
    reminder?: string | null;
  }> = {},
): Promise<void> {
  await apiCommand(page, {
    type: "create",
    title,
    scheduled_date: date,
    priority: options.priority ?? "NORMAL",
    context: options.context ?? null,
    reference: null,
    note: options.note ?? null,
    reminder_time: options.reminder ?? null,
  });
}

test("capture v1.0.3 master-detail surfaces", async ({ page }) => {
  await page.goto("/");
  await resetCanonicalTasks(page);

  const today = await browserCivilDate(page);
  const next = await browserCivilDate(page, 1);
  const target = await browserCivilDate(page, 2);
  const plusThree = await browserCivilDate(page, 3);
  const plusFour = await browserCivilDate(page, 4);
  const plusFive = await browserCivilDate(page, 5);

  await create(page, "Legal — TTA workflow remediation", target, {
    priority: "HIGH",
    context: "Legal App",
    note: "Details live in the project.",
    reminder: "10:00",
  });
  await create(page, "Review Order lifecycle changes", target, {
    context: "Order",
    reminder: "14:00",
  });
  await create(page, "SPAN docs validation", target, {
    priority: "LOW",
    context: "SPAN",
  });
  await create(page, "Plan tomorrow", target, {
    context: "Planning",
    reminder: "17:00",
  });
  await create(page, "Today planning seed", today, { context: "Planning" });
  await create(page, "Prepare Jig design", next, { context: "Planning" });
  await create(page, "Review outstanding fixes", plusThree, { context: "Legal" });
  await create(page, "Prepare next week", plusThree, { context: "Order" });
  await create(page, "Reading and notes", plusFour, { context: "Personal" });
  await create(page, "Weekly review", plusFive, { context: "Planning" });
  await create(page, "Daily standup", target, { context: "Team" });

  const standup = (await apiState(page)).tasks.find(
    (task) => task.title === "Daily standup",
  );
  if (standup === undefined) throw new Error("standup fixture missing");
  await apiCommand(page, { type: "complete", task_id: standup.id });

  await page.reload();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.locator(".jig-week-strip-date").nth(3).click();

  const dayCard = page
    .getByText("Legal — TTA workflow remediation", { exact: true })
    .locator("xpath=ancestor::li[contains(@class,'jig-task-card')][1]");
  await dayCard.click();
  console.log(
    "JIG_V103_METRICS:desktop-day:" +
      JSON.stringify({
        rail: await page.locator(".jig-primary-nav").boundingBox(),
        primary: await page.locator(".jig-day-primary").boundingBox(),
        workspace: await page.locator(".jig-day-layout > .jig-task-inspector").boundingBox(),
        selectedCard: await dayCard.boundingBox(),
      }),
  );
  await capture(page, "desktop-day-workspace");

  await page
    .locator(".jig-primary-nav")
    .getByRole("button", { name: "Week", exact: true })
    .click();

  const weekBoard = page.locator(".jig-week-board");
  const weekColumns = page.locator(".jig-week-column");
  console.log(
    "JIG_V103_METRICS:desktop-week-1440:" +
      JSON.stringify({
        board: await weekBoard.boundingBox(),
        firstColumn: await weekColumns.first().boundingBox(),
        rail: await page.locator(".jig-primary-nav").boundingBox(),
      }),
  );
  await capture(page, "desktop-week-full");

  const weekCard = page
    .getByText("Legal — TTA workflow remediation", { exact: true })
    .locator("xpath=ancestor::li[contains(@class,'jig-task-card')][1]");
  await weekCard.click();
  await expect(
    page.getByRole("dialog", { name: "Legal — TTA workflow remediation" }),
  ).toBeVisible();
  await page.waitForTimeout(300);
  console.log(
    "JIG_V103_METRICS:desktop-week-drawer:" +
      JSON.stringify({
        drawer: await page
          .getByRole("dialog", { name: "Legal — TTA workflow remediation" })
          .boundingBox(),
        board: await weekBoard.boundingBox(),
      }),
  );
  await capture(page, "desktop-week-task-drawer");

  await page
    .getByRole("dialog", { name: "Legal — TTA workflow remediation" })
    .getByRole("button", { name: "Edit", exact: true })
    .click();
  await expect(page.getByRole("dialog", { name: "Edit task" })).toBeVisible();
  await capture(page, "desktop-week-task-edit");

  await page.getByRole("button", { name: "Close", exact: false }).first().click().catch(() => undefined);
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 1920, height: 900 });
  console.log(
    "JIG_V103_METRICS:desktop-week-1920:" +
      JSON.stringify({
        board: await weekBoard.boundingBox(),
        firstColumn: await weekColumns.first().boundingBox(),
      }),
  );
  await capture(page, "desktop-week-wide");

  await page.setViewportSize({ width: 414, height: 980 });
  await page.goto("/");
  await page.locator(".jig-week-strip-date").nth(3).click();
  const mobileCard = page
    .getByText("Legal — TTA workflow remediation", { exact: true })
    .locator("xpath=ancestor::li[contains(@class,'jig-task-card')][1]");
  await mobileCard.click();
  await expect(
    page.getByRole("dialog", { name: "Legal — TTA workflow remediation" }),
  ).toBeVisible();
  await page
    .getByRole("dialog", { name: "Legal — TTA workflow remediation" })
    .getByRole("button", { name: "Edit", exact: true })
    .click();
  const mobileDrawer = page.getByRole("dialog", { name: "Edit task" });
  await expect(mobileDrawer).toBeVisible();
  await page.waitForTimeout(300);
  console.log(
    "JIG_V103_METRICS:mobile-workspace:" +
      JSON.stringify({
        drawer: await mobileDrawer.boundingBox(),
        frame: await page.locator(".jig-content-frame").boundingBox(),
      }),
  );
  await capture(page, "mobile-task-edit-drawer");
});
