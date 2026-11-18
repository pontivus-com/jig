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

function deviceFlow(
  now: () => Date,
  store: (credential: GitHubCredential) => Promise<void>,
): GitHubDeviceFlowSession {
  return new GitHubDeviceFlowSession({
    registration: REGISTRATION,
    assert_credential_store: async () => undefined,
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

describe("GitHub HTTP boundary", () => {
  it("owns configured reconnect admission and Device Flow routes", async () => {
    let nowMs = Date.parse("2030-01-01T00:00:00.000Z");
    let stored: GitHubCredential | null = null;
    const reconnect = new GitHubReconnectController(
      deviceFlow(
        () => new Date(nowMs),
        async (credential) => {
          stored = credential;
        },
      ),
    );
    const handler = createGitHubHttpHandler({
      write_token: TOKEN,
      reconnect,
      is_configured: () => true,
    });

    const status = await handler(
      new Request("http://127.0.0.1:47831/api/v1/github/status"),
    );
    expect(status).not.toBeNull();
    expect(await status?.json()).toStrictEqual({
      onboarding_available: false,
      reconnect_available: true,
    });

    const unauthorized = await handler(
      postRequest("/api/v1/github/reconnect/start", {}, null),
    );
    expect(unauthorized?.status).toBe(403);

    const started = await handler(
      postRequest("/api/v1/github/reconnect/start"),
    );
    expect(await started?.json()).toMatchObject({
      phase: "authorizing",
      authorization: { user_code: "ABCD-EFGH" },
    });

    nowMs += 5_000;
    const refreshed = await handler(
      postRequest("/api/v1/github/reconnect/refresh"),
    );
    expect(await refreshed?.json()).toStrictEqual({
      available: true,
      phase: "idle",
      authorization: null,
      error: null,
    });
    expect(stored).toStrictEqual(CREDENTIAL);
  });

  it("owns GitHub setup routes and delegates configuration completion", async () => {
    let nowMs = Date.parse("2030-01-01T00:00:00.000Z");
    let configuredPath: string | null = null;
    const onboarding = new GitHubOnboardingController({
      registration: REGISTRATION,
      device_flow: deviceFlow(
        () => new Date(nowMs),
        async () => undefined,
      ),
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
      ],
      acquire_repository: async () => ({
        version: 1 as const,
        repository_path: "/tmp/jig-managed/pontivus-com/planning",
        http_port: 47831,
      }),
    });
    const handler = createGitHubHttpHandler({
      write_token: TOKEN,
      onboarding,
      is_configured: () => configuredPath !== null,
      on_configured: (config) => {
        configuredPath = config.repository_path;
      },
    });

    const started = await handler(
      postRequest("/api/v1/setup/github/start"),
    );
    expect(await started?.json()).toMatchObject({
      phase: "authorizing",
    });

    nowMs += 5_000;
    const access = await handler(
      postRequest("/api/v1/setup/github/refresh-access"),
    );
    expect(await access?.json()).toMatchObject({
      phase: "repository-selection",
      repositories: [{ id: 99 }],
    });

    const acquired = await handler(
      postRequest("/api/v1/setup/github/acquire", {
        repository_id: 99,
      }),
    );
    expect(await acquired?.json()).toStrictEqual({
      configured: true,
      repository_path: "/tmp/jig-managed/pontivus-com/planning",
    });
    expect(configuredPath).toBe(
      "/tmp/jig-managed/pontivus-com/planning",
    );
  });
});
