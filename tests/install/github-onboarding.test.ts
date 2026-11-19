import { describe, expect, it } from "vitest";
import type {
  GitHubAppRegistration,
  GitHubCredential,
  GitHubOnboardingSnapshot,
} from "../../src/github";
import { GitHubDeviceFlowSession } from "../../src/github-device-flow";
import { GitHubAuthError } from "../../src/github-auth";
import { GitHubOnboardingController } from "../../src/github-onboarding";

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
  readonly load?: () => Promise<GitHubCredential | null>;
  readonly store?: (credential: GitHubCredential) => Promise<void>;
}): GitHubDeviceFlowSession {
  return new GitHubDeviceFlowSession({
    registration:
      options.registration === undefined
        ? REGISTRATION
        : options.registration,
    assert_credential_store: async () => undefined,
    load_credential: options.load ?? (async () => null),
    store_credential:
      options.store ?? (async () => undefined),
    start_device_authorization: async () => DEVICE_AUTHORIZATION,
    poll_device_authorization: async () => ({
      status: "authorized" as const,
      credential: CREDENTIAL,
    }),
    now: options.now,
  });
}

async function waitForSnapshot<T>(
  controller: GitHubOnboardingController<T>,
  predicate: (snapshot: GitHubOnboardingSnapshot) => boolean,
): Promise<GitHubOnboardingSnapshot> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const snapshot = controller.snapshot();
    if (predicate(snapshot)) {
      return snapshot;
    }
    await Promise.resolve();
  }
  throw new Error("Timed out waiting for GitHub onboarding state");
}

