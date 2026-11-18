import { expect, test } from "@playwright/test";

test("bootstrap setup gates Planner and accepts an existing local repository", async ({
  page,
}) => {
  let configured = false;
  let submittedPath: string | null = null;
  let taskRequests = 0;

  await page.route("**/api/v1/setup/status", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        configured
          ? { mode: "configured" }
          : {
              mode: "bootstrap",
              local_repository_available: true,
              github_available: false,
            },
      ),
    });
  });

  await page.route("**/api/v1/setup/local-repository", async (route) => {
    const request = route.request();
    const body = request.postDataJSON() as { repository_path?: unknown };
    submittedPath =
      typeof body.repository_path === "string"
        ? body.repository_path
        : null;
    configured = true;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        configured: true,
        repository_path: submittedPath,
      }),
    });
  });

  await page.route("**/api/v1/tasks", async (route) => {
    taskRequests += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ revision: 0, tasks: [] }),
    });
  });
  await page.route("**/api/v1/status", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ready: true,
        repository_path: "/tmp/planning",
        repository_status: "local-only",
      }),
    });
  });
  await page.route("**/api/v1/diagnostics", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        service_healthy: true,
        sqlite_available: true,
        sqlite_schema_version: 2,
        repository_path: "/tmp/planning",
        portable_format_version: 1,
        repository_adapter_healthy: true,
      }),
    });
  });

  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Set up Jig" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Use this repository" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect GitHub" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add task", exact: true })).toHaveCount(0);
  expect(taskRequests).toBe(0);

  await page.getByLabel("Repository path").fill("/tmp/planning");
  await page.getByRole("button", { name: "Use this repository" }).click();

  await expect.poll(() => submittedPath).toBe("/tmp/planning");
  await expect(
    page.getByRole("button", { name: "Add task", exact: true }),
  ).toBeVisible({ timeout: 5_000 });
  expect(taskRequests).toBeGreaterThan(0);
});

test("bootstrap keeps invalid repository errors on the setup surface", async ({
  page,
}) => {
  await page.route("**/api/v1/setup/status", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        mode: "bootstrap",
        local_repository_available: true,
        github_available: false,
      }),
    });
  });
  await page.route("**/api/v1/setup/local-repository", async (route) => {
    await route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({
        error: "Selected repository is not accessible and writable",
      }),
    });
  });

  await page.goto("/");
  await page.getByLabel("Repository path").fill("/does/not/exist");
  await page.getByRole("button", { name: "Use this repository" }).click();

  await expect(
    page.getByText("Selected repository is not accessible and writable"),
  ).toBeVisible();
  await expect(page.getByLabel("Repository path")).toHaveValue(
    "/does/not/exist",
  );
});
