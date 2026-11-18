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

  it("wraps protocol and credential effects around the pure session", async () => {
    let nowMs = Date.parse("2030-01-01T00:00:00.000Z");
    let stored: GitHubCredential | null = null;
    let polls = 0;
    const session = new GitHubDeviceFlowSession({
      registration: REGISTRATION,
      assert_credential_store: async () => undefined,
      store_credential: async (credential) => {
        stored = credential;
      },
      start_device_authorization: async () => AUTHORIZATION,
      poll_device_authorization: async () => {
        polls += 1;
        return { status: "authorized" as const, credential: CREDENTIAL };
      },
      now: () => new Date(nowMs),
    });

    const started = await session.start();
    expect(started).toMatchObject({
      phase: "authorizing",
      authorization: {
        user_code: "ABCD-EFGH",
        retry_after_seconds: 5,
      },
    });

    await session.poll();
    expect(polls).toBe(0);

    nowMs += 5_000;
    const completed = await session.poll();
    expect(polls).toBe(1);
    expect(stored).toStrictEqual(CREDENTIAL);
    expect(session.credential()).toStrictEqual(CREDENTIAL);
    expect(completed).toStrictEqual({
      available: true,
      phase: "idle",
      authorization: null,
      error: null,
    });
  });
});