describe("GitHub onboarding orchestration", () => {
  it("stays honestly unavailable without governed registration", async () => {
    const controller = new GitHubOnboardingController({
      registration: null,
      device_flow: deviceFlow({
        registration: null,
        now: () => new Date("2030-01-01T00:00:00.000Z"),
      }),
      acquire_repository: async () => {
        throw new Error("Acquisition is unavailable");
      },
    });

    expect(controller.snapshot()).toMatchObject({
      available: false,
      state: "initial",
      repositories: [],
    });
    await expect(controller.start()).rejects.toThrow(
      /GitHub App registration/,
    );
  });

  it("automatically acquires an unambiguous repository after authorization", async () => {
    let nowMs = Date.parse("2030-01-01T00:00:00.000Z");
    let stored: GitHubCredential | null = null;
    let acquiredRepositoryId: number | null = null;
    let completed = false;

    const controller = new GitHubOnboardingController({
      registration: REGISTRATION,
      device_flow: deviceFlow({
        now: () => new Date(nowMs),
        store: async (credential) => {
          stored = credential;
        },
      }),
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
      on_acquired: async () => {
        completed = true;
      },
    });

    expect(await controller.start()).toMatchObject({
      state: "connecting",
      authorization: { user_code: "ABCD-EFGH" },
    });

    await waitForSnapshot(controller, () => completed);

    expect(stored).toStrictEqual(CREDENTIAL);
    expect(acquiredRepositoryId).toBe(99);
    expect(
      controller.snapshot().repositories,
    ).toStrictEqual([]);
  });

  it("keeps Device Flow alive across transient background transport failures", async () => {
    let nowMs = Date.parse("2030-01-01T00:00:00.000Z");
    let deviceAuthorizationCalls = 0;
    let pollCalls = 0;
    let sleepCalls = 0;
    let acquired = false;

    const controller = new GitHubOnboardingController({
      registration: REGISTRATION,
      device_flow: new GitHubDeviceFlowSession({
        registration: REGISTRATION,
        assert_credential_store: async () => undefined,
        load_credential: async () => null,
        store_credential: async () => undefined,
        start_device_authorization: async () => {
          deviceAuthorizationCalls += 1;
          return DEVICE_AUTHORIZATION;
        },
        poll_device_authorization: async () => {
          pollCalls += 1;
          if (pollCalls === 1) {
            throw new Error("UnknownHostException");
          }
          return {
            status: "authorized" as const,
            credential: CREDENTIAL,
          };
        },
        now: () => new Date(nowMs),
      }),
      sleep: async (delay) => {
        sleepCalls += 1;
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
      ],
      acquire_repository: async () => {
        acquired = true;
        return "configured";
      },
    });

    await controller.start();
    await waitForSnapshot(controller, () => acquired);

    expect(deviceAuthorizationCalls).toBe(1);
    expect(pollCalls).toBe(2);
    expect(sleepCalls).toBeGreaterThanOrEqual(2);
    expect(controller.snapshot().state).toBe("connecting");
  });

  it("reuses stored authorization instead of presenting Device Flow again", async () => {
    let deviceAuthorizationCalls = 0;
    let acquired = false;
    const controller = new GitHubOnboardingController({
      registration: REGISTRATION,
      device_flow: new GitHubDeviceFlowSession({
        registration: REGISTRATION,
        assert_credential_store: async () => undefined,
        load_credential: async () => CREDENTIAL,
        store_credential: async () => undefined,
        start_device_authorization: async () => {
          deviceAuthorizationCalls += 1;
          return DEVICE_AUTHORIZATION;
        },
        poll_device_authorization: async () => ({
          status: "authorized" as const,
          credential: CREDENTIAL,
        }),
        now: () => new Date("2030-01-01T00:00:00.000Z"),
      }),
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
      acquire_repository: async () => {
        acquired = true;
        return "configured";
      },
    });

    await controller.start();
    await waitForSnapshot(controller, () => acquired);

    expect(controller.snapshot().authorization).toBeNull();
    expect(deviceAuthorizationCalls).toBe(0);
    expect(acquired).toBe(true);
  });

  it("does not restart an active connection when the intent is repeated", async () => {
    let deviceAuthorizationCalls = 0;
    const controller = new GitHubOnboardingController({
      registration: REGISTRATION,
      device_flow: new GitHubDeviceFlowSession({
        registration: REGISTRATION,
        assert_credential_store: async () => undefined,
        load_credential: async () => null,
        store_credential: async () => undefined,
        start_device_authorization: async () => {
          deviceAuthorizationCalls += 1;
          return DEVICE_AUTHORIZATION;
        },
        poll_device_authorization: async () => ({
          status: "authorized" as const,
          credential: CREDENTIAL,
        }),
        now: () => new Date("2030-01-01T00:00:00.000Z"),
      }),
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
      acquire_repository: async () => "configured",
    });

    const first = await controller.start();
    const second = await controller.start();

    expect(first.authorization).toStrictEqual(second.authorization);
    expect(deviceAuthorizationCalls).toBe(1);
  });

  it("closes the concurrent connect race while credential storage is loading", async () => {
    const credentialLoadControl: { release: () => void } = {
      release: () => undefined,
    };
    let deviceAuthorizationCalls = 0;
    const credentialLoad = new Promise<GitHubCredential | null>((resolve) => {
      credentialLoadControl.release = () => resolve(null);
    });
    const controller = new GitHubOnboardingController({
      registration: REGISTRATION,
      device_flow: new GitHubDeviceFlowSession({
        registration: REGISTRATION,
        assert_credential_store: async () => undefined,
        load_credential: async () => credentialLoad,
        store_credential: async () => undefined,
        start_device_authorization: async () => {
          deviceAuthorizationCalls += 1;
          return DEVICE_AUTHORIZATION;
        },
        poll_device_authorization: async () => ({
          status: "authorized" as const,
          credential: CREDENTIAL,
        }),
        now: () => new Date("2030-01-01T00:00:00.000Z"),
      }),
      acquire_repository: async () => "configured",
    });

    const first = controller.start();
    const second = controller.start();
    expect(controller.snapshot().state).toBe("connecting");
    credentialLoadControl.release();

    const [firstSnapshot, secondSnapshot] = await Promise.all([first, second]);
    expect(firstSnapshot.authorization?.user_code).toBe("ABCD-EFGH");
    expect(secondSnapshot.authorization).toBeNull();
    expect(deviceAuthorizationCalls).toBe(1);
  });

  it("stops only for a genuine multiple-repository choice", async () => {
    let nowMs = Date.parse("2030-01-01T00:00:00.000Z");
    let acquiredRepositoryId: number | null = null;

    const controller = new GitHubOnboardingController({
      registration: REGISTRATION,
      device_flow: deviceFlow({
        now: () => new Date(nowMs),
      }),
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
      acquire_repository: async (selection) => {
        acquiredRepositoryId = selection.id;
        return selection.id;
      },
    });

    await controller.start();
    const selection = await waitForSnapshot(
      controller,
      (snapshot) => snapshot.state === "repository-selection",
    );

    expect(selection.repositories.map((repository) => repository.id))
      .toStrictEqual([100, 99]);

    await controller.selectRepository(99);
    await expect(controller.selectRepository(99)).resolves.toMatchObject({
      state: "connecting",
    });
    await waitForSnapshot(
      controller,
      () => acquiredRepositoryId === 99,
    );
    expect(acquiredRepositoryId).toBe(99);
  });

  it("routes a restricted installation to its GitHub-owned access surface", async () => {
    let nowMs = Date.parse("2030-01-01T00:00:00.000Z");
    let sleepCalls = 0;
    const controller = new GitHubOnboardingController({
      registration: REGISTRATION,
      device_flow: deviceFlow({
        now: () => new Date(nowMs),
      }),
      sleep: async (delay) => {
        sleepCalls += 1;
        nowMs += delay;
        if (sleepCalls > 1) {
          await new Promise<void>(() => undefined);
        }
      },
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
      list_repositories: async () => {
        throw new GitHubAuthError(
          "GitHub repository listing failed: Forbidden",
          403,
        );
      },
      acquire_repository: async () => {
        throw new Error("Acquisition must not start");
      },
    });

    await controller.start();
    const restricted = await waitForSnapshot(
      controller,
      (snapshot) => snapshot.provider_url !== null,
    );

    expect(restricted).toMatchObject({
      state: "connecting",
      provider_url: "https://github.com/settings/installations/23",
      repositories: [],
      error: null,
    });
  });

  it("rechecks provider access immediately when the app resumes", async () => {
    let nowMs = Date.parse("2030-01-01T00:00:00.000Z");
    let installationReads = 0;
    let acquired = false;
    let sleepCalls = 0;

    const controller = new GitHubOnboardingController({
      registration: REGISTRATION,
      device_flow: deviceFlow({
        now: () => new Date(nowMs),
      }),
      sleep: async (delay) => {
        sleepCalls += 1;
        if (sleepCalls === 1) {
          nowMs += delay;
          return;
        }
        await new Promise<void>(() => undefined);
      },
      list_installations: async () => {
        installationReads += 1;
        return installationReads === 1
          ? []
          : [
              {
                id: 23,
                account: {
                  id: 31,
                  login: "example-org",
                  type: "Organization",
                },
              },
            ];
      },
      list_repositories: async () => [
        {
          id: 101,
          owner: "example-org",
          name: "planning",
          clone_url: "https://github.com/example-org/planning.git",
        },
      ],
      acquire_repository: async () => {
        acquired = true;
        return "configured";
      },
    });

    await controller.start();
    const waitingForAccess = await waitForSnapshot(
      controller,
      (snapshot) => snapshot.provider_url !== null,
    );
    expect(waitingForAccess).toMatchObject({
      state: "connecting",
      provider_url:
        "https://github.com/apps/jig-desktop-mobile-test/installations/new",
    });
    expect(installationReads).toBe(1);

    controller.resume();
    await waitForSnapshot(controller, () => acquired);

    expect(installationReads).toBe(2);
    expect(acquired).toBe(true);
  });
});
