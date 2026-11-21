import {
  Directory,
  Filesystem,
} from "@capacitor/filesystem";
import type {
  GitHubCapabilityStatus,
  GitHubOnboardingSnapshot,
  GitHubReconnectSnapshot,
} from "../../../src/github";
import {
  listGitHubInstallations,
  listGitHubRepositories,
  pollGitHubDeviceAuthorization,
  startGitHubDeviceAuthorization,
} from "../../../src/github-auth";
import { GitHubDeviceFlowSession } from "../../../src/github-device-flow";
import { GitHubOnboardingController } from "../../../src/github-onboarding";
import { GitHubReconnectController } from "../../../src/github-reconnect";
import { GITHUB_APP_REGISTRATION } from "../../../src/github-registration";
import {
  adoptCanonicalSnapshot,
} from "../../../src/persistence/sqlite";
import {
  acquireAndroidPortableRepository,
  androidPortableHead,
  createAndroidGitEffects,
  removeAndroidManagedCheckout,
} from "./git";
import {
  androidManagedGitHubReconnectRequired,
} from "./github-managed-transport";
import { createAndroidGitHubFetch } from "./github-fetch";
import {
  initializeNativeDatabase,
} from "./jig-sqlite";
import {
  ANDROID_DATABASE_PATH,
  ANDROID_REPOSITORY_ROOT,
} from "./paths";
import {
  assertAndroidCredentialStore,
  loadAndroidGitHubCredential,
  storeAndroidGitHubCredential,
} from "./secure-credentials";

const githubFetch = createAndroidGitHubFetch();

const deviceFlow = new GitHubDeviceFlowSession({
  registration: GITHUB_APP_REGISTRATION,
  assert_credential_store: assertAndroidCredentialStore,
  load_credential: loadAndroidGitHubCredential,
  store_credential: storeAndroidGitHubCredential,
  start_device_authorization: (registration) =>
    startGitHubDeviceAuthorization(
      registration,
      githubFetch,
    ),
  poll_device_authorization: (
    registration,
    authorization,
    retryAfterSeconds,
    now,
  ) =>
    pollGitHubDeviceAuthorization(
      registration,
      authorization,
      retryAfterSeconds,
      now,
      githubFetch,
    ),
});

const onboarding = new GitHubOnboardingController<string>({
  registration: GITHUB_APP_REGISTRATION,
  device_flow: deviceFlow,
  list_installations: (accessToken) =>
    listGitHubInstallations(
      accessToken,
      githubFetch,
    ),
  list_repositories: (accessToken, installationId) =>
    listGitHubRepositories(
      accessToken,
      installationId,
      githubFetch,
    ),
  acquire_repository: async (repository, credential) => {
    const effects = createAndroidGitEffects();
    let database:
      Awaited<ReturnType<typeof initializeNativeDatabase>> | null = null;
    try {
      const snapshot = await acquireAndroidPortableRepository(
        effects,
        repository.clone_url,
        async () => credential.access_token,
      );
      const head = await androidPortableHead(effects);
      database = await initializeNativeDatabase(
        ANDROID_DATABASE_PATH,
        snapshot.dataset_id,
      );
      await adoptCanonicalSnapshot(
        database,
        snapshot.tasks,
        snapshot.recurrences,
        head,
      );
      return `app-private://${ANDROID_REPOSITORY_ROOT}`;
    } catch (error) {
      try {
        await Filesystem.deleteFile({
          directory: Directory.Data,
          path: ANDROID_DATABASE_PATH,
        });
      } catch {
        // The database may not have been created yet.
      }
      await removeAndroidManagedCheckout(effects);
      throw error;
    } finally {
      if (database !== null) {
        await database.close();
      }
    }
  },
});

const reconnect = new GitHubReconnectController(
  deviceFlow,
  {
    on_connected: async () => {
      const runtime = await import("../runtime-native");
      await runtime.triggerSync();
    },
  },
);

async function databaseExists(): Promise<boolean> {
  try {
    await Filesystem.stat({
      directory: Directory.Data,
      path: ANDROID_DATABASE_PATH,
    });
    return true;
  } catch (error) {
    if (
      error !== null &&
      typeof error === "object" &&
      "code" in error &&
      (
        error.code === "OS-PLUG-FILE-0008" ||
        error.code === "OS-PLUG-FILE-0011"
      )
    ) {
      return false;
    }
    throw error;
  }
}

export async function readAndroidSetupStatus(): Promise<{
  readonly mode: "bootstrap" | "configured";
  readonly local_repository_available: false;
  readonly github_available: true;
}> {
  return {
    mode: (await databaseExists())
      ? "configured"
      : "bootstrap",
    local_repository_available: false,
    github_available: true,
  };
}

export async function readAndroidGitHubCapabilityStatus():
Promise<GitHubCapabilityStatus> {
  const configured = await databaseExists();
  return {
    onboarding_available: !configured &&
      onboarding.snapshot().available,
    reconnect_available: configured &&
      reconnect.available() &&
      await androidManagedGitHubReconnectRequired(),
  };
}

export async function connectAndroidGitHubSetup():
Promise<GitHubOnboardingSnapshot> {
  return onboarding.start();
}

export function readAndroidGitHubSetupSnapshot():
GitHubOnboardingSnapshot {
  return onboarding.snapshot();
}

export async function selectAndroidGitHubRepository(
  repositoryId: number,
): Promise<GitHubOnboardingSnapshot> {
  return onboarding.selectRepository(repositoryId);
}

export async function retryAndroidGitHubSetup():
Promise<GitHubOnboardingSnapshot> {
  return onboarding.retry();
}

export function resumeAndroidGitHubSetup(): void {
  onboarding.resume();
}

export async function reconnectAndroidGitHub():
Promise<GitHubReconnectSnapshot> {
  return reconnect.snapshot().state === "attention"
    ? reconnect.retry()
    : reconnect.start();
}

export function readAndroidGitHubReconnectSnapshot():
GitHubReconnectSnapshot {
  return reconnect.snapshot();
}

export function resumeAndroidGitHubReconnect(): void {
  reconnect.resume();
}
