import {
  access,
  mkdir,
  realpath,
  stat,
} from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import {
  ensureJigLocalExclude,
  ensurePortableData,
  GitAdapterError,
  inspectPortableCandidate,
  runGit,
  serializeSnapshot,
  writePortableSnapshot,
  type GitAdapterConfig,
} from "./git";
import {
  adoptCanonicalSnapshot,
  initializeDatabase,
  openDatabase,
  readCanonicalState,
  readMetadata,
} from "./sqlite";
import {
  writeConfigAtomic,
  type JigConfig,
} from "./config";
import { acquireWriterLease } from "./writer";

export interface RepositoryInstallation {
  readonly config: JigConfig;
  readonly dataset_id: string;
  readonly sqlite_path: string;
  readonly adopted_existing_snapshot: boolean;
}

export class InstallationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InstallationError";
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function git(
  repositoryPath: string,
  args: readonly string[],
): Promise<string> {
  const result = await runGit(repositoryPath, args);
  if (result.exit_code !== 0) {
    throw new InstallationError(
      result.stderr || result.stdout || `git ${args[0] ?? "command"} failed`,
    );
  }
  return result.stdout;
}

function normalizedGitHubRepository(value: string): string | null {
  const trimmed = value.trim().replace(/\.git$/, "");
  const patterns = [
    /^https?:\/\/github\.com\/([^/]+\/[^/]+)$/i,
    /^ssh:\/\/git@github\.com\/([^/]+\/[^/]+)$/i,
    /^git@github\.com:([^/]+\/[^/]+)$/i,
    /^git:\/\/github\.com\/([^/]+\/[^/]+)$/i,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(trimmed);
    if (match?.[1] !== undefined) {
      return match[1].toLowerCase();
    }
  }
  return null;
}

export async function validateSelectedRepository(
  repositoryPath: string,
): Promise<string> {
  if (!isAbsolute(repositoryPath)) {
    throw new InstallationError("Selected repository path must be absolute");
  }

  let canonicalPath: string;
  try {
    canonicalPath = await realpath(repositoryPath);
    await access(canonicalPath, fsConstants.R_OK | fsConstants.W_OK);
  } catch (error) {
    throw new InstallationError(
      `Selected repository is not accessible and writable: ${String(error)}`,
    );
  }

  const topLevel = await git(canonicalPath, [
    "rev-parse",
    "--show-toplevel",
  ]);
  const canonicalTopLevel = await realpath(topLevel);
  if (canonicalTopLevel !== canonicalPath) {
    throw new InstallationError(
      "Selected path must be the root of the Git worktree",
    );
  }

  const remotes = await git(canonicalPath, ["remote"]);
  for (const remoteName of remotes.split("\n").filter(Boolean)) {
    const urls = await git(canonicalPath, [
      "remote",
      "get-url",
      "--all",
      remoteName,
    ]);
    for (const url of urls.split("\n").filter(Boolean)) {
      if (normalizedGitHubRepository(url) === "pontivus-com/jig") {
        throw new InstallationError(
          "The public pontivus-com/jig source checkout cannot be used as the planning-data repository",
        );
      }
    }
  }

  return canonicalPath;
}

function snapshotsEqual(
  left: ReadonlyMap<string, string>,
  right: ReadonlyMap<string, string>,
): boolean {
  if (left.size !== right.size) {
    return false;
  }
  for (const [path, content] of left) {
    if (right.get(path) !== content) {
      return false;
    }
  }
  return true;
}

