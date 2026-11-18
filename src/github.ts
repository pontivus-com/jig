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
