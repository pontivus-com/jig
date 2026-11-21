import { describe, expect, it } from "vitest";
import {
  applyGitHubDevicePollResult,
  githubDevicePollDecision,
  startGitHubDeviceSession,
  type GitHubAppRegistration,
  type GitHubCredential,
} from "../../src/github";
import { GitHubDeviceFlowSession } from "../../src/github-device-flow";

const REGISTRATION: GitHubAppRegistration = {
  app_slug: "jig-desktop-mobile-test",
  client_id: "shared-client-id",
};

const AUTHORIZATION = {
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

describe("GitHub Device Flow session", () => {
  it("keeps timing and state transitions pure", () => {
    const started = startGitHubDeviceSession(AUTHORIZATION, 1_000);

    const waiting = githubDevicePollDecision(started, 5_000);
    expect(waiting).toMatchObject({
      status: "wait",
      state: { retry_after_seconds: 1 },
    });

    const poll = githubDevicePollDecision(started, 6_000);
    expect(poll.status).toBe("poll");
    if (poll.status !== "poll") {
      throw new Error("Expected poll decision");
    }

    const slowed = applyGitHubDevicePollResult(
      poll.state,
      { status: "slow-down", retry_after_seconds: 12 },
      6_000,
    );
    expect(slowed).toMatchObject({
      status: "pending",
      state: {
        retry_after_seconds: 12,
        next_poll_at_ms: 18_000,
      },
    });

    expect(
      githubDevicePollDecision(started, 901_000),
    ).toStrictEqual({ status: "expired" });
  });

  it("owns automatic polling while exposing only provider-required presentation", async () => {
    let nowMs = Date.parse("2030-01-01T00:00:00.000Z");
    let stored: GitHubCredential | null = null;
    let polls = 0;
    const session = new GitHubDeviceFlowSession({
      registration: REGISTRATION,
      assert_credential_store: async () => undefined,
      load_credential: async () => null,
      store_credential: async (credential) => {
        stored = credential;
      },
      start_device_authorization: async () => AUTHORIZATION,
      poll_device_authorization: async () => {
        polls += 1;
        return polls === 1
          ? { status: "pending" as const, retry_after_seconds: 7 }
          : { status: "authorized" as const, credential: CREDENTIAL };
      },
      now: () => new Date(nowMs),
    });

    expect(await session.start()).toStrictEqual({
      available: true,
      phase: "authorizing",
      authorization: {
        mode: "device",
        verification_uri: "https://github.com/login/device",
        user_code: "ABCD-EFGH",
      },
      error: null,
    });

    const completed = await session.runUntilSettled(async (delay) => {
      nowMs += delay;
    });

    expect(polls).toBe(2);
    expect(stored).toStrictEqual(CREDENTIAL);
    expect(session.credential()).toStrictEqual(CREDENTIAL);
    expect(completed).toStrictEqual({
      available: true,
      phase: "idle",
      authorization: null,
      error: null,
    });
  });

  it("restores a stored credential without starting Device Flow", async () => {
    let deviceAuthorizationCalls = 0;
    const session = new GitHubDeviceFlowSession({
      registration: REGISTRATION,
      assert_credential_store: async () => undefined,
      load_credential: async () => CREDENTIAL,
      store_credential: async () => undefined,
      start_device_authorization: async () => {
        deviceAuthorizationCalls += 1;
        return AUTHORIZATION;
      },
      now: () => new Date("2030-01-01T00:00:00.000Z"),
    });

    await expect(session.restoreCredential()).resolves.toBe(true);
    expect(session.credential()).toStrictEqual(CREDENTIAL);
    expect(session.snapshot()).toStrictEqual({
      available: true,
      phase: "idle",
      authorization: null,
      error: null,
    });
    expect(deviceAuthorizationCalls).toBe(0);
  });
});
