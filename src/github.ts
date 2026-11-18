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

export interface GitHubManageAccess {
  readonly installation_id: number;
  readonly account_login: string;
  readonly manage_url: string;
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
  readonly retry_after_seconds: number;
}

export interface GitHubAuthorizationSnapshot {
  readonly available: boolean;
  readonly phase: "idle" | "authorizing";
  readonly authorization: GitHubAuthorizationPresentation | null;
  readonly error: string | null;
}

export type GitHubOnboardingPhase =
  | GitHubAuthorizationSnapshot["phase"]
  | "repository-access"
  | "repository-selection"
  | "acquiring";

export interface GitHubOnboardingSnapshot {
  readonly available: boolean;
  readonly phase: GitHubOnboardingPhase;
  readonly authorization: GitHubAuthorizationPresentation | null;
  readonly grant_access_url: string | null;
  readonly manage_access: readonly GitHubManageAccess[];
  readonly installations: readonly GitHubInstallation[];
  readonly repositories: readonly GitHubRepositoryChoice[];
  readonly error: string | null;
}

export type GitHubReconnectSnapshot = GitHubAuthorizationSnapshot;

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
        retry_after_seconds: state.retry_after_seconds,
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
  if (typeof value !== "string") {
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
  if (
    object.mode !== "device" ||
    typeof object.retry_after_seconds !== "number" ||
    !Number.isInteger(object.retry_after_seconds) ||
    object.retry_after_seconds <= 0
  ) {
    throw new TypeError("GitHub authorization state is invalid");
  }
  return {
    mode: "device",
    verification_uri: requiredString(object, "verification_uri"),
    user_code: requiredString(object, "user_code"),
    retry_after_seconds: object.retry_after_seconds,
  };
}

function parseAuthorizationBase(
  value: unknown,
): GitHubAuthorizationSnapshot {
  const object = objectRecord(
    value,
    "GitHub authorization snapshot must be an object",
  );
  if (
    typeof object.available !== "boolean" ||
    (object.phase !== "idle" && object.phase !== "authorizing") ||
    (object.error !== null && typeof object.error !== "string")
  ) {
    throw new TypeError("GitHub authorization snapshot is invalid");
  }
  return {
    available: object.available,
    phase: object.phase,
    authorization: parseAuthorizationPresentation(object.authorization),
    error: typeof object.error === "string" ? object.error : null,
  };
}

export function parseGitHubReconnectSnapshot(
  value: unknown,
): GitHubReconnectSnapshot {
  return parseAuthorizationBase(value);
}

export function parseGitHubOnboardingSnapshot(
  value: unknown,
): GitHubOnboardingSnapshot {
  const object = objectRecord(
    value,
    "GitHub onboarding snapshot must be an object",
  );
  const phase = object.phase;
  if (
    phase !== "idle" &&
    phase !== "authorizing" &&
    phase !== "repository-access" &&
    phase !== "repository-selection" &&
    phase !== "acquiring"
  ) {
    throw new TypeError("GitHub onboarding phase is invalid");
  }
  if (
    typeof object.available !== "boolean" ||
    !Array.isArray(object.manage_access) ||
    !Array.isArray(object.installations) ||
    !Array.isArray(object.repositories) ||
    (object.grant_access_url !== null &&
      typeof object.grant_access_url !== "string") ||
    (object.error !== null && typeof object.error !== "string")
  ) {
    throw new TypeError("GitHub onboarding snapshot is invalid");
  }

  const manageAccess = object.manage_access.map((entry) => {
    const access = objectRecord(
      entry,
      "GitHub manage-access entry is invalid",
    );
    return {
      installation_id: requiredPositiveInteger(
        access,
        "installation_id",
      ),
      account_login: requiredString(access, "account_login"),
      manage_url: requiredString(access, "manage_url"),
    };
  });

  const installations = object.installations.map((entry) => {
    const installation = objectRecord(
      entry,
      "GitHub installation entry is invalid",
    );
    const account = objectRecord(
      installation.account,
      "GitHub installation account is invalid",
    );
    return {
      id: requiredPositiveInteger(installation, "id"),
      account: {
        id: requiredPositiveInteger(account, "id"),
        login: requiredString(account, "login"),
        type: requiredString(account, "type"),
      },
    };
  });

  const repositories = object.repositories.map((entry) => {
    const repository = objectRecord(
      entry,
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
  });

  return {
    available: object.available,
    phase,
    authorization: parseAuthorizationPresentation(object.authorization),
    grant_access_url:
      typeof object.grant_access_url === "string"
        ? object.grant_access_url
        : null,
    manage_access: manageAccess,
    installations,
    repositories,
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
