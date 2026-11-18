import { expect, test } from "@playwright/test";

test("configured browser shell boots without uncaught page errors", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => {
    pageErrors.push(error.stack ?? error.message);
  });

  await page.goto("/");

  const plannerHome = page.getByRole("button", {
    name: "Planner home",
  });
  try {
    await expect(plannerHome).toBeVisible({ timeout: 5_000 });
  } catch (error) {
    const body = await page
      .locator("body")
      .innerText()
      .catch(() => "<body unavailable>");
    console.error(`Jig browser bootstrap body:\n${body}`);
    console.error(
      `Jig browser page errors:\n${pageErrors.join("\n---\n") || "<none>"}`,
    );
    throw error;
  }

  expect(pageErrors).toEqual([]);
});
