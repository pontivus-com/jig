import { Capacitor } from "@capacitor/core";
import type {
  GitHubCapabilityStatus,
  GitHubOnboardingSnapshot,
  GitHubReconnectSnapshot,
} from "../../src/github";
import {
  parseGitHubCapabilityStatus,
  parseGitHubOnboardingSnapshot,
  parseGitHubReconnectSnapshot,
} from "../../src/github";
import {
  fetchJson,
  postJson,
} from "./http";

export type {
  GitHubOnboardingSnapshot,
  GitHubReconnectSnapshot,
};

export interface SetupStatus {
  readonly mode: "bootstrap" | "configured";
  readonly local_repository_available: boolean;
  readonly github_available: boolean;
}

function isObjectRecord(
  value: unknown,
): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function asObject(value: unknown): Record<string, unknown> {
  if (!isObjectRecord(value)) {
    throw new TypeError("Jig setup service returned an invalid response");
  }
  return value;
}

async function androidGitHubSetup() {
  return import("./native/github-setup");
}

export function usesNativeSetupProviderContinuation(): boolean {
  return Capacitor.isNativePlatform();
}

function nativeSetupUnavailable(operation: string): never {
  throw new Error(
    `${operation} is not available in the Android shell until the governed native onboarding capability is installed`,
  );
}

export async function readGitHubCapabilityStatus():
Promise<GitHubCapabilityStatus> {
  if (Capacitor.isNativePlatform()) {
    return (await androidGitHubSetup()).readAndroidGitHubCapabilityStatus();
  }
  return parseGitHubCapabilityStatus(
    await fetchJson("/api/v1/github/status"),
  );
}

export async function readSetupStatus(): Promise<SetupStatus> {
  if (Capacitor.isNativePlatform()) {
    return (await androidGitHubSetup()).readAndroidSetupStatus();
  }

  const [rawSetup, github] = await Promise.all([
    fetchJson("/api/v1/setup/status"),
    readGitHubCapabilityStatus(),
  ]);
  const payload = asObject(rawSetup);
  if (
    (payload.mode !== "bootstrap" && payload.mode !== "configured") ||
    (
      payload.mode === "bootstrap" &&
      typeof payload.local_repository_available !== "boolean"
    )
  ) {
    throw new TypeError("Jig setup service returned invalid setup status");
  }

  return {
    mode: payload.mode,
    local_repository_available:
      payload.mode === "configured"
        ? true
        : payload.local_repository_available === true,
    github_available: github.onboarding_available,
  };
}

export async function configureLocalRepository(
  repositoryPath: string,
): Promise<string> {
  if (Capacitor.isNativePlatform()) {
    return nativeSetupUnavailable("Local repository setup");
  }
  const payload = asObject(
    await postJson("/api/v1/setup/local-repository", {
      repository_path: repositoryPath,
    }),
  );
  if (
    payload.configured !== true ||
    typeof payload.repository_path !== "string"
  ) {
    throw new TypeError("Jig setup service returned invalid setup completion");
  }
  return payload.repository_path;
}

export async function connectGitHubSetup():
Promise<GitHubOnboardingSnapshot> {
  if (Capacitor.isNativePlatform()) {
    return (await androidGitHubSetup()).connectAndroidGitHubSetup();
  }
  return parseGitHubOnboardingSnapshot(
    await postJson("/api/v1/setup/github/connect", {}),
  );
}

export async function readGitHubSetupState():
Promise<GitHubOnboardingSnapshot> {
  if (Capacitor.isNativePlatform()) {
    return (await androidGitHubSetup()).readAndroidGitHubSetupSnapshot();
  }
  return parseGitHubOnboardingSnapshot(
    await fetchJson("/api/v1/setup/github/state"),
  );
}

export async function selectGitHubRepository(
  repositoryId: number,
): Promise<GitHubOnboardingSnapshot> {
  if (Capacitor.isNativePlatform()) {
    return (await androidGitHubSetup()).selectAndroidGitHubRepository(
      repositoryId,
    );
  }
  return parseGitHubOnboardingSnapshot(
    await postJson("/api/v1/setup/github/select-repository", {
      repository_id: repositoryId,
    }),
  );
}

export async function retryGitHubSetup():
Promise<GitHubOnboardingSnapshot> {
  if (Capacitor.isNativePlatform()) {
    return (await androidGitHubSetup()).retryAndroidGitHubSetup();
  }
  return parseGitHubOnboardingSnapshot(
    await postJson("/api/v1/setup/github/retry", {}),
  );
}

export async function resumeGitHubSetup(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    (await androidGitHubSetup()).resumeAndroidGitHubSetup();
  }
}

export async function reconnectGitHub():
Promise<GitHubReconnectSnapshot> {
  if (Capacitor.isNativePlatform()) {
    return (await androidGitHubSetup()).reconnectAndroidGitHub();
  }
  return parseGitHubReconnectSnapshot(
    await postJson("/api/v1/github/reconnect", {}),
  );
}

export async function readGitHubReconnectState():
Promise<GitHubReconnectSnapshot> {
  if (Capacitor.isNativePlatform()) {
    return (await androidGitHubSetup()).readAndroidGitHubReconnectSnapshot();
  }
  return parseGitHubReconnectSnapshot(
    await fetchJson("/api/v1/github/reconnect/state"),
  );
}

export async function resumeGitHubReconnect(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    (await androidGitHubSetup()).resumeAndroidGitHubReconnect();
  }
}
