import type { GitHubCredential } from "../../../src/github/model";
import {
  GitHubAuthError,
  refreshGitHubCredential,
} from "../../../src/github/auth";
import { GITHUB_APP_REGISTRATION } from "../../../src/github/registration";
import { createAndroidGitHubFetch } from "./github-fetch";
import {
  loadAndroidGitHubCredential,
  storeAndroidGitHubCredential,
  type SecureCredentialsPort,
} from "./secure-credentials";

const REFRESH_WINDOW_MS = 5 * 60 * 1000;

export class AndroidGitHubReauthorizationRequiredError extends Error {
  constructor() {
    super("GitHub authorization must be reconnected");
    this.name = "AndroidGitHubReauthorizationRequiredError";
  }
}

function refreshAuthorizationFailed(error: unknown): boolean {
  return (
    error instanceof GitHubAuthError &&
    (
      error.status_code === 400 ||
      error.status_code === 401
    )
  );
}

function refreshTokenUnavailable(
  credential: GitHubCredential,
  now: Date,
): boolean {
  if (credential.refresh_token === null) {
    return true;
  }
  if (credential.refresh_token_expires_at === null) {
    return false;
  }
  const expiry = Date.parse(credential.refresh_token_expires_at);
  return !Number.isFinite(expiry) || expiry <= now.getTime();
}

function expiresSoon(
  credential: GitHubCredential,
  now: Date,
): boolean {
  if (credential.access_token_expires_at === null) {
    return false;
  }
  return (
    Date.parse(credential.access_token_expires_at) -
      now.getTime() <=
    REFRESH_WINDOW_MS
  );
}

export async function currentAndroidGitHubCredential(
  securePort?: SecureCredentialsPort,
  now = new Date(),
): Promise<GitHubCredential> {
  const current = await loadAndroidGitHubCredential(
    securePort,
  );
  if (current === null) {
    throw new AndroidGitHubReauthorizationRequiredError();
  }
  if (!expiresSoon(current, now)) {
    return current;
  }
  if (refreshTokenUnavailable(current, now)) {
    throw new AndroidGitHubReauthorizationRequiredError();
  }

  let refreshed: GitHubCredential;
  try {
    refreshed = await refreshGitHubCredential(
      GITHUB_APP_REGISTRATION,
      current,
      now,
      createAndroidGitHubFetch(),
    );
  } catch (error) {
    if (refreshAuthorizationFailed(error)) {
      throw new AndroidGitHubReauthorizationRequiredError();
    }
    throw error;
  }
  await storeAndroidGitHubCredential(
    refreshed,
    securePort,
  );
  return refreshed;
}

export async function currentAndroidGitHubToken(
  securePort?: SecureCredentialsPort,
): Promise<string> {
  return (
    await currentAndroidGitHubCredential(securePort)
  ).access_token;
}


export async function androidGitHubCredentialNeedsReconnect(
  securePort?: SecureCredentialsPort,
  now = new Date(),
): Promise<boolean> {
  const current = await loadAndroidGitHubCredential(securePort);
  if (current === null) {
    return true;
  }
  return expiresSoon(current, now) &&
    refreshTokenUnavailable(current, now);
}
