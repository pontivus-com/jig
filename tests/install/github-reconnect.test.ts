import { describe, expect, it } from "vitest";
import type {
  GitHubAppRegistration,
  GitHubCredential,
} from "../../src/github";
import { GitHubDeviceFlowSession } from "../../src/shell/github-device-flow";
import { GitHubReconnectController } from "../../src/shell/github-reconnect";

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

describe("GitHub reconnect orchestration", () => {
  it("replaces only the credential through the shared Device Flow owner", async () => {
    let nowMs = Date.parse("2030-01-01T00:00:00.000Z");
    let stored: GitHubCredential | null = null;
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
    );

    expect(await reconnect.start()).toMatchObject({
      phase: "authorizing",
      authorization: { user_code: "ABCD-EFGH" },
    });

    nowMs += 5_000;
    expect(await reconnect.refresh()).toStrictEqual({
      available: true,
      phase: "idle",
      authorization: null,
      error: null,
    });
    expect(stored).toStrictEqual(CREDENTIAL);
  });
});
