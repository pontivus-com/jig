import { registerPlugin } from "@capacitor/core";
import type {
  GitHttpResponse,
  HttpClient,
} from "isomorphic-git";
import {
  base64ToBytes,
  bytesToBase64,
  collectBytes,
  singleChunk,
} from "./binary";

export type IsomorphicGitHttpClient = HttpClient;

export interface NativeGitHttpRequest {
  readonly url: string;
  readonly method: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly data?: string;
}

export interface NativeGitHttpResponse {
  readonly url: string;
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly data: string;
}

export interface NativeHttpPort {
  request(
    options: NativeGitHttpRequest,
  ): Promise<NativeGitHttpResponse>;
}

const nativeGitHttp =
  registerPlugin<NativeHttpPort>("JigGitHttp");

export class AndroidGitHttpError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AndroidGitHttpError";
  }
}

function normalizedHeaders(
  headers: Readonly<Record<string, string>> | undefined,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers ?? {}).map(([key, value]) => [
      key,
      value,
    ]),
  );
}

function statusMessage(status: number): string {
  if (status >= 200 && status < 300) {
    return "OK";
  }
  if (status === 301) {
    return "Moved Permanently";
  }
  if (status === 302) {
    return "Found";
  }
  if (status === 304) {
    return "Not Modified";
  }
  if (status === 400) {
    return "Bad Request";
  }
  if (status === 401) {
    return "Unauthorized";
  }
  if (status === 403) {
    return "Forbidden";
  }
  if (status === 404) {
    return "Not Found";
  }
  if (status === 408) {
    return "Request Timeout";
  }
  if (status === 409) {
    return "Conflict";
  }
  if (status === 429) {
    return "Too Many Requests";
  }
  if (status >= 500) {
    return "Server Error";
  }
  return `HTTP ${status}`;
}

function responseBytes(
  response: NativeGitHttpResponse,
): Uint8Array {
  return base64ToBytes(response.data);
}

function assertNotAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted === true) {
    throw new DOMException("Git HTTP request aborted", "AbortError");
  }
}

export function createAndroidGitHttpClient(
  nativeHttp: NativeHttpPort = nativeGitHttp,
): IsomorphicGitHttpClient {
  return {
    async request(request): Promise<GitHttpResponse> {
      assertNotAborted(request.signal);

      const method = request.method ?? "GET";
      const headers = normalizedHeaders(request.headers);
      let data: string | undefined;

      if (request.body !== undefined) {
        const bytes = await collectBytes(request.body);
        assertNotAborted(request.signal);
        data = bytesToBase64(bytes);
      }

      const response = await nativeHttp.request({
        url: request.url,
        method,
        headers,
        ...(data === undefined ? {} : { data }),
      });
      assertNotAborted(request.signal);

      const bytes = responseBytes(response);
      return {
        url: response.url,
        method,
        headers: normalizedHeaders(response.headers),
        body: singleChunk(bytes),
        statusCode: response.status,
        statusMessage: statusMessage(response.status),
      };
    },
  };
}
