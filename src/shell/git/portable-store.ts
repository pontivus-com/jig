import {
  mkdir,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import {
  serializeSnapshot,
  validateSnapshot,
  type PortableSnapshot,
} from "../../core/portable";
import { GitAdapterError, requireGit, runGit } from "./process";
import {
  assertAdapterPaths,
  jigWorktreePath,
  type GitAdapterConfig,
} from "./repository";

export const DATA_REF = "refs/heads/jig-data";

export interface PortableSnapshotCandidate {
  readonly head: string;
  readonly snapshot: PortableSnapshot;
}

export async function readCurrentPortableSnapshot(
  config: GitAdapterConfig,
  expectedDatasetId?: string,
): Promise<PortableSnapshotCandidate | null> {
  assertAdapterPaths(config);
  const head = await runGit(config.repository_path, [
    "show-ref",
    "--verify",
    "--hash",
    DATA_REF,
  ]);
  if (head.exit_code !== 0 || head.stdout.length === 0) {
    return null;
  }
  return {
    head: head.stdout,
    snapshot: await readSnapshotAtRef(
      config.repository_path,
      DATA_REF,
      expectedDatasetId,
    ),
  };
}


async function createInitialSnapshotRef(
  repositoryPath: string,
  datasetId: string,
  parentHead?: string,
): Promise<void> {
  const snapshot = serializeSnapshot([], datasetId);
  const formatJson = snapshot.files.get("format.json");
  if (formatJson === undefined) {
    throw new GitAdapterError("Initial Jig snapshot is missing format.json");
  }

  const blob = await requireGit(
    repositoryPath,
    ["hash-object", "-w", "--stdin"],
    formatJson,
  );
  const tree = await requireGit(
    repositoryPath,
    ["mktree"],
    `100644 blob ${blob}\tformat.json\n`,
  );
  const commitArgs = [
    "-c",
    "commit.gpgSign=false",
    "commit-tree",
    tree,
    ...(parentHead === undefined ? [] : ["-p", parentHead]),
    "-m",
    "Initialize Jig data",
  ];
  const commit = await requireGit(
    repositoryPath,
    commitArgs,
    undefined,
    {
      GIT_AUTHOR_NAME: "Jig",
      GIT_AUTHOR_EMAIL: "jig@local.invalid",
      GIT_COMMITTER_NAME: "Jig",
      GIT_COMMITTER_EMAIL: "jig@local.invalid",
    },
  );
  await requireGit(
    repositoryPath,
    [
      "update-ref",
      DATA_REF,
      commit,
      ...(parentHead === undefined ? [] : [parentHead]),
    ],
  );
}


export async function isLegacyEmptyBootstrap(
  repositoryPath: string,
): Promise<string | null> {
  const head = await runGit(repositoryPath, ["rev-parse", DATA_REF]);
  if (head.exit_code !== 0 || head.stdout.length === 0) {
    return null;
  }
  const names = await runGit(repositoryPath, [
    "ls-tree",
    "-r",
    "--name-only",
    DATA_REF,
  ]);
  if (names.exit_code !== 0 || names.stdout.length !== 0) {
    return null;
  }
  const subject = await runGit(repositoryPath, [
    "log",
    "-1",
    "--format=%s",
    DATA_REF,
  ]);
  return subject.exit_code === 0 && subject.stdout === "Initialize Jig data"
    ? head.stdout
    : null;
}

async function ensureJigDataWorktree(
  config: GitAdapterConfig,
  expectedDatasetId?: string,
): Promise<void> {
  assertAdapterPaths(config);
  await requireGit(config.repository_path, ["rev-parse", "--git-dir"]);
  await mkdir(resolve(config.repository_path, ".jig"), { recursive: true });

  const hasRef = await runGit(config.repository_path, [
    "show-ref",
    "--verify",
    "--quiet",
    DATA_REF,
  ]);
  const createdRef = hasRef.exit_code !== 0;

  if (createdRef) {
    if (expectedDatasetId === undefined) {
      throw new GitAdapterError(
        "A dataset id is required to initialize Jig portable data",
      );
    }
    await createInitialSnapshotRef(
      config.repository_path,
      expectedDatasetId,
    );
  } else if (expectedDatasetId !== undefined) {
    try {
      await readSnapshotAtRef(
        config.repository_path,
        DATA_REF,
        expectedDatasetId,
      );
    } catch (error) {
      const legacyHead = await isLegacyEmptyBootstrap(
        config.repository_path,
      );
      if (legacyHead === null) {
        throw new GitAdapterError(
          `Existing jig-data ref is not a compatible Jig snapshot: ${String(error)}`,
        );
      }
      await createInitialSnapshotRef(
        config.repository_path,
        expectedDatasetId,
        legacyHead,
      );
    }
  }

  const worktreeGit = resolve(jigWorktreePath(config), ".git");
  try {
    await readFile(worktreeGit, "utf8");
    await requireGit(jigWorktreePath(config), [
      "rev-parse",
      "--verify",
      "HEAD",
    ]);
    const checkedOutRef = await requireGit(jigWorktreePath(config), [
      "symbolic-ref",
      "-q",
      "HEAD",
    ]);
    if (checkedOutRef !== DATA_REF) {
      throw new GitAdapterError(
        `Existing Jig worktree is attached to ${checkedOutRef || "detached HEAD"}, expected ${DATA_REF}`,
      );
    }
    return;
  } catch {
    try {
      const entries = await readdir(jigWorktreePath(config));
      if (entries.length > 0) {
        throw new GitAdapterError(
          "Refusing to replace a non-empty existing Jig worktree path",
        );
      }
      await rm(jigWorktreePath(config), { recursive: true, force: true });
    } catch (error) {
      if (error instanceof GitAdapterError) {
        throw error;
      }
      // A missing worktree path is the expected first-install case.
    }
  }

  await requireGit(config.repository_path, [
    "worktree",
    "add",
    jigWorktreePath(config),
    DATA_REF.replace("refs/heads/", ""),
  ]);
}

async function removeStaleSnapshotFiles(
  worktreePath: string,
  directory: "tasks" | "recurrences",
  snapshot: PortableSnapshot,
): Promise<void> {
  const directoryPath = resolve(worktreePath, directory);
  await mkdir(directoryPath, { recursive: true });
  const expectedFiles = new Set(
    [...snapshot.files.keys()].filter((path) =>
      path.startsWith(`${directory}/`),
    ),
  );
  for (const entry of await readdir(directoryPath, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) {
      continue;
    }
    const relativePath = `${directory}/${entry.name}`;
    if (!expectedFiles.has(relativePath)) {
      await rm(resolve(directoryPath, entry.name));
    }
  }
}

export async function writeSnapshotToWorktree(
  worktreePath: string,
  snapshot: PortableSnapshot,
): Promise<void> {
  await removeStaleSnapshotFiles(worktreePath, "tasks", snapshot);
  await removeStaleSnapshotFiles(
    worktreePath,
    "recurrences",
    snapshot,
  );

  for (const [path, content] of snapshot.files) {
    const absolute = resolve(worktreePath, path);
    const relation = relative(worktreePath, absolute);
    if (relation.startsWith("..") || isAbsolute(relation)) {
      throw new GitAdapterError("Snapshot path escapes the Jig worktree");
    }
    await mkdir(resolve(absolute, ".."), { recursive: true });
    await writeFile(absolute, content, "utf8");
  }
}

async function commitSnapshot(
  config: GitAdapterConfig,
  snapshot: PortableSnapshot,
  revision: number,
): Promise<string> {
  assertAdapterPaths(config);
  await writeSnapshotToWorktree(jigWorktreePath(config), snapshot);
  await requireGit(jigWorktreePath(config), [
    "add",
    "-A",
    "--",
    "format.json",
    "tasks",
    "recurrences",
  ]);

  const staged = await requireGit(jigWorktreePath(config), [
    "diff",
    "--cached",
    "--name-only",
    "--diff-filter=ACDMRTUXB",
  ]);
  const stagedPaths = staged.split("\n").filter(Boolean);

  for (const path of stagedPaths) {
    if (
      path !== "format.json" &&
      !/^tasks\/[0-9a-f-]+\.json$/i.test(path) &&
      !/^recurrences\/[0-9a-f-]+\.json$/i.test(path)
    ) {
      throw new GitAdapterError(
        `Refusing to commit non-Jig staged path ${path}`,
      );
    }
  }

  if (stagedPaths.length !== 0) {
    await requireGit(
      jigWorktreePath(config),
      [
        "-c",
        "commit.gpgSign=false",
        "commit",
        "-m",
        `Jig snapshot revision ${revision}`,
      ],
      undefined,
      {
        GIT_AUTHOR_NAME: "Jig",
        GIT_AUTHOR_EMAIL: "jig@local.invalid",
        GIT_COMMITTER_NAME: "Jig",
        GIT_COMMITTER_EMAIL: "jig@local.invalid",
      },
    );
  }

  return requireGit(jigWorktreePath(config), ["rev-parse", "HEAD"]);
}

export async function readSnapshotAtRef(
  repositoryPath: string,
  ref: string,
  expectedDatasetId?: string,
): Promise<PortableSnapshot> {
  const tree = await runGit(repositoryPath, [
    "ls-tree",
    "-r",
    ref,
  ]);
  if (tree.exit_code !== 0) {
    throw new GitAdapterError(
      `Unable to enumerate candidate snapshot: ${tree.stderr}`,
    );
  }

  const files = new Map<string, string>();
  for (const line of tree.stdout.split("\n").filter(Boolean)) {
    const tab = line.indexOf("\t");
    if (tab < 0) {
      throw new GitAdapterError(
        "Refusing malformed jig-data tree entry",
      );
    }
    const metadata = line.slice(0, tab).split(" ");
    const path = line.slice(tab + 1);
    if (
      metadata[0] !== "100644" ||
      metadata[1] !== "blob" ||
      !(
        path === "format.json" ||
        /^tasks\/[0-9a-f-]+\.json$/i.test(path) ||
        /^recurrences\/[0-9a-f-]+\.json$/i.test(path)
      )
    ) {
      throw new GitAdapterError(
        `Refusing non-canonical jig-data tree entry ${path}`,
      );
    }
    const content = await requireGit(repositoryPath, [
      "show",
      `${ref}:${path}`,
    ]);
    files.set(path, `${content}\n`);
  }

  return validateSnapshot(files, expectedDatasetId);
}


async function localAncestor(
  repositoryPath: string,
  older: string,
  newer: string,
): Promise<boolean | null> {
  const result = await runGit(repositoryPath, [
    "merge-base",
    "--is-ancestor",
    older,
    newer,
  ]);
  return result.exit_code === 0
    ? true
    : result.exit_code === 1
      ? false
      : null;
}

export async function resetPortableDataWorktree(
  config: GitAdapterConfig,
): Promise<void> {
  assertAdapterPaths(config);
  await requireGit(jigWorktreePath(config), [
    "reset",
    "--hard",
    "HEAD",
  ]);
}


export async function alignPortableDataRef(
  config: GitAdapterConfig,
  expectedHead: string,
  targetHead: string,
): Promise<void> {
  if (
    expectedHead !== targetHead &&
    await localAncestor(
      config.repository_path,
      expectedHead,
      targetHead,
    ) !== true
  ) {
    throw new GitAdapterError(
      "Local jig-data alignment must be a fast-forward",
    );
  }

  const moved = await runGit(config.repository_path, [
    "update-ref",
    DATA_REF,
    targetHead,
    expectedHead,
  ]);
  if (moved.exit_code !== 0) {
    throw new GitAdapterError(
      "Local jig-data ref changed concurrently",
    );
  }
  await resetPortableDataWorktree(config);
}


export async function ensurePortableData(
  config: GitAdapterConfig,
  datasetId: string,
): Promise<void> {
  await ensureJigDataWorktree(config, datasetId);
}

export async function writePortableSnapshot(
  config: GitAdapterConfig,
  snapshot: PortableSnapshot,
  revision: number,
): Promise<string> {
  await ensureJigDataWorktree(config, snapshot.dataset_id);
  return commitSnapshot(config, snapshot, revision);
}

