import { describe, expect, it } from "vitest";
import {
  GitHubOnboardingController,
} from "../../src/shell/github-onboarding";
import type {
  GitHubAppRegistration,
} from "../../src/shell/github-auth";
import type { GitHubCredential } from "../../src/shell/secret-service";

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
  access_token_expires_at: "2030-01-01T00:00:00.000Z",
  refresh_token_expires_at: "2030-07-01T00:00:00.000Z",
};

describe("GitHub onboarding orchestration", () => {
  it("stays honestly unavailable without governed registration", async () => {
    const controller = new GitHubOnboardingController({
      registration: null,
      config_path: "/tmp/jig-config.json",
      http_port: 47831,
      on_configured: () => undefined,
      assert_secret_service: async () => undefined,
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

  it("authorizes through Device Flow, lists app-visible repositories, acquires and canonically configures", async () => {
    let stored: GitHubCredential | null = null;
    let configuredPath: string | null = null;
    let acquiredRepositoryId: number | null = null;

    const controller = new GitHubOnboardingController({
      registration: REGISTRATION,
      config_path: "/tmp/jig-config.json",
      http_port: 47831,
      on_configured: (config) => {
        configuredPath = config.repository_path;
      },
      assert_secret_service: async () => undefined,
      start_device_authorization: async () => DEVICE_AUTHORIZATION,
      poll_device_authorization: async () => ({
        status: "authorized" as const,
        credential: CREDENTIAL,
      }),
      store_credential: async (credential) => {
        stored = credential;
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

    const started = await controller.start();
    expect(started).toMatchObject({
      available: true,
      phase: "authorizing",
      authorization: {
        mode: "device",
        verification_uri: "https://github.com/login/device",
        user_code: "ABCD-EFGH",
        retry_after_seconds: 5,
      },
    });

    await controller.refreshAccess();

    expect(stored).toStrictEqual(CREDENTIAL);
    expect(controller.snapshot()).toMatchObject({
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

    const config = await controller.acquire(99);
    expect(acquiredRepositoryId).toBe(99);
    expect(config.repository_path).toBe(
      "/tmp/jig-managed/pontivus-com/planning",
    );
    expect(configuredPath).toBe(config.repository_path);
  });

  it("exposes Grant and Manage access states without broadening repository scope", async () => {
    const startDevice = async () => DEVICE_AUTHORIZATION;
    const pollDevice = async () => ({
      status: "authorized" as const,
      credential: CREDENTIAL,
    });

    const grantController = new GitHubOnboardingController({
      registration: REGISTRATION,
      config_path: "/tmp/jig-config.json",
      http_port: 47831,
      on_configured: () => undefined,
      assert_secret_service: async () => undefined,
      start_device_authorization: startDevice,
      poll_device_authorization: pollDevice,
      store_credential: async () => undefined,
      list_installations: async () => [],
      list_repositories: async () => [],
    });

    const started = await grantController.start();
    expect(started.authorization).toMatchObject({
      mode: "device",
      user_code: "ABCD-EFGH",
    });
    const grant = await grantController.refreshAccess();
    expect(grant).toMatchObject({
      phase: "repository-access",
      grant_access_url:
        "https://github.com/apps/jig-desktop-mobile-test/installations/new",
      repositories: [],
    });

    const manageController = new GitHubOnboardingController({
      registration: REGISTRATION,
      config_path: "/tmp/jig-config.json",
      http_port: 47831,
      on_configured: () => undefined,
      assert_secret_service: async () => undefined,
      start_device_authorization: startDevice,
      poll_device_authorization: pollDevice,
      store_credential: async () => undefined,
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
    const manage = await manageController.refreshAccess();
    expect(manage).toMatchObject({
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
