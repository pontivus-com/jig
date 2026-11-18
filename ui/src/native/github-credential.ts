import type { GitHubCredential } from "../../../src/github";
import { refreshGitHubCredential } from "../../../src/github-auth";
import { GITHUB_APP_REGISTRATION } from "../../../src/github-registration";
import { createAndroidGitHubFetch } from "./github-fetch";
import {
  loadAndroidGitHubCredential,
  storeAndroidGitHubCredential,
  type SecureCredentialsPort,
} from "./secure-credentials";

const REFRESH_WINDOW_MS = 5 * 60 * 1000;

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
    throw new Error(
      "GitHub authorization is unavailable; reconnect GitHub",
    );
  }
  if (!expiresSoon(current, now)) {
    return current;
  }

  const refreshed = await refreshGitHubCredential(
    GITHUB_APP_REGISTRATION,
    current,
    now,
    createAndroidGitHubFetch(),
  );
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