export async function initializeRepositoryInstallation(options: {
  readonly repository_path: string;
  readonly http_port: number;
  readonly config_path?: string;
}): Promise<RepositoryInstallation> {
  const repositoryPath = await validateSelectedRepository(
    options.repository_path,
  );
  if (
    !Number.isInteger(options.http_port) ||
    options.http_port < 1024 ||
    options.http_port > 65535
  ) {
    throw new InstallationError(
      "HTTP port must be an integer from 1024 through 65535",
    );
  }

  await ensureJigLocalExclude(repositoryPath);
  await mkdir(resolve(repositoryPath, ".jig", "local"), {
    recursive: true,
  });
  const writerLease = await acquireWriterLease(repositoryPath);

  try {
  const adapter: GitAdapterConfig = {
    repository_path: repositoryPath,
  };

  let candidate;
  try {
    candidate = await inspectPortableCandidate(adapter);
  } catch (error) {
    throw new InstallationError(
      `Unable to validate existing Jig snapshot: ${String(error)}`,
    );
  }

  const sqlitePath = resolve(
    repositoryPath,
    ".jig",
    "local",
    "jig.sqlite",
  );
  const databaseExists = await exists(sqlitePath);

  let datasetId: string;
  if (databaseExists) {
    const existing = openDatabase(sqlitePath);
    try {
      datasetId = readMetadata(existing).dataset_id;
      if (
        candidate !== null &&
        candidate.snapshot.dataset_id !== datasetId
      ) {
        throw new InstallationError(
          "Existing SQLite dataset identity does not match the repository snapshot",
        );
      }

      if (candidate !== null) {
        const state = readCanonicalState(existing);
        const expected = serializeSnapshot(state.tasks, datasetId);
        if (
          !snapshotsEqual(expected.files, candidate.snapshot.files) &&
          !readMetadata(existing).pending_sync
        ) {
          throw new InstallationError(
            "Existing local planning data differs from the repository snapshot without a pending local export; refusing implicit replacement",
          );
        }
      }
    } finally {
      existing.close();
    }
  } else {
    datasetId = candidate?.snapshot.dataset_id ?? crypto.randomUUID();
  }

  try {
    await ensurePortableData(adapter, datasetId);
  } catch (error) {
    if (error instanceof GitAdapterError) {
      throw new InstallationError(error.message);
    }
    throw error;
  }

  const db = initializeDatabase(sqlitePath, datasetId);
  let adoptedExistingSnapshot = false;
  try {
    if (!databaseExists && candidate !== null) {
      adoptCanonicalSnapshot(
        db,
        candidate.snapshot.tasks,
        candidate.head,
      );
      adoptedExistingSnapshot = true;
    }

    const state = readCanonicalState(db);
    const snapshot = serializeSnapshot(state.tasks, datasetId);
    await writePortableSnapshot(
      adapter,
      snapshot,
      state.revision,
    );

    const config: JigConfig = {
      version: 1,
      repository_path: repositoryPath,
      http_port: options.http_port,
    };
    await writeConfigAtomic(config, options.config_path);

    return {
      config,
      dataset_id: datasetId,
      sqlite_path: sqlitePath,
      adopted_existing_snapshot: adoptedExistingSnapshot,
    };
  } finally {
    db.close();
  }
  } finally {
    await writerLease.release();
  }
}

interface SetupCliOptions {
  readonly repositoryPath: string;
  readonly port: number;
  readonly configPath?: string;
}

function parseCli(argv: readonly string[]): SetupCliOptions {
  let repositoryPath: string | null = null;
  let port = 47831;
  let configPath: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === "--repo" && next !== undefined) {
      repositoryPath = next;
      index += 1;
    } else if (arg === "--port" && next !== undefined) {
      port = Number(next);
      index += 1;
    } else if (arg === "--config" && next !== undefined) {
      configPath = next;
      index += 1;
    } else {
      throw new InstallationError(`Unknown or incomplete setup option ${arg ?? ""}`);
    }
  }

  if (repositoryPath === null) {
    throw new InstallationError("--repo is required");
  }

  return {
    repositoryPath,
    port,
    ...(configPath === undefined ? {} : { configPath }),
  };
}

if (import.meta.main) {
  try {
    const cli = parseCli(process.argv.slice(2));
    const installed = await initializeRepositoryInstallation({
      repository_path: cli.repositoryPath,
      http_port: cli.port,
      ...(cli.configPath === undefined
        ? {}
        : { config_path: cli.configPath }),
    });
    process.stdout.write(
      `${JSON.stringify(installed, null, 2)}\n`,
    );
  } catch (error) {
    process.stderr.write(
      `Jig installation setup failed: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  }
}
