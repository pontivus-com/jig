export interface GitHubAppRegistration {
  readonly app_slug: string;
  readonly client_id: string;
}

export interface GitHubCredential {
  readonly user_id: number;
  readonly access_token: string;
  readonly refresh_token: string | null;
  readonly access_token_expires_at: string | null;
  readonly refresh_token_expires_at: string | null;
}

export interface GitHubInstallation {
  readonly id: number;
  readonly account: {
    readonly id: number;
    readonly login: string;
    readonly type: string;
  };
}

export interface GitHubRepository {
  readonly id: number;
  readonly owner: string;
  readonly name: string;
  readonly clone_url: string;
}

export interface GitHubRepositoryChoice extends GitHubRepository {
  readonly installation_id: number;
  readonly account_login: string;
  readonly account_type: string;
}

export interface GitHubDeviceAuthorization {
  readonly device_code: string;
  readonly user_code: string;
  readonly verification_uri: string;
  readonly expires_in: number;
  readonly interval: number;
}

export type GitHubDevicePollResult =
  | { readonly status: "pending"; readonly retry_after_seconds: number }
  | { readonly status: "slow-down"; readonly retry_after_seconds: number }
  | { readonly status: "authorized"; readonly credential: GitHubCredential }
  | { readonly status: "denied" }
  | { readonly status: "expired" };

export interface GitHubDeviceSessionState {
  readonly authorization: GitHubDeviceAuthorization;
  readonly retry_after_seconds: number;
  readonly started_at_ms: number;
  readonly next_poll_at_ms: number;
}

export type GitHubDevicePollDecision =
  | {
      readonly status: "wait";
      readonly state: GitHubDeviceSessionState;
    }
  | {
      readonly status: "poll";
      readonly state: GitHubDeviceSessionState;
    }
  | { readonly status: "expired" };

export type GitHubDeviceTransition =
  | {
      readonly status: "pending";
      readonly state: GitHubDeviceSessionState;
    }
  | { readonly status: "authorized"; readonly credential: GitHubCredential }
  | { readonly status: "denied" }
  | { readonly status: "expired" };

export interface GitHubAuthorizationPresentation {
  readonly mode: "device";
  readonly verification_uri: string;
  readonly user_code: string;
}

export interface GitHubAuthorizationSnapshot {
  readonly available: boolean;
  readonly phase: "idle" | "authorizing";
  readonly authorization: GitHubAuthorizationPresentation | null;
  readonly error: string | null;
}

export type GitHubOnboardingState =
  | "initial"
  | "connecting"
  | "repository-selection"
  | "attention";

export interface GitHubOnboardingSnapshot {
  readonly available: boolean;
  readonly state: GitHubOnboardingState;
  readonly authorization: GitHubAuthorizationPresentation | null;
  readonly provider_url: string | null;
  readonly repositories: readonly GitHubRepositoryChoice[];
  readonly error: string | null;
}

export type GitHubReconnectState =
  | "initial"
  | "connecting"
  | "attention";

export interface GitHubReconnectSnapshot {
  readonly available: boolean;
  readonly state: GitHubReconnectState;
  readonly authorization: GitHubAuthorizationPresentation | null;
  readonly error: string | null;
}

export interface GitHubCapabilityStatus {
  readonly onboarding_available: boolean;
  readonly reconnect_available: boolean;
}

export function startGitHubDeviceSession(
  authorization: GitHubDeviceAuthorization,
  nowMs: number,
): GitHubDeviceSessionState {
  return {
    authorization,
    retry_after_seconds: authorization.interval,
    started_at_ms: nowMs,
    next_poll_at_ms: nowMs + authorization.interval * 1000,
  };
}

export function githubDevicePollDecision(
  state: GitHubDeviceSessionState,
  nowMs: number,
): GitHubDevicePollDecision {
  if (
    nowMs - state.started_at_ms >=
    state.authorization.expires_in * 1000
  ) {
    return { status: "expired" };
  }
  if (nowMs < state.next_poll_at_ms) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((state.next_poll_at_ms - nowMs) / 1000),
    );
    return {
      status: "wait",
      state: {
        ...state,
        retry_after_seconds: retryAfterSeconds,
      },
    };
  }
  return { status: "poll", state };
}

export function applyGitHubDevicePollResult(
  state: GitHubDeviceSessionState,
  result: GitHubDevicePollResult,
  nowMs: number,
): GitHubDeviceTransition {
  switch (result.status) {
    case "authorized":
      return { status: "authorized", credential: result.credential };
    case "denied":
      return { status: "denied" };
    case "expired":
      return { status: "expired" };
    case "pending":
    case "slow-down":
      return {
        status: "pending",
        state: {
          ...state,
          retry_after_seconds: result.retry_after_seconds,
          next_poll_at_ms: nowMs + result.retry_after_seconds * 1000,
        },
      };
  }
}

