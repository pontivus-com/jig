import { homedir } from "node:os";
import { relative, resolve, sep } from "node:path";
import type {
  GitHubAppRegistration,
  GitHubCredential,
} from "../github";
import {
  GitHubAuthError,
  refreshGitHubCredential,
} from "../github-auth";
import {
  createGitHubAskpassHelper,
  githubGitEnvironment,
  type GitHubAskpassHelper,
} from "./github-git-auth";
import {
  discoverSynchronizationRemote,
  runGit,
  synchronizePortableData,
  type GitAdapterConfig,
  type RepositorySynchronizationResult,
} from "./git";
import {
  loadCurrentGitHubCredential,
  SecretServiceError,
  storeGitHubCredential,
} from "./secret-service";
import {
  InstallationError,
  normalizedGitHubRepository,
} from "./setup";

interface ManagedGitHubRepositoryIdentity {
  readonly owner: string;
  readonly name: string;
}

export interface ManagedGitHubTransportDependencies {
  readonly registration: GitHubAppRegistration;
  readonly load_credential?: () => Promise<GitHubCredential | null>;
  readonly store_credential?: (credential: GitHubCredential) => Promise<void>;
  readonly refresh_credential?: typeof refreshGitHubCredential;
  readonly synchronize?: typeof synchronizePortableData;
  readonly now?: () => Date;
}

export interface ManagedGitHubTransport {
  readonly synchronize: (
    config: GitAdapterConfig,
  ) => Promise<RepositorySynchronizationResult>;
  readonly reconnect_required: () => Promise<boolean>;
  readonly dispose: () => Promise<void>;
}

function validateSegment(value: string): string {
  if (
    value.length === 0 ||
    value === "." ||
    value === ".." ||
    !/^[A-Za-z0-9_.-]+$/.test(value)
  ) {
    throw new InstallationError("Invalid managed GitHub repository path");
  }
  return value;
}

function managedGitHubIdentity(
  repositoryPath: string,
  home = homedir(),
): ManagedGitHubRepositoryIdentity | null {
  const root = resolve(
    home,
    ".local",
    "share",
    "jig-data",
    "repositories",
    "github",
  );
  const absolute = resolve(repositoryPath);
  const relation = relative(root, absolute);
  if (
    relation.length === 0 ||
    relation.startsWith("..") ||
    resolve(root, relation) !== absolute
  ) {
    return null;
  }
  const segments = relation.split(sep);
  if (segments.length !== 2) {
    return null;
  }
  try {
    return {
      owner: validateSegment(segments[0] ?? ""),
      name: validateSegment(segments[1] ?? ""),
    };
  } catch {
    return null;
  }
}

export function isManagedGitHubRepositoryPath(
  repositoryPath: string,
  home = homedir(),
): boolean {
  return managedGitHubIdentity(repositoryPath, home) !== null;
}

export async function assertManagedGitHubSynchronizationRemote(
  repositoryPath: string,
  home = homedir(),
): Promise<void> {
  const identity = managedGitHubIdentity(repositoryPath, home);
  if (identity === null) {
    throw new InstallationError(
      "Repository is not a Jig-managed GitHub checkout",
    );
  }

  const remoteName = await discoverSynchronizationRemote(repositoryPath);
  if (remoteName === null) {
    throw new InstallationError(
      "Managed GitHub checkout has no unambiguous synchronization remote",
    );
  }
  const urls = await runGit(repositoryPath, [
    "remote",
    "get-url",
    "--push",
    "--all",
    remoteName,
  ]);
  if (urls.exit_code !== 0 || urls.stdout.length === 0) {
    throw new InstallationError(
      "Unable to inspect managed GitHub synchronization remote",
    );
  }

  const expected = `${identity.owner}/${identity.name}`.toLowerCase();
  const pushUrls = urls.stdout.split("\n").filter(Boolean);
  if (
    pushUrls.length === 0 ||
    pushUrls.some(
      (url) =>
        !/^https:\/\/github\.com\//i.test(url) ||
        normalizedGitHubRepository(url) !== expected,
    )
  ) {
    throw new InstallationError(
      "Managed GitHub checkout synchronization remote no longer matches its selected repository",
    );
  }
}

function nonRetryableIssue(): RepositorySynchronizationResult {
  return { status: "sync-issue", retryable: false };
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

function credentialNeedsReconnect(
  credential: GitHubCredential,
  now: Date,
): boolean {
  if (credential.access_token_expires_at === null) {
    return false;
  }
  const accessExpiry = Date.parse(credential.access_token_expires_at);
  if (!Number.isFinite(accessExpiry)) {
    return true;
  }
  if (accessExpiry - now.getTime() > 5 * 60 * 1000) {
    return false;
  }
  if (credential.refresh_token === null) {
    return true;
  }
  if (credential.refresh_token_expires_at === null) {
    return false;
  }
  const refreshExpiry = Date.parse(credential.refresh_token_expires_at);
  return !Number.isFinite(refreshExpiry) || refreshExpiry <= now.getTime();
}

export async function createManagedGitHubTransport(
  repositoryPath: string,
  dependencies: ManagedGitHubTransportDependencies,
  home = homedir(),
): Promise<ManagedGitHubTransport | null> {
  if (!isManagedGitHubRepositoryPath(repositoryPath, home)) {
    return null;
  }

  const askpass: GitHubAskpassHelper =
    await createGitHubAskpassHelper();
  let reconnectRequired = false;
  const loadCredential =
    dependencies.load_credential ??
    loadCurrentGitHubCredential;
  const now = dependencies.now ?? (() => new Date());

  return {
    synchronize: async (
      config: GitAdapterConfig,
    ): Promise<RepositorySynchronizationResult> => {
      try {
        await assertManagedGitHubSynchronizationRemote(
          config.repository_path,
          home,
        );

        let credential = await loadCredential();
        if (credential === null) {
          reconnectRequired = true;
          return nonRetryableIssue();
        }

        const currentTime = now();
        if (credentialNeedsReconnect(credential, currentTime)) {
          reconnectRequired = true;
          return nonRetryableIssue();
        }

        if (
          credential.access_token_expires_at !== null &&
          Date.parse(credential.access_token_expires_at) -
            currentTime.getTime() <=
            5 * 60 * 1000
        ) {
          try {
            credential = await (
              dependencies.refresh_credential ??
              refreshGitHubCredential
            )(
              dependencies.registration,
              credential,
              currentTime,
            );
            await (
              dependencies.store_credential ??
              storeGitHubCredential
            )(credential);
            reconnectRequired = false;
          } catch (error) {
            if (refreshAuthorizationFailed(error)) {
              reconnectRequired = true;
              return nonRetryableIssue();
            }
            throw error;
          }
        }

        const result = await (
          dependencies.synchronize ??
          synchronizePortableData
        )(
          config,
          githubGitEnvironment(
            askpass.path,
            credential.access_token,
          ),
        );
        if (result.status === "synchronized") {
          reconnectRequired = false;
        }
        return result;
      } catch (error) {
        if (refreshAuthorizationFailed(error)) {
          reconnectRequired = true;
          return nonRetryableIssue();
        }
        if (
          error instanceof GitHubAuthError ||
          error instanceof SecretServiceError ||
          error instanceof InstallationError
        ) {
          return nonRetryableIssue();
        }
        throw error;
      }
    },
    reconnect_required: async (): Promise<boolean> => {
      if (reconnectRequired) {
        return true;
      }
      try {
        const credential = await loadCredential();
        return credential === null ||
          credentialNeedsReconnect(credential, now());
      } catch {
        return false;
      }
    },
    dispose: askpass.dispose,
  };
}
