import type {
  GitHubAppRegistration,
  GitHubCredential,
  GitHubDeviceAuthorization,
  GitHubDevicePollResult,
  GitHubInstallation,
  GitHubRepository,
} from "../github";

const GITHUB_API_VERSION = "2022-11-28";

export type GitHubFetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export class GitHubAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GitHubAuthError";
  }
}

function objectRecord(value: unknown, message: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new GitHubAuthError(message);
  }
  return Object.fromEntries(Object.entries(value));
}

function positiveInteger(value: unknown, field: string): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value <= 0
  ) {
    throw new GitHubAuthError(`GitHub response has invalid ${field}`);
  }
  return value;
}

function nonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new GitHubAuthError(`GitHub response has invalid ${field}`);
  }
  return value;
}

function optionalSeconds(value: unknown, field: string): number | null {
  if (value === undefined) {
    return null;
  }
  return positiveInteger(value, field);
}

function expiresAt(now: Date, seconds: number | null): string | null {
  return seconds === null
    ? null
    : new Date(now.getTime() + seconds * 1000).toISOString();
}

async function jsonResponse(
  response: Response,
  operation: string,
): Promise<Record<string, unknown>> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new GitHubAuthError(
      `GitHub ${operation} returned a non-JSON response`,
    );
  }
  const object = objectRecord(
    payload,
    `GitHub ${operation} returned an invalid response`,
  );
  if (!response.ok) {
    const message =
      typeof object.error_description === "string"
        ? object.error_description
        : typeof object.message === "string"
          ? object.message
          : typeof object.error === "string"
            ? object.error
            : `HTTP ${response.status}`;
    throw new GitHubAuthError(`GitHub ${operation} failed: ${message}`);
  }
  return object;
}

function apiHeaders(accessToken: string): HeadersInit {
  return {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${accessToken}`,
    "x-github-api-version": GITHUB_API_VERSION,
  };
}

interface TokenResponse {
  readonly access_token: string;
  readonly refresh_token: string | null;
  readonly expires_in: number | null;
  readonly refresh_token_expires_in: number | null;
}

function tokenResponse(payload: Record<string, unknown>): TokenResponse {
  return {
    access_token: nonEmptyString(payload.access_token, "access_token"),
    refresh_token:
      payload.refresh_token === undefined
        ? null
        : nonEmptyString(payload.refresh_token, "refresh_token"),
    expires_in: optionalSeconds(payload.expires_in, "expires_in"),
    refresh_token_expires_in: optionalSeconds(
      payload.refresh_token_expires_in,
      "refresh_token_expires_in",
    ),
  };
}

async function githubUserId(
  accessToken: string,
  fetcher: GitHubFetch,
): Promise<number> {
  const response = await fetcher("https://api.github.com/user", {
    headers: apiHeaders(accessToken),
  });
  const payload = await jsonResponse(response, "user lookup");
  return positiveInteger(payload.id, "user id");
}

async function credentialFromToken(
  token: TokenResponse,
  now: Date,
  fetcher: GitHubFetch,
): Promise<GitHubCredential> {
  return {
    user_id: await githubUserId(token.access_token, fetcher),
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    access_token_expires_at: expiresAt(now, token.expires_in),
    refresh_token_expires_at: expiresAt(
      now,
      token.refresh_token_expires_in,
    ),
  };
}

function assertRegistration(
  registration: GitHubAppRegistration,
): void {
  if (
    registration.app_slug.length === 0 ||
    !/^[a-z0-9-]+$/.test(registration.app_slug) ||
    registration.client_id.length === 0
  ) {
    throw new GitHubAuthError("GitHub App registration is incomplete");
  }
}

export async function refreshGitHubCredential(
  registration: GitHubAppRegistration,
  credential: GitHubCredential,
  now = new Date(),
  fetcher: GitHubFetch = (input, init) => fetch(input, init),
): Promise<GitHubCredential> {
  assertRegistration(registration);
  if (credential.refresh_token === null) {
    throw new GitHubAuthError(
      "GitHub authorization has no refresh token; reconnect GitHub",
    );
  }

  // GitHub does not require client_secret when the user access token was
  // generated through Device Flow.
  const response = await fetcher(
    "https://github.com/login/oauth/access_token",
    {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: registration.client_id,
        grant_type: "refresh_token",
        refresh_token: credential.refresh_token,
      }),
    },
  );
  return credentialFromToken(
    tokenResponse(await jsonResponse(response, "token refresh")),
    now,
    fetcher,
  );
}

export async function listGitHubInstallations(
  accessToken: string,
  fetcher: GitHubFetch = (input, init) => fetch(input, init),
): Promise<readonly GitHubInstallation[]> {
  const response = await fetcher(
    "https://api.github.com/user/installations?per_page=100",
    { headers: apiHeaders(accessToken) },
  );
  const payload = await jsonResponse(response, "installation listing");
  if (!Array.isArray(payload.installations)) {
    throw new GitHubAuthError(
      "GitHub installation listing has no installations array",
    );
  }
  return payload.installations.map((value) => {
    const installation = objectRecord(
      value,
      "GitHub installation entry is invalid",
    );
    const account = objectRecord(
      installation.account,
      "GitHub installation account is invalid",
    );
    return {
      id: positiveInteger(installation.id, "installation id"),
      account: {
        id: positiveInteger(account.id, "account id"),
        login: nonEmptyString(account.login, "account login"),
        type: nonEmptyString(account.type, "account type"),
      },
    };
  });
}

export async function listGitHubRepositories(
  accessToken: string,
  installationId: number,
  fetcher: GitHubFetch = (input, init) => fetch(input, init),
): Promise<readonly GitHubRepository[]> {
  const id = positiveInteger(installationId, "installation id");
  const response = await fetcher(
    `https://api.github.com/user/installations/${id}/repositories?per_page=100`,
    { headers: apiHeaders(accessToken) },
  );
  const payload = await jsonResponse(response, "repository listing");
  if (!Array.isArray(payload.repositories)) {
    throw new GitHubAuthError(
      "GitHub repository listing has no repositories array",
    );
  }
  return payload.repositories.map((value) => {
    const repository = objectRecord(
      value,
      "GitHub repository entry is invalid",
    );
    const owner = objectRecord(
      repository.owner,
      "GitHub repository owner is invalid",
    );
    return {
      id: positiveInteger(repository.id, "repository id"),
      owner: nonEmptyString(owner.login, "repository owner"),
      name: nonEmptyString(repository.name, "repository name"),
      clone_url: nonEmptyString(repository.clone_url, "repository clone URL"),
    };
  });
}

