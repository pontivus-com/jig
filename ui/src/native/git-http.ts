import {
  CapacitorHttp,
  type HttpOptions,
  type HttpResponse,
} from "@capacitor/core";
import {
  base64ToBytes,
  bytesToBase64,
  collectBytes,
  singleChunk,
} from "./binary";

export interface GitHttpRequest {
  readonly url: string;
  readonly method?: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: AsyncIterableIterator<Uint8Array>;
  readonly signal?: AbortSignal;
}

export interface GitHttpResponse {
  readonly url: string;
  readonly method?: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: AsyncIterableIterator<Uint8Array>;
  readonly statusCode: number;
  readonly statusMessage: string;
}

export interface IsomorphicGitHttpClient {
  request(request: GitHttpRequest): Promise<GitHttpResponse>;
}

export interface NativeHttpPort {
  request(options: HttpOptions): Promise<HttpResponse>;
}

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

function responseBytes(response: HttpResponse): Uint8Array {
  if (response.status >= 400) {
    if (typeof response.data === "string") {
      return new TextEncoder().encode(response.data);
    }
    return new TextEncoder().encode(JSON.stringify(response.data));
  }

  if (typeof response.data !== "string") {
    throw new AndroidGitHttpError(
      "Native Git HTTP returned non-string binary response data",
    );
  }
  return base64ToBytes(response.data);
}

function assertNotAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted === true) {
    throw new DOMException("Git HTTP request aborted", "AbortError");
  }
}

export function createAndroidGitHttpClient(
  nativeHttp: NativeHttpPort = CapacitorHttp,
): IsomorphicGitHttpClient {
  return {
    async request(request) {
      assertNotAborted(request.signal);

      const method = request.method ?? "GET";
      const headers = normalizedHeaders(request.headers);
      let data: string | undefined;
      let dataType: "file" | undefined;

      if (request.body !== undefined) {
        const bytes = await collectBytes(request.body);
        assertNotAborted(request.signal);
        data = bytesToBase64(bytes);
        dataType = "file";
      }

      const response = await nativeHttp.request({
        url: request.url,
        method,
        headers,
        ...(data === undefined ? {} : { data }),
        ...(dataType === undefined ? {} : { dataType }),
        responseType: "arraybuffer",
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
