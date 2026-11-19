import { describe, expect, it } from "vitest";
import type { GitHubCredential } from "../../src/github";
import { GitHubDeviceFlowSession } from "../../src/github-device-flow";
import { createGitHubHttpHandler } from "../../src/shell/github-http";
import { GitHubOnboardingController } from "../../src/github-onboarding";
import { GitHubReconnectController } from "../../src/github-reconnect";

const TOKEN = "a".repeat(64);
const REGISTRATION = {
  app_slug: "jig-desktop-mobile-test",
  client_id: "shared-client-id",
} as const;
const CREDENTIAL: GitHubCredential = {
  user_id: 42,
  access_token: "access-token",
  refresh_token: "refresh-token",
  access_token_expires_at: "2030-01-01T08:00:00.000Z",
  refresh_token_expires_at: "2030-07-01T00:00:00.000Z",
};

function postRequest(
  path: string,
  body: unknown = {},
  token: string | null = TOKEN,
): Request {
  const headers = new Headers({
    "content-type": "application/json",
    origin: "http://127.0.0.1:47831",
  });
  if (token !== null) {
    headers.set("x-jig-write-token", token);
  }
  return new Request(`http://127.0.0.1:47831${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

function getRequest(path: string): Request {
  return new Request(`http://127.0.0.1:47831${path}`);
}

function deviceFlow(
  now: () => Date,
  store: (credential: GitHubCredential) => Promise<void>,
): GitHubDeviceFlowSession {
  return new GitHubDeviceFlowSession({
    registration: REGISTRATION,
    assert_credential_store: async () => undefined,
    load_credential: async () => null,
    store_credential: store,
    start_device_authorization: async () => ({
      device_code: "device-code",
      user_code: "ABCD-EFGH",
      verification_uri: "https://github.com/login/device",
      expires_in: 900,
      interval: 5,
    }),
    poll_device_authorization: async () => ({
      status: "authorized" as const,
      credential: CREDENTIAL,
    }),
    now,
  });
}

async function waitFor(
  predicate: () => boolean,
): Promise<void> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (predicate()) {
      return;
    }
    await Promise.resolve();
  }
  throw new Error("Timed out waiting for GitHub integration");
}

describe("GitHub HTTP boundary", () => {
  it("hides reconnect when managed GitHub authorization does not need user action", async () => {
    const reconnect = new GitHubReconnectController(
      deviceFlow(
        () => new Date("2030-01-01T00:00:00.000Z"),
        async () => undefined,
      ),
    );
    const handler = createGitHubHttpHandler({
      write_token: TOKEN,
      reconnect,
      reconnect_required: async () => false,
      is_configured: () => true,
    });

    const status = await handler(getRequest("/api/v1/github/status"));
    expect(await status?.json()).toStrictEqual({
      onboarding_available: false,
      reconnect_available: false,
    });

    const reconnectRequest = await handler(
      postRequest("/api/v1/github/reconnect"),
    );
    expect(reconnectRequest?.status).toBe(409);
  });

  it("owns one configured reconnect intent and read-only state", async () => {
    let nowMs = Date.parse("2030-01-01T00:00:00.000Z");
    let stored: GitHubCredential | null = null;
    let syncRetries = 0;
    const reconnect = new GitHubReconnectController(
      deviceFlow(
        () => new Date(nowMs),
        async (credential) => {
          stored = credential;
        },
      ),
      {
        sleep: async (delay) => {
          nowMs += delay;
        },
        on_connected: async () => {
          syncRetries += 1;
        },
      },
    );
    const handler = createGitHubHttpHandler({
      write_token: TOKEN,
      reconnect,
      is_configured: () => true,
    });

    const status = await handler(getRequest("/api/v1/github/status"));
    expect(await status?.json()).toStrictEqual({
      onboarding_available: false,
      reconnect_available: true,
    });

    const unauthorized = await handler(
      postRequest("/api/v1/github/reconnect", {}, null),
    );
    expect(unauthorized?.status).toBe(403);

    const started = await handler(
      postRequest("/api/v1/github/reconnect"),
    );
    expect(await started?.json()).toMatchObject({
      state: "connecting",
      authorization: { user_code: "ABCD-EFGH" },
    });

    await waitFor(() => reconnect.snapshot().state === "initial");

    const observed = await handler(
      getRequest("/api/v1/github/reconnect/state"),
    );
    expect(await observed?.json()).toStrictEqual({
      available: true,
      state: "initial",
      authorization: null,
      error: null,
    });
    expect(stored).toStrictEqual(CREDENTIAL);
    expect(syncRetries).toBe(1);
  });

  it("exposes Connect and repository selection without protocol progression endpoints", async () => {
    let nowMs = Date.parse("2030-01-01T00:00:00.000Z");
    let configuredPath: string | null = null;
    let acquiredRepositoryId: number | null = null;
    const onboarding = new GitHubOnboardingController({
      registration: REGISTRATION,
      device_flow: deviceFlow(
        () => new Date(nowMs),
        async () => undefined,
      ),
      sleep: async (delay) => {
        nowMs += delay;
      },
      list_installations: async () => [
        {
          id: 7,
          account: {
            id: 11,
            login: "pontivus-com",
            type: "Organization",
          },
        },
      ],
      list_repositories: async () => [
        {
          id: 99,
          owner: "pontivus-com",
          name: "planning",
          clone_url: "https://github.com/pontivus-com/planning.git",
        },
        {
          id: 100,
          owner: "pontivus-com",
          name: "personal-planning",
          clone_url:
            "https://github.com/pontivus-com/personal-planning.git",
        },
      ],
      acquire_repository: async (repository) => {
        acquiredRepositoryId = repository.id;
        return {
          version: 1 as const,
          repository_path:
            `/tmp/jig-managed/pontivus-com/${repository.name}`,
          http_port: 47831,
        };
      },
      on_acquired: async (config) => {
        configuredPath = config.repository_path;
      },
    });
    const handler = createGitHubHttpHandler({
      write_token: TOKEN,
      onboarding,
      is_configured: () => configuredPath !== null,
    });

    const started = await handler(
      postRequest("/api/v1/setup/github/connect"),
    );
    expect(await started?.json()).toMatchObject({
      state: "connecting",
      authorization: { user_code: "ABCD-EFGH" },
    });

    await waitFor(
      () => onboarding.snapshot().state === "repository-selection",
    );

    const observed = await handler(
      getRequest("/api/v1/setup/github/state"),
    );
    expect(await observed?.json()).toMatchObject({
      state: "repository-selection",
      repositories: [{ id: 100 }, { id: 99 }],
    });

    const selected = await handler(
      postRequest("/api/v1/setup/github/select-repository", {
        repository_id: 99,
      }),
    );
    expect(await selected?.json()).toMatchObject({
      state: "connecting",
    });

    await waitFor(() => configuredPath !== null);
    expect(acquiredRepositoryId).toBe(99);
    expect(configuredPath).toBe(
      "/tmp/jig-managed/pontivus-com/planning",
    );

    for (const obsoletePath of [
      "/api/v1/setup/github/refresh-access",
      "/api/v1/setup/github/acquire",
      "/api/v1/github/reconnect/refresh",
    ]) {
      expect(await handler(postRequest(obsoletePath))).toBeNull();
    }
  });
});
