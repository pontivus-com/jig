import { describe, expect, it } from "vitest";
import type { GitHubAppRegistration } from "../../src/github/model";
import {
  pollGitHubDeviceAuthorization,
  startGitHubDeviceAuthorization,
} from "../../src/github-auth";
import {
  createAndroidGitHubFetch,
} from "../../ui/src/native/github-fetch";
import type {
  NativeGitHttpRequest,
  NativeGitHttpResponse,
  NativeHttpPort,
} from "../../ui/src/native/git-http";
import {
  base64ToBytes,
  bytesToBase64,
} from "../../ui/src/native/binary";

const REGISTRATION: GitHubAppRegistration = {
  app_slug: "jig-desktop-mobile",
  client_id: "Iv23liyCoLFStLGRXgUk",
};

function jsonResponse(
  url: string,
  status: number,
  payload: unknown,
): NativeGitHttpResponse {
  return {
    url,
    status,
    headers: {
      "content-type": "application/json",
    },
    data: bytesToBase64(
      new TextEncoder().encode(JSON.stringify(payload)),
    ),
  };
}

function requestText(
  request: NativeGitHttpRequest,
): string {
  return request.data === undefined
    ? ""
    : new TextDecoder().decode(
        base64ToBytes(request.data),
      );
}

describe("Android GitHub native HTTP composition", () => {
  it("runs the shared Device Flow request/poll/user lookup through the native HTTP port", async () => {
    const requests: NativeGitHttpRequest[] = [];
    let tokenPolls = 0;

    const native: NativeHttpPort = {
      async request(request) {
        requests.push(request);

        if (
          request.url ===
          "https://github.com/login/device/code"
        ) {
          return jsonResponse(
            request.url,
            200,
            {
              device_code: "device-code",
              user_code: "ABCD-EFGH",
              verification_uri:
                "https://github.com/login/device",
              expires_in: 900,
              interval: 5,
            },
          );
        }

        if (
          request.url ===
          "https://github.com/login/oauth/access_token"
        ) {
          tokenPolls += 1;
          if (tokenPolls === 1) {
            return jsonResponse(
              request.url,
              400,
              { error: "authorization_pending" },
            );
          }
          return jsonResponse(
            request.url,
            200,
            {
              access_token: "android-access",
              expires_in: 28800,
              refresh_token: "android-refresh",
              refresh_token_expires_in: 15897600,
            },
          );
        }

        if (
          request.url ===
          "https://api.github.com/user"
        ) {
          expect(request.headers.authorization).toBe(
            "Bearer android-access",
          );
          return jsonResponse(
            request.url,
            200,
            { id: 99 },
          );
        }

        throw new Error(
          `Unexpected native GitHub request: ${request.url}`,
        );
      },
    };

    const fetcher = createAndroidGitHubFetch(native);
    const authorization =
      await startGitHubDeviceAuthorization(
        REGISTRATION,
        fetcher,
      );

    expect(authorization).toMatchObject({
      device_code: "device-code",
      user_code: "ABCD-EFGH",
      interval: 5,
    });

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

    const completed =
      await pollGitHubDeviceAuthorization(
        REGISTRATION,
        authorization,
        5,
        new Date("2030-01-01T00:00:00.000Z"),
        fetcher,
      );

    expect(completed).toStrictEqual({
      status: "authorized",
      credential: {
        user_id: 99,
        access_token: "android-access",
        refresh_token: "android-refresh",
        access_token_expires_at:
          "2030-01-01T08:00:00.000Z",
        refresh_token_expires_at:
          "2030-07-04T00:00:00.000Z",
      },
    });

    const deviceRequest = requests.find(
      ({ url }) =>
        url === "https://github.com/login/device/code",
    );
    expect(deviceRequest).toBeDefined();
    const deviceParams = new URLSearchParams(
      requestText(deviceRequest!),
    );
    expect(deviceParams.get("client_id")).toBe(
      REGISTRATION.client_id,
    );
    expect(deviceParams.get("scope")).toBe(
      "offline_access",
    );
    expect(deviceParams.has("client_secret")).toBe(false);
    expect(deviceParams.has("redirect_uri")).toBe(false);

    const pollRequests = requests.filter(
      ({ url }) =>
        url ===
        "https://github.com/login/oauth/access_token",
    );
    expect(pollRequests).toHaveLength(2);
    for (const request of pollRequests) {
      const params = new URLSearchParams(
        requestText(request),
      );
      expect(params.get("client_id")).toBe(
        REGISTRATION.client_id,
      );
      expect(params.get("device_code")).toBe(
        "device-code",
      );
      expect(params.get("grant_type")).toBe(
        "urn:ietf:params:oauth:grant-type:device_code",
      );
      expect(params.has("client_secret")).toBe(false);
      expect(params.has("redirect_uri")).toBe(false);
    }
  });
});