export function githubAuthorizationPresentation(
  state: GitHubDeviceSessionState | null,
): GitHubAuthorizationPresentation | null {
  return state === null
    ? null
    : {
        mode: "device",
        verification_uri: state.authorization.verification_uri,
        user_code: state.authorization.user_code,
      };
}

function objectRecord(
  value: unknown,
  message: string,
): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(message);
  }
  return Object.fromEntries(Object.entries(value));
}

function requiredString(
  object: Record<string, unknown>,
  key: string,
): string {
  const value = object[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`GitHub integration field ${key} must be a string`);
  }
  return value;
}

function requiredPositiveInteger(
  object: Record<string, unknown>,
  key: string,
): number {
  const value = object[key];
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value <= 0
  ) {
    throw new TypeError(
      `GitHub integration field ${key} must be a positive integer`,
    );
  }
  return value;
}

function nullableString(
  object: Record<string, unknown>,
  key: string,
): string | null {
  const value = object[key];
  if (value === null) {
    return null;
  }
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(
      `GitHub integration field ${key} must be a string or null`,
    );
  }
  return value;
}

function parseAuthorizationPresentation(
  value: unknown,
): GitHubAuthorizationPresentation | null {
  if (value === null) {
    return null;
  }
  const object = objectRecord(
    value,
    "GitHub authorization state must be an object or null",
  );
  if (object.mode !== "device") {
    throw new TypeError("GitHub authorization state is invalid");
  }
  return {
    mode: "device",
    verification_uri: requiredString(object, "verification_uri"),
    user_code: requiredString(object, "user_code"),
  };
}

function parseRepositoryChoice(value: unknown): GitHubRepositoryChoice {
  const repository = objectRecord(
    value,
    "GitHub repository choice is invalid",
  );
  return {
    id: requiredPositiveInteger(repository, "id"),
    owner: requiredString(repository, "owner"),
    name: requiredString(repository, "name"),
    clone_url: requiredString(repository, "clone_url"),
    installation_id: requiredPositiveInteger(
      repository,
      "installation_id",
    ),
    account_login: requiredString(repository, "account_login"),
    account_type: requiredString(repository, "account_type"),
  };
}

export function parseGitHubReconnectSnapshot(
  value: unknown,
): GitHubReconnectSnapshot {
  const object = objectRecord(
    value,
    "GitHub reconnect snapshot must be an object",
  );
  if (
    typeof object.available !== "boolean" ||
    (
      object.state !== "initial" &&
      object.state !== "connecting" &&
      object.state !== "attention"
    ) ||
    (object.error !== null && typeof object.error !== "string")
  ) {
    throw new TypeError("GitHub reconnect snapshot is invalid");
  }
  return {
    available: object.available,
    state: object.state,
    authorization: parseAuthorizationPresentation(object.authorization),
    error: typeof object.error === "string" ? object.error : null,
  };
}

export function parseGitHubOnboardingSnapshot(
  value: unknown,
): GitHubOnboardingSnapshot {
  const object = objectRecord(
    value,
    "GitHub onboarding snapshot must be an object",
  );
  if (
    typeof object.available !== "boolean" ||
    (
      object.state !== "initial" &&
      object.state !== "connecting" &&
      object.state !== "repository-selection" &&
      object.state !== "attention"
    ) ||
    !Array.isArray(object.repositories) ||
    (object.error !== null && typeof object.error !== "string")
  ) {
    throw new TypeError("GitHub onboarding snapshot is invalid");
  }

  return {
    available: object.available,
    state: object.state,
    authorization: parseAuthorizationPresentation(object.authorization),
    provider_url: nullableString(object, "provider_url"),
    repositories: object.repositories.map(parseRepositoryChoice),
    error: typeof object.error === "string" ? object.error : null,
  };
}

export function parseGitHubCapabilityStatus(
  value: unknown,
): GitHubCapabilityStatus {
  const object = objectRecord(
    value,
    "GitHub capability status must be an object",
  );
  if (
    typeof object.onboarding_available !== "boolean" ||
    typeof object.reconnect_available !== "boolean"
  ) {
    throw new TypeError("GitHub capability status is invalid");
  }
  return {
    onboarding_available: object.onboarding_available,
    reconnect_available: object.reconnect_available,
  };
}
