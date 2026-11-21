import {
  mkdir,
  mkdtemp,
  rename,
  rm,
  stat,
} from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { runGit } from "./git";
import {
  createGitHubAskpassHelper,
  githubGitEnvironment,
} from "./github-git-auth";
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
  repository: Pick<GitHubRepositorySelection, "owner" | "name">,
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
