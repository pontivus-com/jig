import {
  describe,
  expect,
  it,
} from "vitest";
import {
  createGitHubAuthorizationRequest,
  exchangeGitHubAuthorizationCode,
  listGitHubInstallations,
  listGitHubRepositories,
  pollGitHubDeviceAuthorization,
  refreshGitHubCredential,
  startGitHubDeviceAuthorization,
  type GitHubAppRegistration,
  type GitHubFetch,
} from "../../src/shell/github-auth";

const DESKTOP_REGISTRATION: GitHubAppRegistration = {
  app_slug: "jig-desktop",
  client_id: "Iv1.desktop-fixture",
  client_secret: "public-desktop-fixture-secret",
  callback_url: "http://127.0.0.1:47832/setup/github/callback",
};

const ANDROID_REGISTRATION: GitHubAppRegistration = {
  app_slug: "jig-android",
  client_id: "Iv1.android-fixture",
  client_secret: "public-android-fixture-secret",
  callback_url: "com.pontivus.jig://oauth/github",
};

describe("GitHub App public-client primitives", () => {
  it("creates a PKCE S256 authorization request with offline access", async () => {
    const request = await createGitHubAuthorizationRequest(
      DESKTOP_REGISTRATION,
    );
    const url = new URL(request.authorization_url);

    expect(url.origin + url.pathname).toBe(
      "https://github.com/login/oauth/authorize",
    );
    expect(url.searchParams.get("client_id")).toBe(
      DESKTOP_REGISTRATION.client_id,
    );
    expect(url.searchParams.get("redirect_uri")).toBe(
      DESKTOP_REGISTRATION.callback_url,
    );
    expect(url.searchParams.get("scope")).toBe("offline_access");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toMatch(
      /^[A-Za-z0-9_-]{43}$/,
    );
    expect(request.state).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(request.code_verifier).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("uses the callback owned by the selected GitHub App registration", async () => {
    const desktop = await createGitHubAuthorizationRequest(
      DESKTOP_REGISTRATION,
    );
    const android = await createGitHubAuthorizationRequest(
      ANDROID_REGISTRATION,
    );

    expect(new URL(desktop.authorization_url).searchParams.get("redirect_uri"))
      .toBe(DESKTOP_REGISTRATION.callback_url);
    expect(desktop.redirect_uri).toBe(DESKTOP_REGISTRATION.callback_url);

    expect(new URL(android.authorization_url).searchParams.get("redirect_uri"))
      .toBe(ANDROID_REGISTRATION.callback_url);
    expect(android.redirect_uri).toBe(ANDROID_REGISTRATION.callback_url);

    expect(DESKTOP_REGISTRATION.client_id).not.toBe(
      ANDROID_REGISTRATION.client_id,
    );
  });

  it("exchanges an authorization code with PKCE and resolves the GitHub user id", async () => {
    const request = await createGitHubAuthorizationRequest(
      DESKTOP_REGISTRATION,
      DESKTOP_REGISTRATION.callback_url,
    );
    const calls: Array<{ url: string; body: string | null }> = [];
    const fetcher: GitHubFetch = async (input, init) => {
      const url = String(input);
      calls.push({
        url,
        body:
          init?.body instanceof URLSearchParams
            ? init.body.toString()
            : null,
      });
      if (url.endsWith("/login/oauth/access_token")) {
        return Response.json({
          access_token: "ghu_access",
          expires_in: 28800,
          refresh_token: "ghr_refresh",
          refresh_token_expires_in: 15897600,
          token_type: "bearer",
        });
      }
      if (url === "https://api.github.com/user") {
        return Response.json({ id: 456 });
      }
      throw new Error("Unexpected fetch " + url);
    };

    const now = new Date("2030-01-01T00:00:00.000Z");
    const credential = await exchangeGitHubAuthorizationCode(
      DESKTOP_REGISTRATION,
      request,
      "code-123",
      now,
      fetcher,
    );

    expect(credential).toStrictEqual({
      user_id: 456,
      access_token: "ghu_access",
      refresh_token: "ghr_refresh",
      access_token_expires_at: "2030-01-01T08:00:00.000Z",
      refresh_token_expires_at: "2030-07-04T00:00:00.000Z",
    });
    const params = new URLSearchParams(calls[0]?.body ?? "");
    expect(params.get("client_id")).toBe(DESKTOP_REGISTRATION.client_id);
    expect(params.get("client_secret")).toBe(
      DESKTOP_REGISTRATION.client_secret,
    );
    expect(params.get("code")).toBe("code-123");
    expect(params.get("code_verifier")).toBe(request.code_verifier);
  });

  it("refreshes expiring credentials with the public App registration", async () => {
    const fetcher: GitHubFetch = async (input, init) => {
      const url = String(input);
      if (url.endsWith("/login/oauth/access_token")) {
        const params =
          init?.body instanceof URLSearchParams
            ? init.body
            : new URLSearchParams();
        expect(params.get("grant_type")).toBe("refresh_token");
        expect(params.get("refresh_token")).toBe("old-refresh");
        return Response.json({
          access_token: "new-access",
          expires_in: 28800,
          refresh_token: "new-refresh",
          refresh_token_expires_in: 15897600,
        });
      }
      if (url === "https://api.github.com/user") {
        return Response.json({ id: 456 });
      }
      throw new Error("Unexpected fetch " + url);
    };

    const refreshed = await refreshGitHubCredential(
      DESKTOP_REGISTRATION,
      {
        user_id: 456,
        access_token: "old-access",
        refresh_token: "old-refresh",
        access_token_expires_at: null,
        refresh_token_expires_at: null,
      },
      new Date("2030-01-01T00:00:00.000Z"),
      fetcher,
    );
    expect(refreshed.access_token).toBe("new-access");
    expect(refreshed.refresh_token).toBe("new-refresh");
    expect(refreshed.user_id).toBe(456);
  });

  it("lists only repositories exposed through authorized installations", async () => {
    const fetcher: GitHubFetch = async (input) => {
      const url = String(input);
      if (url.includes("/user/installations?")) {
        return Response.json({
          installations: [
            {
              id: 10,
              account: {
                id: 20,
                login: "example",
                type: "Organization",
              },
            },
          ],
        });
      }
      if (url.includes("/user/installations/10/repositories?")) {
        return Response.json({
          repositories: [
            {
              id: 30,
              name: "planning",
              clone_url: "https://github.com/example/planning.git",
              owner: { login: "example" },
            },
          ],
        });
      }
      throw new Error("Unexpected fetch " + url);
    };

    await expect(
      listGitHubInstallations("access", fetcher),
    ).resolves.toStrictEqual([
      {
        id: 10,
        account: {
          id: 20,
          login: "example",
          type: "Organization",
        },
      },
    ]);
    await expect(
      listGitHubRepositories("access", 10, fetcher),
    ).resolves.toStrictEqual([
      {
        id: 30,
        owner: "example",
        name: "planning",
        clone_url: "https://github.com/example/planning.git",
      },
    ]);
  });

  it("supports the governed Linux device-flow fallback states", async () => {
    let stage = 0;
    const fetcher: GitHubFetch = async (input) => {
      const url = String(input);
      if (url.endsWith("/login/device/code")) {
        return Response.json({
          device_code: "device-code",
          user_code: "ABCD-EFGH",
          verification_uri: "https://github.com/login/device",
          expires_in: 900,
          interval: 5,
        });
      }
      if (url.endsWith("/login/oauth/access_token")) {
        stage += 1;
        if (stage === 1) {
          return Response.json(
            { error: "authorization_pending" },
            { status: 400 },
          );
        }
        return Response.json({
          access_token: "device-access",
          expires_in: 28800,
          refresh_token: "device-refresh",
          refresh_token_expires_in: 15897600,
        });
      }
      if (url === "https://api.github.com/user") {
        return Response.json({ id: 99 });
      }
      throw new Error("Unexpected fetch " + url);
    };

    const authorization = await startGitHubDeviceAuthorization(
      DESKTOP_REGISTRATION,
      fetcher,
    );
    await expect(
      pollGitHubDeviceAuthorization(
        DESKTOP_REGISTRATION,
        authorization,
        authorization.interval,
        new Date("2030-01-01T00:00:00.000Z"),
        fetcher,
      ),
    ).resolves.toStrictEqual({
      status: "pending",
      retry_after_seconds: 5,
    });
    const authorized = await pollGitHubDeviceAuthorization(
      DESKTOP_REGISTRATION,
      authorization,
      5,
      new Date("2030-01-01T00:00:00.000Z"),
      fetcher,
    );
    expect(authorized.status).toBe("authorized");
    if (authorized.status === "authorized") {
      expect(authorized.credential.user_id).toBe(99);
    }
  });
});
