import type { GitHubFetch } from "../../../src/github-auth";
import {
  androidNativeHttp,
  type NativeHttpPort,
} from "./git-http";
import {
  base64ToBytes,
  bytesToBase64,
} from "./binary";

function mergeHeaders(
  input: string | URL | Request,
  init: RequestInit | undefined,
): Record<string, string> {
  const headers = new Headers(
    input instanceof Request ? input.headers : undefined,
  );
  if (init?.headers !== undefined) {
    new Headers(init.headers).forEach((value, key) => {
      headers.set(key, value);
    });
  }
  return Object.fromEntries(headers.entries());
}

async function requestBody(
  input: string | URL | Request,
  init: RequestInit | undefined,
): Promise<string | undefined> {
  const body = init?.body;
  if (body !== undefined && body !== null) {
    if (typeof body === "string") {
      return bytesToBase64(new TextEncoder().encode(body));
    }
    if (body instanceof URLSearchParams) {
      return bytesToBase64(
        new TextEncoder().encode(body.toString()),
      );
    }
    if (body instanceof ArrayBuffer) {
      return bytesToBase64(new Uint8Array(body));
    }
    if (body instanceof Blob) {
      return bytesToBase64(
        new Uint8Array(await body.arrayBuffer()),
      );
    }
    throw new Error(
      "Android GitHub HTTP received an unsupported request body",
    );
  }

  if (input instanceof Request && input.body !== null) {
    return bytesToBase64(
      new Uint8Array(await input.arrayBuffer()),
    );
  }
  return undefined;
}

export function createAndroidGitHubFetch(
  nativeHttp: NativeHttpPort = androidNativeHttp,
): GitHubFetch {
  return async (input, init) => {
    const url =
      input instanceof Request ? input.url : String(input);
    const method =
      init?.method ??
      (input instanceof Request ? input.method : "GET");
    const data = await requestBody(input, init);
    const response = await nativeHttp.request({
      url,
      method,
      headers: mergeHeaders(input, init),
      ...(data === undefined ? {} : { data }),
    });

    const bytes = base64ToBytes(response.data);
    const body = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(body).set(bytes);
    return new Response(body, {
      status: response.status,
      headers: response.headers,
    });
  };
}
