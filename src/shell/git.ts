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
} from "../portable";
import type { SynchronizationLineage } from "../core/synchronization";
export {
  SnapshotValidationError,
  serializeSnapshot,
  validateSnapshot,
  type PortableSnapshot,
} from "../portable";

const DATA_REF = "refs/heads/jig-data";
const REMOTE_GIT_TIMEOUT_MS = 60_000;

export const SYNC_HEALTHY_POLL_MS = 60_000;
export const EXPORT_DEBOUNCE_MS = 3_000;
export const EXPORT_MAX_FLUSH_MS = 15_000;
export const SYNC_RETRY_SECONDS = [
  5,
  10,
  20,
  40,
  80,
  160,
  300,
] as const;


export interface GitAdapterConfig {
  readonly repository_path: string;
}

export interface PortableSnapshotCandidate {
  readonly head: string;
  readonly snapshot: PortableSnapshot;
}

export interface GitCommandResult {
  readonly exit_code: number;
  readonly stdout: string;
  readonly stderr: string;
}

export type RepositoryPushStatus =
  | "not-configured"
  | "synchronized"
  | "sync-issue";

export interface RepositorySynchronizationResult {
  readonly status: RepositoryPushStatus;
  readonly retryable: boolean;
}

export interface SynchronizationRemote {
  readonly name: string;
  readonly location: string;
}

export type SynchronizationAuthority =
  | { readonly state: "none" }
  | { readonly state: "ambiguous" }
  | {
      readonly state: "selected";
      readonly remote: SynchronizationRemote;
    };

export type PortableRemoteObservation =
  | {
      readonly state: "none";
      readonly local_head: string | null;
    }
  | {
      readonly state: "ambiguous";
      readonly local_head: string | null;
    }
  | {
      readonly state: "absent";
      readonly remote: SynchronizationRemote;
      readonly local_head: string | null;
      readonly previously_synchronized: boolean;
    }
  | {
      readonly state: "unsafe";
      readonly remote: SynchronizationRemote;
      readonly local_head: string | null;
    }
  | {
      readonly state: "present";
      readonly remote: SynchronizationRemote;
      readonly local_head: string | null;
      readonly remote_head: string;
      readonly remote_rewritten: boolean;
      readonly lineage: SynchronizationLineage;
      readonly remote_snapshot: PortableSnapshot;
    };

export class GitAdapterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GitAdapterError";
  }
}

function assertAdapterPaths(config: GitAdapterConfig): void {
  if (!isAbsolute(config.repository_path)) {
    throw new GitAdapterError("Repository path must be absolute");
  }
}

function jigWorktreePath(config: GitAdapterConfig): string {
  assertAdapterPaths(config);
  return resolve(config.repository_path, ".jig", "git");
}

export async function runGit(
  cwd: string,
  args: readonly string[],
  input?: string,
  extraEnv: Readonly<Record<string, string>> = {},
  timeoutMs?: number,
): Promise<GitCommandResult> {
  const processHandle = Bun.spawn({
    cmd: ["git", ...args],
    cwd,
    stdin: input === undefined ? "ignore" : new Blob([input]),
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, ...extraEnv },
  });
  let timedOut = false;
  const timeout =
    timeoutMs === undefined
      ? null
      : setTimeout(() => {
          timedOut = true;
          processHandle.kill("SIGKILL");
        }, timeoutMs);
  const [exitCode, stdout, stderr] = await Promise.all([
    processHandle.exited,
    new Response(processHandle.stdout).text(),
    new Response(processHandle.stderr).text(),
  ]);
  if (timeout !== null) clearTimeout(timeout);
  return {
    exit_code: exitCode,
    stdout: stdout.trim(),
    stderr: timedOut ? "Git operation timed out" : stderr.trim(),
  };
}

async function requireGit(
  cwd: string,
  args: readonly string[],
  input?: string,
  extraEnv: Readonly<Record<string, string>> = {},
): Promise<string> {
  const result = await runGit(cwd, args, input, extraEnv);
  if (result.exit_code !== 0) {
    throw new GitAdapterError(
      `git ${args[0] ?? "command"} failed: ${result.stderr || result.stdout}`,
    );
  }
  return result.stdout;
}

