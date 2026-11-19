import { describe, expect, it } from "vitest";
import type {
  GitHubAppRegistration,
  GitHubCredential,
} from "../../src/github";
import { GitHubDeviceFlowSession } from "../../src/github-device-flow";
import { GitHubReconnectController } from "../../src/github-reconnect";

const REGISTRATION: GitHubAppRegistration = {
  app_slug: "jig-desktop-mobile-test",
  client_id: "shared-client-id",
};

const CREDENTIAL: GitHubCredential = {
  user_id: 42,
  access_token: "access-token",
  refresh_token: "refresh-token",
  access_token_expires_at: "2030-01-01T08:00:00.000Z",
  refresh_token_expires_at: "2030-07-01T00:00:00.000Z",
};

async function waitFor(
  predicate: () => boolean,
): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (predicate()) {
      return;
    }
    await Promise.resolve();
  }
  throw new Error("Timed out waiting for GitHub reconnect state");
}

describe("GitHub reconnect orchestration", () => {
  it("replaces only the credential and continues synchronization automatically", async () => {
    let nowMs = Date.parse("2030-01-01T00:00:00.000Z");
    let stored: GitHubCredential | null = null;
    let syncRetries = 0;
    const reconnect = new GitHubReconnectController(
      new GitHubDeviceFlowSession({
        registration: REGISTRATION,
        assert_credential_store: async () => undefined,
        store_credential: async (credential) => {
          stored = credential;
        },
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
        now: () => new Date(nowMs),
      }),
      {
        sleep: async (delay) => {
          nowMs += delay;
        },
        on_connected: async () => {
          syncRetries += 1;
        },
      },
    );

    expect(await reconnect.start()).toStrictEqual({
      available: true,
      state: "connecting",
      authorization: {
        mode: "device",
        verification_uri: "https://github.com/login/device",
        user_code: "ABCD-EFGH",
      },
      error: null,
    });

    await waitFor(() => reconnect.snapshot().state === "initial");

    expect(reconnect.snapshot()).toStrictEqual({
      available: true,
      state: "initial",
      authorization: null,
      error: null,
    });
    expect(stored).toStrictEqual(CREDENTIAL);
    expect(syncRetries).toBe(1);
  });
});