export async function startGitHubDeviceAuthorization(
  registration: GitHubAppRegistration,
  fetcher: GitHubFetch = (input, init) => fetch(input, init),
): Promise<GitHubDeviceAuthorization> {
  assertRegistration(registration);
  const response = await fetcher("https://github.com/login/device/code", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: registration.client_id,
      scope: "offline_access",
    }),
  });
  const payload = await jsonResponse(response, "device authorization");
  return {
    device_code: nonEmptyString(payload.device_code, "device_code"),
    user_code: nonEmptyString(payload.user_code, "user_code"),
    verification_uri: nonEmptyString(
      payload.verification_uri,
      "verification_uri",
    ),
    expires_in: positiveInteger(payload.expires_in, "expires_in"),
    interval: positiveInteger(payload.interval, "interval"),
  };
}

export async function pollGitHubDeviceAuthorization(
  registration: GitHubAppRegistration,
  authorization: GitHubDeviceAuthorization,
  retryAfterSeconds: number,
  now = new Date(),
  fetcher: GitHubFetch = (input, init) => fetch(input, init),
): Promise<GitHubDevicePollResult> {
  assertRegistration(registration);
  const response = await fetcher(
    "https://github.com/login/oauth/access_token",
    {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: registration.client_id,
        device_code: authorization.device_code,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      }),
    },
  );
  let rawPayload: unknown;
  try {
    rawPayload = await response.json();
  } catch {
    throw new GitHubAuthError(
      "GitHub device token response is not valid JSON",
    );
  }
  const payload = objectRecord(
    rawPayload,
    "GitHub device token response is invalid",
  );

  if (response.ok && typeof payload.access_token === "string") {
    return {
      status: "authorized",
      credential: await credentialFromToken(
        tokenResponse(payload),
        now,
        fetcher,
      ),
    };
  }

  if (payload.error === "authorization_pending") {
    return { status: "pending", retry_after_seconds: retryAfterSeconds };
  }
  if (payload.error === "slow_down") {
    const returnedInterval =
      typeof payload.interval === "number" &&
      Number.isInteger(payload.interval) &&
      payload.interval > 0
        ? payload.interval
        : null;
    return {
      status: "slow-down",
      retry_after_seconds:
        returnedInterval ?? retryAfterSeconds + 5,
    };
  }
  if (payload.error === "access_denied") {
    return { status: "denied" };
  }
  if (
    payload.error === "expired_token" ||
    payload.error === "token_expired"
  ) {
    return { status: "expired" };
  }
  const message =
    typeof payload.error_description === "string"
      ? payload.error_description
      : typeof payload.error === "string"
        ? payload.error
        : `HTTP ${response.status}`;
  throw new GitHubAuthError(
    `GitHub device authorization failed: ${message}`,
  );
}