async function selectedRemoteName(
  repositoryPath: string,
): Promise<string | null | "ambiguous"> {
  const listed = await runGit(repositoryPath, ["remote"]);
  if (listed.exit_code !== 0) {
    throw new GitAdapterError(
      `Unable to inspect repository remotes: ${listed.stderr || listed.stdout}`,
    );
  }
  const remotes = listed.stdout.split("\n").filter(Boolean);
  if (remotes.length === 0) return null;

  const pushDefault = await runGit(repositoryPath, [
    "config",
    "--get",
    "remote.pushDefault",
  ]);
  if (
    pushDefault.exit_code === 0 &&
    remotes.includes(pushDefault.stdout)
  ) {
    return pushDefault.stdout;
  }

  const branch = await runGit(repositoryPath, [
    "symbolic-ref",
    "--quiet",
    "--short",
    "HEAD",
  ]);
  if (branch.exit_code === 0) {
    const branchRemote = await runGit(repositoryPath, [
      "config",
      "--get",
      `branch.${branch.stdout}.remote`,
    ]);
    if (
      branchRemote.exit_code === 0 &&
      remotes.includes(branchRemote.stdout)
    ) {
      return branchRemote.stdout;
    }
  }
  return remotes.length === 1
    ? remotes[0] ?? null
    : "ambiguous";
}

export async function inspectSynchronizationAuthority(
  config: GitAdapterConfig,
): Promise<SynchronizationAuthority> {
  assertAdapterPaths(config);
  const name = await selectedRemoteName(config.repository_path);
  if (name === null) {
    return { state: "none" };
  }
  if (name === "ambiguous") {
    return { state: "ambiguous" };
  }

  const push = await runGit(config.repository_path, [
    "remote",
    "get-url",
    "--push",
    "--all",
    name,
  ]);
  const pushUrls = push.stdout.split("\n").filter(Boolean);
  if (
    push.exit_code !== 0 ||
    pushUrls.length !== 1 ||
    pushUrls[0] === undefined
  ) {
    return { state: "ambiguous" };
  }

  return {
    state: "selected",
    remote: {
      name,
      location: sanitizeSynchronizationRemoteLocation(
        pushUrls[0],
      ),
    },
  };
}

