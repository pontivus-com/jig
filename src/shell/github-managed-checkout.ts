import {
  chmod,
  mkdir,
  mkdtemp,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join, relative, resolve, sep } from "node:path";
import {
  discoverSynchronizationRemote,
  runGit,
} from "./git";
import {
  normalizedGitHubRepository,
  validateSelectedRepository,
  InstallationError,
} from "./setup";

export interface GitHubRepositorySelection {
  readonly id: number;
  readonly owner: string;
  readonly name: string;
}

export interface GitHubCloneCredential {
  readonly access_token: string;
}

function validateGitHubSegment(value: string, field: string): string {
  if (
    value.length === 0 ||
    value === "." ||
    value === ".." ||
    !/^[A-Za-z0-9_.-]+$/.test(value)
  ) {
    throw new InstallationError(`Invalid GitHub ${field}`);
  }
  return value;
}

export function managedGitHubRepositoryPath(
  repository: GitHubRepositorySelection,
  home = homedir(),
): string {
  const owner = validateGitHubSegment(repository.owner, "owner");
  const name = validateGitHubSegment(repository.name, "repository name");
  return resolve(
    home,
    ".local",
    "share",
    "jig-data",
    "repositories",
    "github",
    owner,
    name,
  );
}

function selectedRepositorySlug(
  repository: GitHubRepositorySelection,
): string {
  return `${repository.owner}/${repository.name}`.toLowerCase();
}

async function repositoryMatchesSelection(
  repositoryPath: string,
  selection: GitHubRepositorySelection,
): Promise<boolean> {
  const remotes = await runGit(repositoryPath, ["remote"]);
  if (remotes.exit_code !== 0) {
    return false;
  }
  for (const remote of remotes.stdout.split("\n").filter(Boolean)) {
    const urls = await runGit(repositoryPath, [
      "remote",
      "get-url",
      "--all",
      remote,
    ]);
    if (urls.exit_code !== 0) {
      continue;
    }
    if (
      urls.stdout
        .split("\n")
        .some(
          (url) =>
            normalizedGitHubRepository(url) ===
            selectedRepositorySlug(selection),
        )
    ) {
      return true;
    }
  }
  return false;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function writeAskpassHelper(root: string): Promise<string> {
  const helper = join(root, "jig-github-askpass.sh");
  await writeFile(
    helper,
    [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      'case "${1:-}" in',
      '  "Username for \'https://github.com\':"|"Username for \'https://github.com/"*) printf "%s\\n" "x-access-token" ;;',
      '  "Password for \'https://x-access-token@github.com\':"|"Password for \'https://x-access-token@github.com/"*) printf "%s\\n" "${JIG_GITHUB_ACCESS_TOKEN:?}" ;;',
      '  *) exit 1 ;;',
      "esac",
      "",
    ].join("\n"),
    { encoding: "utf8", mode: 0o700 },
  );
  await chmod(helper, 0o700);
  return helper;
}

export interface GitHubAskpassHelper {
  readonly path: string;
  readonly dispose: () => Promise<void>;
}

export async function createGitHubAskpassHelper(): Promise<GitHubAskpassHelper> {
  const root = await mkdtemp(join(tmpdir(), "jig-github-askpass-"));
  const path = await writeAskpassHelper(root);
  return {
    path,
    dispose: () => rm(root, { recursive: true, force: true }),
  };
}

function managedGitHubSelectionFromPath(
  repositoryPath: string,
  home = homedir(),
): GitHubRepositorySelection | null {
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
      id: 1,
      owner: validateGitHubSegment(segments[0] ?? "", "owner"),
      name: validateGitHubSegment(segments[1] ?? "", "repository name"),
    };
  } catch {
    return null;
  }
}

export async function assertManagedGitHubSynchronizationRemote(
  repositoryPath: string,
  home = homedir(),
): Promise<void> {
  const selection = managedGitHubSelectionFromPath(repositoryPath, home);
  if (selection === null) {
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
  const expected = selectedRepositorySlug(selection);
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

export function githubGitEnvironment(
  helperPath: string,
  accessToken: string,
): Readonly<Record<string, string>> {
  if (helperPath.length === 0 || accessToken.length === 0) {
    throw new InstallationError("Invalid GitHub Git authentication input");
  }
  return {
    GIT_ASKPASS: helperPath,
    GIT_TERMINAL_PROMPT: "0",
    JIG_GITHUB_ACCESS_TOKEN: accessToken,
  };
}

export function isManagedGitHubRepositoryPath(
  repositoryPath: string,
  home = homedir(),
): boolean {
  return managedGitHubSelectionFromPath(repositoryPath, home) !== null;
}

export async function acquireManagedGitHubRepository(
  selection: GitHubRepositorySelection,
  credential: GitHubCloneCredential,
  home = homedir(),
): Promise<string> {
  validateGitHubSegment(selection.owner, "owner");
  validateGitHubSegment(selection.name, "repository name");
  if (
    !Number.isInteger(selection.id) ||
    selection.id <= 0 ||
    credential.access_token.length === 0
  ) {
    throw new InstallationError("Invalid GitHub repository acquisition input");
  }

  const finalPath = managedGitHubRepositoryPath(selection, home);
  if (await pathExists(finalPath)) {
    const existing = await validateSelectedRepository(finalPath);
    if (!(await repositoryMatchesSelection(existing, selection))) {
      throw new InstallationError(
        "Existing managed checkout does not match the selected GitHub repository",
      );
    }
    return existing;
  }

  const ownerDirectory = resolve(finalPath, "..");
  await mkdir(ownerDirectory, { recursive: true, mode: 0o700 });
  const tempPath = await mkdtemp(
    join(ownerDirectory, `.${selection.name}.clone-`),
  );
  const askpass = await createGitHubAskpassHelper();

  try {
    const cloneUrl =
      `https://github.com/${selection.owner}/${selection.name}.git`;
    const cloned = await runGit(
      ownerDirectory,
      ["clone", "--", cloneUrl, tempPath],
      undefined,
      {
        ...githubGitEnvironment(askpass.path, credential.access_token),
      },
    );
    if (cloned.exit_code !== 0) {
      throw new InstallationError(
        cloned.stderr || cloned.stdout || "GitHub clone failed",
      );
    }

    const validated = await validateSelectedRepository(tempPath);
    if (!(await repositoryMatchesSelection(validated, selection))) {
      throw new InstallationError(
        "Cloned repository remote does not match the selected GitHub repository",
      );
    }

    if (await pathExists(finalPath)) {
      throw new InstallationError(
        "Managed checkout destination appeared during clone; refusing to overwrite it",
      );
    }
    await rename(tempPath, finalPath);
    return await validateSelectedRepository(finalPath);
  } finally {
    await rm(tempPath, { recursive: true, force: true });
    await askpass.dispose();
  }
}
