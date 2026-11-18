import { describe, expect, it } from "vitest";
import type {
  GitHubAppRegistration,
  GitHubCredential,
} from "../../src/github";
import { GitHubDeviceFlowSession } from "../../src/shell/github-device-flow";
import { GitHubOnboardingController } from "../../src/shell/github-onboarding";

const REGISTRATION: GitHubAppRegistration = {
  app_slug: "jig-desktop-mobile-test",
  client_id: "shared-client-id",
};

const DEVICE_AUTHORIZATION = {
  device_code: "device-code",
  user_code: "ABCD-EFGH",
  verification_uri: "https://github.com/login/device",
  expires_in: 900,
  interval: 5,
} as const;

const CREDENTIAL: GitHubCredential = {
  user_id: 42,
  access_token: "access-token",
  refresh_token: "refresh-token",
  access_token_expires_at: "2030-01-01T08:00:00.000Z",
  refresh_token_expires_at: "2030-07-01T00:00:00.000Z",
};

function deviceFlow(options: {
  readonly registration?: GitHubAppRegistration | null;
  readonly now: () => Date;
  readonly store?: (credential: GitHubCredential) => Promise<void>;
  readonly poll?: () => Promise<
    | { readonly status: "authorized"; readonly credential: GitHubCredential }
    | { readonly status: "pending"; readonly retry_after_seconds: number }
  >;
}): GitHubDeviceFlowSession {
  return new GitHubDeviceFlowSession({
    registration:
      options.registration === undefined
        ? REGISTRATION
        : options.registration,
    assert_credential_store: async () => undefined,
    store_credential:
      options.store ?? (async () => undefined),
    start_device_authorization: async () => DEVICE_AUTHORIZATION,
    poll_device_authorization:
      options.poll ??
      (async () => ({
        status: "authorized" as const,
        credential: CREDENTIAL,
      })),
    now: options.now,
  });
}

describe("GitHub onboarding orchestration", () => {
  it("stays honestly unavailable without governed registration", async () => {
    const controller = new GitHubOnboardingController({
      registration: null,
      device_flow: deviceFlow({
        registration: null,
        now: () => new Date("2030-01-01T00:00:00.000Z"),
      }),
      config_path: "/tmp/jig-config.json",
      http_port: 47831,
    });

    expect(controller.snapshot()).toMatchObject({
      available: false,
      phase: "idle",
      repositories: [],
    });
    await expect(controller.start()).rejects.toThrow(
      /GitHub App registration/,
    );
  });

  it("continues from shared Device Flow into repository selection and canonical adoption", async () => {
    let stored: GitHubCredential | null = null;
    let acquiredRepositoryId: number | null = null;
    let installationListCount = 0;
    let nowMs = Date.parse("2030-01-01T00:00:00.000Z");

    const controller = new GitHubOnboardingController({
      registration: REGISTRATION,
      device_flow: deviceFlow({
        now: () => new Date(nowMs),
        store: async (credential) => {
          stored = credential;
        },
      }),
      config_path: "/tmp/jig-config.json",
      http_port: 47831,
      list_installations: async () => {
        installationListCount += 1;
        return [
          {
            id: 7,
            account: {
              id: 11,
              login: "pontivus-com",
              type: "Organization",
            },
          },
        ];
      },
      list_repositories: async (_token, installationId) => {
        expect(installationId).toBe(7);
        return [
          {
            id: 99,
            owner: "pontivus-com",
            name: "planning",
            clone_url: "https://github.com/pontivus-com/planning.git",
          },
        ];
      },
      acquire_repository: async (selection) => {
        acquiredRepositoryId = selection.id;
        return "/tmp/jig-managed/pontivus-com/planning";
      },
      initialize_repository: async (options) => ({
        config: {
          version: 1,
          repository_path: options.repository_path,
          http_port: options.http_port,
        },
        dataset_id: "018f47f0-7b5c-7d4d-8e2b-9c3aa11f0001",
        sqlite_path: options.repository_path + "/.jig/local/jig.sqlite",
        adopted_existing_snapshot: false,
      }),
    });

    expect(await controller.start()).toMatchObject({
      phase: "authorizing",
      authorization: {
        user_code: "ABCD-EFGH",
        retry_after_seconds: 5,
      },
    });

    nowMs += DEVICE_AUTHORIZATION.interval * 1000;
    expect(await controller.refreshAccess()).toMatchObject({
      phase: "repository-selection",
      repositories: [
        {
          id: 99,
          installation_id: 7,
          account_login: "pontivus-com",
          owner: "pontivus-com",
          name: "planning",
        },
      ],
    });

    expect(stored).toStrictEqual(CREDENTIAL);
    expect(installationListCount).toBe(1);

    const config = await controller.acquire(99);
    expect(acquiredRepositoryId).toBe(99);
    expect(config.repository_path).toBe(
      "/tmp/jig-managed/pontivus-com/planning",
    );
  });

  it("exposes grant and manage access after authorization without changing Device Flow ownership", async () => {
    let nowMs = Date.parse("2030-01-01T00:00:00.000Z");

    const grantController = new GitHubOnboardingController({
      registration: REGISTRATION,
      device_flow: deviceFlow({ now: () => new Date(nowMs) }),
      config_path: "/tmp/jig-config.json",
      http_port: 47831,
      list_installations: async () => [],
      list_repositories: async () => [],
    });

    await grantController.start();
    nowMs += DEVICE_AUTHORIZATION.interval * 1000;
    expect(await grantController.refreshAccess()).toMatchObject({
      phase: "repository-access",
      grant_access_url:
        "https://github.com/apps/jig-desktop-mobile-test/installations/new",
      repositories: [],
    });

    nowMs += 60_000;
    const manageController = new GitHubOnboardingController({
      registration: REGISTRATION,
      device_flow: deviceFlow({ now: () => new Date(nowMs) }),
      config_path: "/tmp/jig-config.json",
      http_port: 47831,
      list_installations: async () => [
        {
          id: 23,
          account: {
            id: 31,
            login: "example-org",
            type: "Organization",
          },
        },
      ],
      list_repositories: async () => [],
    });

    await manageController.start();
    nowMs += DEVICE_AUTHORIZATION.interval * 1000;
    expect(await manageController.refreshAccess()).toMatchObject({
      phase: "repository-access",
      grant_access_url: null,
      repositories: [],
      manage_access: [
        {
          installation_id: 23,
          account_login: "example-org",
          manage_url: "https://github.com/settings/installations/23",
        },
      ],
    });
  });
});
