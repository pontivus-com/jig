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

function nativeSetupUnavailable(operation: string): never {
  throw new Error(
    `${operation} is not available in the Android shell until the governed native onboarding capability is installed`,
  );
}

export async function readGitHubCapabilityStatus(): Promise<GitHubCapabilityStatus> {
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

export async function startGitHubSetup(): Promise<GitHubOnboardingSnapshot> {
  if (Capacitor.isNativePlatform()) {
    return (await androidGitHubSetup()).startAndroidGitHubSetup();
  }
  return parseGitHubOnboardingSnapshot(
    await postJson("/api/v1/setup/github/start", {}),
  );
}

export async function refreshGitHubSetup(): Promise<GitHubOnboardingSnapshot> {
  if (Capacitor.isNativePlatform()) {
    return (await androidGitHubSetup()).refreshAndroidGitHubSetup();
  }
  return parseGitHubOnboardingSnapshot(
    await postJson("/api/v1/setup/github/refresh-access", {}),
  );
}

export async function readGitHubRepositories(): Promise<GitHubOnboardingSnapshot> {
  if (Capacitor.isNativePlatform()) {
    return (await androidGitHubSetup()).readAndroidGitHubSetupSnapshot();
  }
  return parseGitHubOnboardingSnapshot(
    await fetchJson("/api/v1/setup/github/repositories"),
  );
}

export async function startGitHubReconnect(): Promise<GitHubReconnectSnapshot> {
  if (Capacitor.isNativePlatform()) {
    return (await androidGitHubSetup()).startAndroidGitHubReconnect();
  }
  return parseGitHubReconnectSnapshot(
    await postJson("/api/v1/github/reconnect/start", {}),
  );
}

export async function refreshGitHubReconnect(): Promise<GitHubReconnectSnapshot> {
  if (Capacitor.isNativePlatform()) {
    return (await androidGitHubSetup()).refreshAndroidGitHubReconnect();
  }
  return parseGitHubReconnectSnapshot(
    await postJson("/api/v1/github/reconnect/refresh", {}),
  );
}

export async function acquireGitHubRepository(
  repositoryId: number,
): Promise<string> {
  if (Capacitor.isNativePlatform()) {
    return (await androidGitHubSetup()).acquireAndroidGitHubRepository(repositoryId);
  }
  const payload = asObject(
    await postJson("/api/v1/setup/github/acquire", {
      repository_id: repositoryId,
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
