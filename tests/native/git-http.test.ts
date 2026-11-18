import { describe, expect, it } from "vitest";
import {
  createAndroidGitHttpClient,
  type NativeGitHttpRequest,
  type NativeGitHttpResponse,
  type NativeHttpPort,
} from "../../ui/src/native/git-http";
import {
  bytesToBase64,
  collectBytes,
} from "../../ui/src/native/binary";

function requiredBody(
  body: AsyncIterableIterator<Uint8Array> | undefined,
): AsyncIterableIterator<Uint8Array> {
  if (body === undefined) {
    throw new Error("Expected Git HTTP response body");
  }
  return body;
}

function response(
  overrides: Partial<NativeGitHttpResponse> = {},
): NativeGitHttpResponse {
  return {
    data: "",
    status: 200,
    headers: {},
    url: "https://example.invalid/repo.git/git-upload-pack",
    ...overrides,
  };
}

describe("Android isomorphic-git native HTTP adapter", () => {
  it("sends smart-HTTP request bytes through the native raw byte plugin", async () => {
    let captured: NativeGitHttpRequest | null = null;
    const nativeHttp: NativeHttpPort = {
      async request(options) {
        captured = options;
        return response({
          data: "ECAwQA==",
          headers: {
            "content-type":
              "application/x-git-upload-pack-result",
          },
        });
      },
    };
    const client = createAndroidGitHttpClient(nativeHttp);
    const body = (async function* () {
      yield Uint8Array.from([0, 255]);
      yield Uint8Array.from([1, 2]);
    })();

    const result = await client.request({
      url: "https://example.invalid/repo.git/git-upload-pack",
      method: "POST",
      headers: {
        "content-type":
          "application/x-git-upload-pack-request",
        accept: "application/x-git-upload-pack-result",
      },
      body,
    });

    expect(captured).toStrictEqual({
      url: "https://example.invalid/repo.git/git-upload-pack",
      method: "POST",
      headers: {
        "content-type":
          "application/x-git-upload-pack-request",
        accept: "application/x-git-upload-pack-result",
      },
      data: "AP8BAg==",
    });
    expect(result).toMatchObject({
      url: "https://example.invalid/repo.git/git-upload-pack",
      method: "POST",
      statusCode: 200,
      statusMessage: "OK",
      headers: {
        "content-type":
          "application/x-git-upload-pack-result",
      },
    });
    await expect(collectBytes(requiredBody(result.body))).resolves.toStrictEqual(
      Uint8Array.from([16, 32, 48, 64]),
    );
  });

  it("does not add a request body to smart-HTTP discovery GET", async () => {
    let captured: NativeGitHttpRequest | null = null;
    const nativeHttp: NativeHttpPort = {
      async request(options) {
        captured = options;
        return response({
          url: "https://example.invalid/repo.git/info/refs?service=git-upload-pack",
          data: "MDAwMA==",
        });
      },
    };
    const client = createAndroidGitHttpClient(nativeHttp);

    await client.request({
      url: "https://example.invalid/repo.git/info/refs?service=git-upload-pack",
      headers: {
        accept: "*/*",
      },
    });

    expect(captured).toStrictEqual({
      url: "https://example.invalid/repo.git/info/refs?service=git-upload-pack",
      method: "GET",
      headers: {
        accept: "*/*",
      },
    });
  });

  it("decodes native error-stream bytes from the same base64 contract", async () => {
    const nativeHttp: NativeHttpPort = {
      async request() {
        return response({
          status: 401,
          data: bytesToBase64(
            new TextEncoder().encode("authentication required"),
          ),
          headers: {
            "www-authenticate": "Basic realm=git",
          },
        });
      },
    };
    const client = createAndroidGitHttpClient(nativeHttp);
    const result = await client.request({
      url: "https://example.invalid/private.git/info/refs",
    });

    expect(result.statusCode).toBe(401);
    expect(result.statusMessage).toBe("Unauthorized");
    await expect(
      collectBytes(requiredBody(result.body)).then((bytes) =>
        new TextDecoder().decode(bytes),
      ),
    ).resolves.toBe("authentication required");
  });

  it("does not start native network I/O for an already-aborted request", async () => {
    let calls = 0;
    const nativeHttp: NativeHttpPort = {
      async request() {
        calls += 1;
        return response();
      },
    };
    const controller = new AbortController();
    controller.abort();

    await expect(
      createAndroidGitHttpClient(nativeHttp).request({
        url: "https://example.invalid/repo.git/info/refs",
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(calls).toBe(0);
  });
});
