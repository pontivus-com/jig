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

  return {
    synchronize: async (
      config: GitAdapterConfig,
    ): Promise<RepositorySynchronizationResult> => {
      try {
        await assertManagedGitHubSynchronizationRemote(
          config.repository_path,
          home,
        );

        let credential = await (
          dependencies.load_credential ??
          loadCurrentGitHubCredential
        )();
        if (credential === null) {
          return nonRetryableIssue();
        }

        if (credential.access_token_expires_at !== null) {
          const expiryMs = Date.parse(
            credential.access_token_expires_at,
          );
          if (!Number.isFinite(expiryMs)) {
            return nonRetryableIssue();
          }
          const now = (dependencies.now ?? (() => new Date()))();
          if (expiryMs - now.getTime() <= 5 * 60 * 1000) {
            credential = await (
              dependencies.refresh_credential ??
              refreshGitHubCredential
            )(
              dependencies.registration,
              credential,
              now,
            );
            await (
              dependencies.store_credential ??
              storeGitHubCredential
            )(credential);
          }
        }

        return (
          dependencies.synchronize ??
          synchronizePortableData
        )(
          config,
          githubGitEnvironment(
            askpass.path,
            credential.access_token,
          ),
        );
      } catch (error) {
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
    dispose: askpass.dispose,
  };
}
