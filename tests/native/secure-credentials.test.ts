import { describe, expect, it } from "vitest";
import type { GitHubCredential } from "../../src/github";
import {
  deleteAndroidGitHubCredential,
  loadAndroidGitHubCredential,
  parseStoredGitHubCredential,
  storeAndroidGitHubCredential,
  type SecureCredentialsPort,
} from "../../ui/src/native/secure-credentials";

const CREDENTIAL: GitHubCredential = {
  user_id: 42,
  access_token: "access-token",
  refresh_token: "refresh-token",
  access_token_expires_at: "2030-01-01T08:00:00.000Z",
  refresh_token_expires_at: "2030-07-01T00:00:00.000Z",
};

describe("Android secure GitHub credentials", () => {
  it("round-trips only the canonical credential through the native port", async () => {
    let stored: GitHubCredential | null = null;
    const port: SecureCredentialsPort = {
      store: async ({ credential }) => {
        stored = credential;
      },
      load: async () => ({ credential: stored }),
      delete: async () => {
        stored = null;
      },
    };

    await storeAndroidGitHubCredential(CREDENTIAL, port);
    await expect(loadAndroidGitHubCredential(port))
      .resolves.toStrictEqual(CREDENTIAL);

    await deleteAndroidGitHubCredential(port);
    await expect(loadAndroidGitHubCredential(port))
      .resolves.toBeNull();
  });

  it("rejects malformed native credential payloads instead of widening the boundary", () => {
    expect(() =>
      parseStoredGitHubCredential({
        user_id: 0,
        access_token: "token",
        refresh_token: null,
        access_token_expires_at: null,
        refresh_token_expires_at: null,
      }),
    ).toThrow(/invalid/);

    expect(() =>
      parseStoredGitHubCredential({
        user_id: 42,
        access_token: "",
        refresh_token: null,
        access_token_expires_at: null,
        refresh_token_expires_at: null,
      }),
    ).toThrow(/invalid/);

    expect(() =>
      parseStoredGitHubCredential({
        user_id: 42,
        access_token: "token",
        refresh_token: 123,
        access_token_expires_at: null,
        refresh_token_expires_at: null,
      }),
    ).toThrow(/refresh_token/);
  });
});
