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

async function preventExternalWindows(
  page: import("@playwright/test").Page,
): Promise<void> {
  await page.addInitScript(() => {
    window.open = () => null;
  });
}

function configuredServiceStatus(
  remoteState:
    | "pending"
    | "retrying"
    | "synchronized"
    | "sync-issue" = "synchronized",
) {
  return {
    ready: true,
    repository_path:
      "/home/example/.local/share/jig-data/repositories/github/pontivus-com/planning",
    repository_status: {
      local_git: "committed",
      remote: {
        state: remoteState,
        remote_name: "origin",
        remote_location: "https://github.com/pontivus-com/planning.git",
      },
    },
  } as const;
}

function diagnostics(remoteHealthy = true) {
  return {
    service_healthy: true,
    sqlite_available: true,
    sqlite_schema_version: 3,
    repository_path:
      "/home/example/.local/share/jig-data/repositories/github/pontivus-com/planning",
    portable_format_version: 2,
    repository_adapter_healthy: remoteHealthy,
  };
}

test("bootstrap stays inside Jig and accepts an existing local repository", async ({
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
    onboarding_available: true,
    reconnect_available: false,
  });

  await page.route("**/api/v1/setup/local-repository", async (route) => {
    const body = route.request().postDataJSON() as {
      repository_path?: unknown;
    };
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
      body: JSON.stringify({ revision: 0, tasks: [], recurrences: [] }),
    });
  });
  await page.route("**/api/v1/status", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(configuredServiceStatus()),
    });
  });
  await page.route("**/api/v1/diagnostics", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(diagnostics()),
    });
  });

  await page.goto("/");

  await expect(page.locator(".jig-app-shell")).toBeVisible();
  await expect(page.locator(".jig-app-header-onboarding")).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Plan your week. Keep the data yours.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Connect GitHub repository" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Use an existing local repository" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add task", exact: true }),
  ).toHaveCount(0);
  expect(taskRequests).toBe(0);

  await page
    .getByRole("button", { name: "Use an existing local repository" })
    .click();
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

test("governed onboarding adapts from desktop to narrow touch geometry", async ({
  page,
}) => {
  await page.route("**/api/v1/setup/status", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        mode: "bootstrap",
        local_repository_available: false,
      }),
    });
  });
  await routeGitHubStatus(page, {
    onboarding_available: true,
    reconnect_available: false,
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  const desktopColumns = await page.locator(".jig-setup-layout").evaluate(
    (element) => getComputedStyle(element).gridTemplateColumns,
  );
  expect(desktopColumns.split(" ")).toHaveLength(2);
  await expect(
    page.getByRole("button", { name: "Connect GitHub repository" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Use an existing local repository" }),
  ).toHaveCount(0);

  for (const width of [320, 360, 390, 414] as const) {
    await page.setViewportSize({ width, height: 844 });

    const headerBox = await page
      .locator(".jig-app-header-onboarding")
      .boundingBox();
    const connectBox = await page
      .getByRole("button", { name: "Connect GitHub repository" })
      .boundingBox();
    if (headerBox === null || connectBox === null) {
      throw new Error("Onboarding touch geometry unavailable");
    }
    expect(headerBox.height).toBeGreaterThanOrEqual(56);
    expect(connectBox.width).toBeGreaterThanOrEqual(48);
    expect(connectBox.height).toBeGreaterThanOrEqual(48);

    const narrowColumns = await page.locator(".jig-setup-layout").evaluate(
      (element) => getComputedStyle(element).gridTemplateColumns,
    );
    expect(narrowColumns.split(" ")).toHaveLength(1);

    const geometry = await page.locator(".jig-setup").evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
  }
});

test("bootstrap keeps invalid repository errors and the entered path", async ({
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
  await page
    .getByRole("button", { name: "Use an existing local repository" })
    .click();
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
  await expect(page.locator(".jig-app-header-onboarding")).toBeVisible();
});

test("Connect GitHub shows the provider-required code without protocol controls", async ({
  page,
}) => {
  await preventExternalWindows(page);
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

  const connecting = {
    available: true,
    state: "connecting",
    authorization: {
      mode: "device",
      verification_uri: "https://github.com/login/device",
      user_code: "ABCD-EFGH",
    },
    provider_url: null,
    repositories: [],
    error: null,
  };
  await page.route("**/api/v1/setup/github/connect", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(connecting),
    });
  });
  await page.route("**/api/v1/setup/github/state", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(connecting),
    });
  });

  await page.goto("/");
  await page
    .getByRole("button", { name: "Connect GitHub repository" })
    .click();

  await expect(page.getByText("ABCD-EFGH", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy code" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open GitHub" })).toBeVisible();
  await expect(page.getByText(/Refresh access/i)).toHaveCount(0);
  await expect(page.getByText(/Grant repository access/i)).toHaveCount(0);
  await expect(page.getByText(/Manage GitHub access/i)).toHaveCount(0);
  await expect(page.getByText(/client_secret|Redirect URI/i)).toHaveCount(0);
});

