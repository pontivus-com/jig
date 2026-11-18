import { expect, test } from "@playwright/test";

async function routeGitHubStatus(
  page: import("@playwright/test").Page,
  status: {
    readonly onboarding_available: boolean;
    readonly reconnect_available: boolean;
  },
): Promise<void> {
  await page.route("**/api/v1/github/status", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(status),
    });
  });
}

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
            },
      ),
    });
  });
  await routeGitHubStatus(page, {
    onboarding_available: false,
    reconnect_available: false,
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

  await expect(
    page.getByRole("heading", { name: "Set up Jig" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Use this repository" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Connect GitHub" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add task", exact: true }),
  ).toHaveCount(0);
  expect(taskRequests).toBe(0);

  await page.getByLabel("Repository path").fill("/tmp/planning");
  await page
    .getByRole("button", { name: "Use this repository" })
    .click();

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
      }),
    });
  });
  await routeGitHubStatus(page, {
    onboarding_available: false,
    reconnect_available: false,
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
  await page
    .getByRole("button", { name: "Use this repository" })
    .click();

  await expect(
    page.getByText("Selected repository is not accessible and writable"),
  ).toBeVisible();
  await expect(page.getByLabel("Repository path")).toHaveValue(
    "/does/not/exist",
  );
});

test("Connect GitHub presents the direct Device Flow code and verification action", async ({
  page,
}) => {
  await page.route("**/api/v1/setup/status", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        mode: "bootstrap",
        local_repository_available: true,
      }),
    });
  });
  await routeGitHubStatus(page, {
    onboarding_available: true,
    reconnect_available: false,
  });

  await page.route("**/api/v1/setup/github/start", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        available: true,
        phase: "authorizing",
        authorization: {
          mode: "device",
          verification_uri: "https://github.com/login/device",
          user_code: "ABCD-EFGH",
          retry_after_seconds: 5,
        },
        grant_access_url: null,
        manage_access: [],
        installations: [],
        repositories: [],
        error: null,
      }),
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Connect GitHub" }).click();

  await expect(page.getByText("ABCD-EFGH", { exact: true })).toBeVisible();
  await expect(
    page.getByText("at GitHub's device authorization page to continue."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Open GitHub device authorization" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Refresh access" }),
  ).toBeVisible();
  await expect(page.getByText(/client_secret|Redirect URI/i)).toHaveCount(0);
});

test("Device Flow continues polling when GitHub returns the same interval", async ({
  page,
}) => {
  let refreshCalls = 0;
  await page.route("**/api/v1/setup/status", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        mode: "bootstrap",
        local_repository_available: true,
      }),
    });
  });
  await routeGitHubStatus(page, {
    onboarding_available: true,
    reconnect_available: false,
  });
  await page.route("**/api/v1/setup/github/start", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        available: true,
        phase: "authorizing",
        authorization: {
          mode: "device",
          verification_uri: "https://github.com/login/device",
          user_code: "ABCD-EFGH",
          retry_after_seconds: 1,
        },
        grant_access_url: null,
        manage_access: [],
        installations: [],
        repositories: [],
        error: null,
      }),
    });
  });
  await page.route(
    "**/api/v1/setup/github/refresh-access",
    async (route) => {
      refreshCalls += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          refreshCalls < 2
            ? {
                available: true,
                phase: "authorizing",
                authorization: {
                  mode: "device",
                  verification_uri: "https://github.com/login/device",
                  user_code: "ABCD-EFGH",
                  retry_after_seconds: 1,
                },
                grant_access_url: null,
                manage_access: [],
                installations: [],
                repositories: [],
                error: null,
              }
            : {
                available: true,
                phase: "repository-access",
                authorization: null,
                grant_access_url:
                  "https://github.com/apps/jig-desktop-mobile-test/installations/new",
                manage_access: [],
                installations: [],
                repositories: [],
                error: null,
              },
        ),
      });
    },
  );

  await page.goto("/");
  await page.getByRole("button", { name: "Connect GitHub" }).click();

  await expect.poll(() => refreshCalls, { timeout: 5_000 }).toBe(2);
  await expect(
    page.getByRole("button", { name: "Grant repository access" }),
  ).toBeVisible();
});

test("configured managed repository reconnects GitHub through Device Flow without repository setup", async ({
  page,
}) => {
  let repositoryStatus = "sync-issue";
  let syncCalls = 0;

  await page.route("**/api/v1/setup/status", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ mode: "configured" }),
    });
  });
  await routeGitHubStatus(page, {
    onboarding_available: false,
    reconnect_available: true,
  });
  await page.route("**/api/v1/tasks", async (route) => {
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
        repository_path:
          "/home/example/.local/share/jig-data/repositories/github/pontivus-com/planning",
        repository_status: repositoryStatus,
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
        repository_path:
          "/home/example/.local/share/jig-data/repositories/github/pontivus-com/planning",
        portable_format_version: 1,
        repository_adapter_healthy:
          repositoryStatus !== "sync-issue",
      }),
    });
  });
  await page.route("**/api/v1/github/reconnect/start", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        available: true,
        phase: "authorizing",
        authorization: {
          mode: "device",
          verification_uri: "https://github.com/login/device",
          user_code: "WXYZ-1234",
          retry_after_seconds: 5,
        },
        error: null,
      }),
    });
  });
  await page.route(
    "**/api/v1/github/reconnect/refresh",
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          available: true,
          phase: "idle",
          authorization: null,
          error: null,
        }),
      });
    },
  );
  await page.route("**/api/v1/sync", async (route) => {
    syncCalls += 1;
    repositoryStatus = "synchronized";
    await route.fulfill({
      status: 202,
      contentType: "application/json",
      body: JSON.stringify({
        repository_status: "synchronized",
      }),
    });
  });

  await page.goto("/");
  await page
    .getByRole("button", { name: "Settings", exact: true })
    .click();

  await expect(
    page.getByRole("button", { name: "Reconnect GitHub" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reconnect GitHub" }).click();

  await expect(page.getByText("WXYZ-1234", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Open GitHub device authorization" }),
  ).toBeVisible();

  await page
    .getByRole("button", { name: "Refresh GitHub authorization" })
    .click();

  await expect.poll(() => syncCalls).toBe(1);
  await expect(
    page.getByText(
      "Local planning data and the configured repository are synchronized.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Reconnect GitHub" }),
  ).toHaveCount(0);
});
