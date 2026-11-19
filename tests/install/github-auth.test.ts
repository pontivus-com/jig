import {
  describe,
  expect,
  it,
} from "vitest";
import type { GitHubAppRegistration } from "../../src/github";
import {
  listGitHubInstallations,
  listGitHubRepositories,
  pollGitHubDeviceAuthorization,
  refreshGitHubCredential,
  startGitHubDeviceAuthorization,
  type GitHubFetch,
} from "../../src/github-auth";

const REGISTRATION: GitHubAppRegistration = {
  app_slug: "jig-desktop-mobile",
  client_id: "Iv1.shared-fixture",
};

describe("GitHub App Device Flow primitives", () => {
  it("starts Device Flow with only client_id and offline_access", async () => {
    let requestBody = "";
    const fetcher: GitHubFetch = async (input, init) => {
      expect(String(input)).toBe("https://github.com/login/device/code");
      requestBody =
        init?.body instanceof URLSearchParams
          ? init.body.toString()
          : "";
      return Response.json({
        device_code: "device-code",
        user_code: "ABCD-EFGH",
        verification_uri: "https://github.com/login/device",
        expires_in: 900,
        interval: 5,
      });
    };

    const authorization = await startGitHubDeviceAuthorization(
      REGISTRATION,
      fetcher,
    );
    const params = new URLSearchParams(requestBody);

    expect(params.get("client_id")).toBe(REGISTRATION.client_id);
    expect(params.get("scope")).toBe("offline_access");
    expect(params.has("client_secret")).toBe(false);
    expect(params.has("redirect_uri")).toBe(false);
    expect(authorization).toStrictEqual({
      device_code: "device-code",
      user_code: "ABCD-EFGH",
      verification_uri: "https://github.com/login/device",
      expires_in: 900,
      interval: 5,
    });
  });

  it("polls Device Flow without client_secret and resolves the GitHub user id", async () => {
    let stage = 0;
    const requestBodies: string[] = [];
    const fetcher: GitHubFetch = async (input, init) => {
      const url = String(input);
      if (url.endsWith("/login/oauth/access_token")) {
        requestBodies.push(
          init?.body instanceof URLSearchParams
            ? init.body.toString()
            : "",
        );
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

    const authorization = {
      device_code: "device-code",
      user_code: "ABCD-EFGH",
      verification_uri: "https://github.com/login/device",
      expires_in: 900,
      interval: 5,
    };

    await expect(
      pollGitHubDeviceAuthorization(
        REGISTRATION,
        authorization,
        5,
        new Date("2030-01-01T00:00:00.000Z"),
        fetcher,
      ),
    ).resolves.toStrictEqual({
      status: "pending",
      retry_after_seconds: 5,
    });

    const authorized = await pollGitHubDeviceAuthorization(
      REGISTRATION,
      authorization,
      5,
      new Date("2030-01-01T00:00:00.000Z"),
      fetcher,
    );
    expect(authorized.status).toBe("authorized");
    if (authorized.status === "authorized") {
      expect(authorized.credential).toStrictEqual({
        user_id: 99,
        access_token: "device-access",
        refresh_token: "device-refresh",
        access_token_expires_at: "2030-01-01T08:00:00.000Z",
        refresh_token_expires_at: "2030-07-04T00:00:00.000Z",
      });
    }

    for (const body of requestBodies) {
      const params = new URLSearchParams(body);
      expect(params.get("client_id")).toBe(REGISTRATION.client_id);
      expect(params.get("device_code")).toBe("device-code");
      expect(params.get("grant_type")).toBe(
        "urn:ietf:params:oauth:grant-type:device_code",
      );
      expect(params.has("client_secret")).toBe(false);
      expect(params.has("redirect_uri")).toBe(false);
    }
  });

  it("uses GitHub's returned slow_down interval when present", async () => {
    const fetcher: GitHubFetch = async () =>
      Response.json(
        { error: "slow_down", interval: 12 },
        { status: 400 },
      );

    await expect(
      pollGitHubDeviceAuthorization(
        REGISTRATION,
        {
          device_code: "device-code",
          user_code: "ABCD-EFGH",
          verification_uri: "https://github.com/login/device",
          expires_in: 900,
          interval: 5,
        },
        5,
        new Date("2030-01-01T00:00:00.000Z"),
        fetcher,
      ),
    ).resolves.toStrictEqual({
      status: "slow-down",
      retry_after_seconds: 12,
    });
  });

  it("refreshes Device Flow credentials without client_secret", async () => {
    let requestBody = "";
    const fetcher: GitHubFetch = async (input, init) => {
      const url = String(input);
      if (url.endsWith("/login/oauth/access_token")) {
        requestBody =
          init?.body instanceof URLSearchParams
            ? init.body.toString()
            : "";
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
      REGISTRATION,
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

    const params = new URLSearchParams(requestBody);
    expect(params.get("client_id")).toBe(REGISTRATION.client_id);
    expect(params.get("grant_type")).toBe("refresh_token");
    expect(params.get("refresh_token")).toBe("old-refresh");
    expect(params.has("client_secret")).toBe(false);
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
  it("consumes every installation and repository page before returning", async () => {
    const installationPageOne = Array.from({ length: 100 }, (_, index) => ({
      id: index + 1,
      account: {
        id: 1_000 + index,
        login: `org-${index + 1}`,
        type: "Organization",
      },
    }));
    const repositoryPageOne = Array.from({ length: 100 }, (_, index) => ({
      id: index + 1,
      name: `planning-${index + 1}`,
      clone_url: `https://github.com/example/planning-${index + 1}.git`,
      owner: { login: "example" },
    }));

    const fetcher: GitHubFetch = async (input) => {
      const url = String(input);
      if (url === "https://api.github.com/user/installations?per_page=100") {
        return Response.json(
          { installations: installationPageOne },
          {
            headers: {
              link:
                '<https://api.github.com/user/installations?per_page=100&page=2>; rel="next"',
            },
          },
        );
      }
      if (url.endsWith("/user/installations?per_page=100&page=2")) {
        return Response.json({
          installations: [
            {
              id: 101,
              account: {
                id: 1_101,
                login: "org-101",
                type: "Organization",
              },
            },
          ],
        });
      }
      if (
        url ===
        "https://api.github.com/user/installations/10/repositories?per_page=100"
      ) {
        return Response.json(
          { repositories: repositoryPageOne },
          {
            headers: {
              link:
                '<https://api.github.com/user/installations/10/repositories?per_page=100&page=2>; rel="next"',
            },
          },
        );
      }
      if (url.endsWith("/repositories?per_page=100&page=2")) {
        return Response.json({
          repositories: [
            {
              id: 101,
              name: "planning-101",
              clone_url: "https://github.com/example/planning-101.git",
              owner: { login: "example" },
            },
          ],
        });
      }
      throw new Error("Unexpected fetch " + url);
    };

    const installations = await listGitHubInstallations("access", fetcher);
    expect(installations).toHaveLength(101);
    expect(installations[100]?.id).toBe(101);

    const repositories = await listGitHubRepositories("access", 10, fetcher);
    expect(repositories).toHaveLength(101);
    expect(repositories[100]).toMatchObject({
      id: 101,
      owner: "example",
      name: "planning-101",
    });
  });

});