test("GitHub access is observed automatically and stops only for a genuine repository choice", async ({
  page,
}) => {
  await preventExternalWindows(page);
  let stateReads = 0;

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

  await page.route("**/api/v1/setup/github/connect", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        available: true,
        state: "connecting",
        authorization: {
          mode: "device",
          verification_uri: "https://github.com/login/device",
          user_code: "ABCD-EFGH",
        },
        provider_url: null,
        repositories: [],
        error: null,
      }),
    });
  });

  await page.route("**/api/v1/setup/github/state", async (route) => {
    stateReads += 1;
    const body =
      stateReads === 1
        ? {
            available: true,
            state: "connecting",
            authorization: null,
            provider_url:
              "https://github.com/apps/jig-desktop-mobile-test/installations/new",
            repositories: [],
            error: null,
          }
        : {
            available: true,
            state: "repository-selection",
            authorization: null,
            provider_url: "https://github.com/settings/installations",
            repositories: [
              {
                id: 10,
                owner: "example",
                name: "planning",
                clone_url: "https://github.com/example/planning.git",
                installation_id: 1,
                account_login: "example",
                account_type: "Organization",
              },
              {
                id: 11,
                owner: "example",
                name: "personal",
                clone_url: "https://github.com/example/personal.git",
                installation_id: 1,
                account_login: "example",
                account_type: "Organization",
              },
            ],
            error: null,
          };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });

  await page.goto("/");
  await page
    .getByRole("button", { name: "Connect GitHub repository" })
    .click();

  await expect.poll(() => stateReads, { timeout: 5_000 }).toBeGreaterThan(1);
  await expect(
    page.getByRole("heading", {
      name: "Choose your planning repository",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "example/planning" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "example/personal" }),
  ).toBeVisible();
  await expect(page.getByText(/Refresh access/i)).toHaveCount(0);
});

test("configured managed repository reconnects automatically without repository setup", async ({
  page,
}) => {
  await preventExternalWindows(page);
  let remoteStatus:
    | "pending"
    | "retrying"
    | "synchronized"
    | "sync-issue" = "sync-issue";
  let reconnectReads = 0;

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
      body: JSON.stringify({ revision: 0, tasks: [], recurrences: [] }),
    });
  });
  await page.route("**/api/v1/status", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(configuredServiceStatus(remoteStatus)),
    });
  });
  await page.route("**/api/v1/diagnostics", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(diagnostics(remoteStatus !== "sync-issue")),
    });
  });
  await page.route("**/api/v1/github/reconnect", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        available: true,
        state: "connecting",
        authorization: {
          mode: "device",
          verification_uri: "https://github.com/login/device",
          user_code: "WXYZ-1234",
        },
        error: null,
      }),
    });
  });
  await page.route("**/api/v1/github/reconnect/state", async (route) => {
    reconnectReads += 1;
    if (reconnectReads > 1) {
      remoteStatus = "synchronized";
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        reconnectReads > 1
          ? {
              available: true,
              state: "initial",
              authorization: null,
              error: null,
            }
          : {
              available: true,
              state: "connecting",
              authorization: {
                mode: "device",
                verification_uri: "https://github.com/login/device",
                user_code: "WXYZ-1234",
              },
              error: null,
            },
      ),
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
  await expect(page.getByRole("button", { name: "Open GitHub" })).toBeVisible();
  await expect(page.getByText(/Refresh GitHub authorization/i)).toHaveCount(0);

  await expect.poll(() => reconnectReads, { timeout: 5_000 })
    .toBeGreaterThan(1);
  await expect(
    page.locator(".jig-settings-section").filter({
      has: page.getByRole("heading", { name: "Data & sync" }),
    }).getByText("Up to date", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Reconnect GitHub" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Choose your planning repository" }),
  ).toHaveCount(0);
});
