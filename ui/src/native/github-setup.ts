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
} from "./git";
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
  storeAndroidGitHubCredential,
} from "./secure-credentials";

const githubFetch = createAndroidGitHubFetch();

const deviceFlow = new GitHubDeviceFlowSession({
  registration: GITHUB_APP_REGISTRATION,
  assert_credential_store: assertAndroidCredentialStore,
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
    const snapshot = await acquireAndroidPortableRepository(
      effects,
      repository.clone_url,
      async () => credential.access_token,
    );
    const head = await androidPortableHead(effects);
    const database = await initializeNativeDatabase(
      ANDROID_DATABASE_PATH,
      snapshot.dataset_id,
    );
    try {
      await adoptCanonicalSnapshot(
        database,
        snapshot.tasks,
        snapshot.recurrences,
        head,
      );
    } finally {
      await database.close();
    }
    return `app-private://${ANDROID_REPOSITORY_ROOT}`;
  },
});

const reconnect = new GitHubReconnectController(
  deviceFlow,
);

async function databaseExists(): Promise<boolean> {
  try {
    await Filesystem.stat({
      directory: Directory.Data,
      path: ANDROID_DATABASE_PATH,
    });
    return true;
  } catch {
    return false;
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
      reconnect.available(),
  };
}

export async function startAndroidGitHubSetup():
Promise<GitHubOnboardingSnapshot> {
  return onboarding.start();
}

export async function refreshAndroidGitHubSetup():
Promise<GitHubOnboardingSnapshot> {
  return onboarding.refreshAccess();
}

export function readAndroidGitHubSetupSnapshot():
GitHubOnboardingSnapshot {
  return onboarding.snapshot();
}

export async function acquireAndroidGitHubRepository(
  repositoryId: number,
): Promise<string> {
  return onboarding.acquire(repositoryId);
}

export async function startAndroidGitHubReconnect():
Promise<GitHubReconnectSnapshot> {
  return reconnect.start();
}

export async function refreshAndroidGitHubReconnect():
Promise<GitHubReconnectSnapshot> {
  return reconnect.refresh();
}