export async function discoverSynchronizationRemote(
  repositoryPath: string,
): Promise<string | null> {
  const authority = await inspectSynchronizationAuthority({
    repository_path: repositoryPath,
  });
  return authority.state === "selected"
    ? authority.remote.name
    : null;
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

export async function inspectPortableCandidate(
  config: GitAdapterConfig,
): Promise<PortableSnapshotCandidate | null> {
  assertAdapterPaths(config);

  let local: PortableSnapshotCandidate | null;
  try {
    local = await readCurrentPortableSnapshot(config);
  } catch (error) {
    if ((await isLegacyEmptyBootstrap(config.repository_path)) === null) {
      throw error;
    }
    local = null;
  }
  if (local !== null) {
    return local;
  }

  const remoteName = await discoverSynchronizationRemote(
    config.repository_path,
  );
  if (remoteName === null) {
    return null;
  }

  const trackingRef = `refs/remotes/${remoteName}/jig-data`;
  const trackedHead = await runGit(config.repository_path, [
    "show-ref",
    "--verify",
    "--hash",
    trackingRef,
  ]);
  if (trackedHead.exit_code === 0 && trackedHead.stdout.length > 0) {
    const tracked = {
      head: trackedHead.stdout,
      snapshot: await readSnapshotAtRef(
        config.repository_path,
        trackingRef,
      ),
    };
    await requireGit(config.repository_path, [
      "update-ref",
      DATA_REF,
      tracked.head,
    ]);
    return tracked;
  }

  const advertised = await runGit(config.repository_path, [
    "ls-remote",
    "--exit-code",
    remoteName,
    "refs/heads/jig-data",
  ]);
  if (
    advertised.exit_code !== 0 ||
    advertised.stdout.length === 0
  ) {
    return null;
  }

  const fetched = await runGit(config.repository_path, [
    "fetch",
    "--no-tags",
    remoteName,
    `refs/heads/jig-data:${trackingRef}`,
  ]);
  if (fetched.exit_code !== 0) {
    return null;
  }

  const head = await requireGit(config.repository_path, [
    "rev-parse",
    trackingRef,
  ]);
  const remote = {
    head,
    snapshot: await readSnapshotAtRef(
      config.repository_path,
      trackingRef,
    ),
  };
  await requireGit(config.repository_path, [
    "update-ref",
    DATA_REF,
    remote.head,
  ]);
  return remote;
}

export function sanitizeSynchronizationRemoteLocation(
  value: string,
): string {
  const trimmed = value.trim();
  try {
    const parsed = new URL(trimmed);
    parsed.username = "";
    parsed.password = "";
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    const scpLike = /^(?:[^@\s]+@)?([^:\s]+):(.+)$/.exec(trimmed);
    const host = scpLike?.[1];
    const path = scpLike?.[2];
    if (host !== undefined && path !== undefined) {
      const cleanPath = path.split(/[?#]/, 1)[0] ?? "";
      return `${host}:${cleanPath}`;
    }
    return trimmed.split(/[?#]/, 1)[0] ?? trimmed;
  }
}

export async function inspectSynchronizationRemote(
  config: GitAdapterConfig,
): Promise<SynchronizationRemote | null> {
  const authority = await inspectSynchronizationAuthority(config);
  return authority.state === "selected"
    ? authority.remote
    : null;
}

export async function repositorySynchronizationMode(
  config: GitAdapterConfig,
): Promise<"local-only" | "remote" | "ambiguous"> {
  const authority = await inspectSynchronizationAuthority(config);
  return authority.state === "none"
    ? "local-only"
    : authority.state === "selected"
      ? "remote"
      : "ambiguous";
}

export async function repositoryCommonDir(
  repositoryPath: string,
): Promise<string> {
  const commonDir = await requireGit(repositoryPath, [
    "rev-parse",
    "--git-common-dir",
  ]);
  return isAbsolute(commonDir)
    ? resolve(commonDir)
    : resolve(repositoryPath, commonDir);
}

export async function ensureJigLocalExclude(
  repositoryPath: string,
): Promise<string> {
  const commonDir = await repositoryCommonDir(repositoryPath);
  const infoDir = resolve(commonDir, "info");
  const excludePath = resolve(infoDir, "exclude");
  await mkdir(infoDir, { recursive: true });

  let existing = "";
  try {
    existing = await readFile(excludePath, "utf8");
  } catch {
    // A repository may not have an info/exclude file yet.
  }

  const lines = existing.split(/\r?\n/);
  if (!lines.includes("/.jig/")) {
    const prefix =
      existing.length === 0 || existing.endsWith("\n") ? existing : `${existing}\n`;
    await writeFile(excludePath, `${prefix}/.jig/\n`, "utf8");
  }

  return excludePath;
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

async function isLegacyEmptyBootstrap(
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
  const tree = await runGit(repositoryPath, ["ls-tree", "-r", ref]);
  if (tree.exit_code !== 0) {
    throw new GitAdapterError(
      `Unable to enumerate candidate snapshot: ${tree.stderr}`,
    );
  }
  const files = new Map<string, string>();
  for (const line of tree.stdout.split("\n").filter(Boolean)) {
    const tab = line.indexOf("\t");
    const metadata = line.slice(0, tab).split(" ");
    const path = line.slice(tab + 1);
    if (
      tab < 0 ||
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
    files.set(
      path,
      `${await requireGit(repositoryPath, ["show", `${ref}:${path}`])}\n`,
    );
  }
  return validateSnapshot(files, expectedDatasetId);
}

async function refHead(
  repositoryPath: string,
  ref: string,
): Promise<string | null> {
  const result = await runGit(repositoryPath, [
    "show-ref", "--verify", "--hash", ref,
  ]);
  return result.exit_code === 0 && result.stdout.length > 0
    ? result.stdout
    : null;
}

async function ancestor(
  repositoryPath: string,
  older: string,
  newer: string,
): Promise<boolean | null> {
  const result = await runGit(repositoryPath, [
    "merge-base", "--is-ancestor", older, newer,
  ]);
  return result.exit_code === 0
    ? true
    : result.exit_code === 1
      ? false
      : null;
}

export async function observePortableRemote(
  config: GitAdapterConfig,
  expectedDatasetId: string,
  lastAdoptedHead: string | null,
  environment: Readonly<Record<string, string>> = {},
): Promise<PortableRemoteObservation> {
  const authority = await inspectSynchronizationAuthority(config);
  const localHead = await refHead(config.repository_path, DATA_REF);

  if (authority.state === "none") {
    return { state: "none", local_head: localHead };
  }
  if (authority.state === "ambiguous") {
    return { state: "ambiguous", local_head: localHead };
  }

  const advertised = await runGit(
    config.repository_path,
    [
      "ls-remote",
      "--heads",
      authority.remote.name,
      "refs/heads/jig-data",
    ],
    undefined,
    environment,
    REMOTE_GIT_TIMEOUT_MS,
  );
  if (advertised.exit_code !== 0) {
    throw new GitAdapterError(
      advertised.stderr || "Unable to observe remote jig-data",
    );
  }
  if (advertised.stdout.length === 0) {
    return {
      state: "absent",
      remote: authority.remote,
      local_head: localHead,
      previously_synchronized: lastAdoptedHead !== null,
    };
  }

  const remoteHead = advertised.stdout.split(/\s+/, 1)[0];
  if (remoteHead === undefined || remoteHead.length === 0) {
    throw new GitAdapterError(
      "Malformed remote jig-data advertisement",
    );
  }

  const fetched = await runGit(
    config.repository_path,
    [
      "fetch",
      "--no-tags",
      authority.remote.name,
      "refs/heads/jig-data",
    ],
    undefined,
    environment,
    REMOTE_GIT_TIMEOUT_MS,
  );
  if (fetched.exit_code !== 0) {
    throw new GitAdapterError(
      fetched.stderr || "Unable to fetch remote jig-data",
    );
  }

  let remoteSnapshot: PortableSnapshot;
  try {
    remoteSnapshot = await readSnapshotAtRef(
      config.repository_path,
      remoteHead,
      expectedDatasetId,
    );
  } catch {
    return {
      state: "unsafe",
      remote: authority.remote,
      local_head: localHead,
    };
  }

  const remoteRewritten =
    lastAdoptedHead !== null &&
    lastAdoptedHead !== remoteHead &&
    (await ancestor(
      config.repository_path,
      lastAdoptedHead,
      remoteHead,
    )) !== true;

  let lineage: SynchronizationLineage = "unknown";
  if (localHead !== null) {
    if (localHead === remoteHead) {
      lineage = "equal";
    } else {
      const remoteAhead = await ancestor(
        config.repository_path,
        localHead,
        remoteHead,
      );
      const localAhead = await ancestor(
        config.repository_path,
        remoteHead,
        localHead,
      );
      if (remoteAhead === true) {
        lineage = "remote-ahead";
      } else if (localAhead === true) {
        lineage = "local-ahead";
      } else if (
        remoteAhead === false &&
        localAhead === false
      ) {
        lineage = "diverged";
      }
    }
  }

  return {
    state: "present",
    remote: authority.remote,
    local_head: localHead,
    remote_head: remoteHead,
    remote_rewritten: remoteRewritten,
    lineage,
    remote_snapshot: remoteSnapshot,
  };
}

export async function alignPortableDataRef(
  config: GitAdapterConfig,
  expectedHead: string,
  targetHead: string,
): Promise<void> {
  if (
    expectedHead !== targetHead &&
    await ancestor(
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
  await requireGit(jigWorktreePath(config), [
    "reset",
    "--hard",
    "HEAD",
  ]);
}

export async function pushPortableDataRef(
  config: GitAdapterConfig,
  expectedRemote: SynchronizationRemote,
  environment: Readonly<Record<string, string>> = {},
): Promise<RepositorySynchronizationResult> {
  const authority = await inspectSynchronizationAuthority(config);
  if (
    authority.state !== "selected" ||
    authority.remote.name !== expectedRemote.name ||
    authority.remote.location !== expectedRemote.location
  ) {
    return { status: "sync-issue", retryable: false };
  }
  const result = await runGit(
    config.repository_path,
    [
      "push",
      authority.remote.name,
      `${DATA_REF}:refs/heads/jig-data`,
    ],
    undefined,
    environment,
    REMOTE_GIT_TIMEOUT_MS,
  );
  return {
    status: result.exit_code === 0 ? "synchronized" : "sync-issue",
    retryable: result.exit_code !== 0,
  };
}

async function pushJigDataRef(
  config: GitAdapterConfig,
  networkEnvironment: Readonly<Record<string, string>> = {},
): Promise<RepositoryPushStatus> {
  assertAdapterPaths(config);
  const remoteName = await discoverSynchronizationRemote(
    config.repository_path,
  );
  if (remoteName === null) {
    return "not-configured";
  }

  const result = await runGit(
    config.repository_path,
    [
      "push",
      remoteName,
      `${DATA_REF}:refs/heads/jig-data`,
    ],
    undefined,
    networkEnvironment,
  );

  return result.exit_code === 0 ? "synchronized" : "sync-issue";
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

export async function synchronizePortableData(
  config: GitAdapterConfig,
  networkEnvironment: Readonly<Record<string, string>> = {},
): Promise<RepositorySynchronizationResult> {
  const status = await pushJigDataRef(config, networkEnvironment);
  return {
    status,
    retryable: status === "sync-issue",
  };
}

export function retryDelayMs(failureCount: number): number {
  if (!Number.isInteger(failureCount) || failureCount < 1) {
    throw new GitAdapterError("failureCount must be a positive integer");
  }
  const index = Math.min(failureCount - 1, SYNC_RETRY_SECONDS.length - 1);
  return (SYNC_RETRY_SECONDS[index] ?? 300) * 1000;
}