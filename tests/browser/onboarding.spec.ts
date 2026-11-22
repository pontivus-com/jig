import { expect, test, type Page } from "@playwright/test";

async function installBootstrapCapabilityFixture(
  page: Page,
  localRepositoryAvailable: boolean,
): Promise<void> {
  await page.route("**/api/v1/setup/status", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        mode: "bootstrap",
        local_repository_available: localRepositoryAvailable,
      }),
    });
  });
  await page.route("**/api/v1/github/status", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        onboarding_available: true,
        reconnect_available: false,
      }),
    });
  });
}

test("narrow Linux setup exposes genuine local-repository capability and preserves state across layout switches", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installBootstrapCapabilityFixture(page, true);
  await page.goto("/");

  await expect(
    page.locator('[data-jig-setup-presentation="narrow"]'),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Connect GitHub repository",
      exact: true,
    }),
  ).toBeVisible();

  const localRepository = page.getByRole("button", {
    name: "Use an existing local repository",
    exact: true,
  });
  await expect(localRepository).toBeVisible();
  await localRepository.click();

  const path = page.getByLabel("Repository path");
  await path.fill("/home/example/planning");
  await expect(path).toHaveValue("/home/example/planning");

  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(
    page.locator('[data-jig-setup-presentation="desktop"]'),
  ).toBeVisible();
  await expect(page.getByLabel("Repository path")).toHaveValue(
    "/home/example/planning",
  );

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.locator('[data-jig-setup-presentation="narrow"]'),
  ).toBeVisible();
  await expect(page.getByLabel("Repository path")).toHaveValue(
    "/home/example/planning",
  );
});

test("setup width never creates a local-repository capability", async ({
  page,
}) => {
  await installBootstrapCapabilityFixture(page, false);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  await expect(
    page.locator('[data-jig-setup-presentation="desktop"]'),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Use an existing local repository",
      exact: true,
    }),
  ).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.locator('[data-jig-setup-presentation="narrow"]'),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Use an existing local repository",
      exact: true,
    }),
  ).toHaveCount(0);
});
