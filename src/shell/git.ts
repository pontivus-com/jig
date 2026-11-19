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
import type { GitLineage } from "../synchronization";
export {
  SnapshotValidationError,
  serializeSnapshot,
  validateSnapshot,
  type PortableSnapshot,
} from "../portable";

const DATA_REF = "refs/heads/jig-data";

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
      readonly fetch_location: string;
      readonly push_location: string;
    };

export interface PortableRemoteObservation {
  readonly authority: SynchronizationAuthority;
  readonly remote_state:
    | "none"
    | "ambiguous"
    | "absent"
    | "present";
  readonly local_head: string | null;
  readonly previous_remote_head: string | null;
  readonly remote_head: string | null;
  readonly remote_rewritten: boolean;
  readonly lineage: GitLineage;
  readonly remote_snapshot: PortableSnapshot | null;
  readonly base: PortableSnapshotCandidate | null;
}

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
  if (timeout !== null) {
    clearTimeout(timeout);
  }

  return {
    exit_code: exitCode,
    stdout: stdout.trim(),
    stderr: timedOut
      ? "Git operation timed out"
      : stderr.trim(),
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

function endpointIdentity(value: string): string {
  const trimmed = value.trim();
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "file:") {
      return `local:${parsed.pathname.replace(/\.git\/?$/i, "").replace(/\/$/, "")}`;
    }
    const path = parsed.pathname
      .replace(/^\/+/, "")
      .replace(/\.git\/?$/i, "")
      .replace(/\/$/, "");
    return `remote:${parsed.host.toLowerCase()}/${path}`;
  } catch {
    const scpLike =
      /^(?:[^@\s]+@)?([^:\s]+):(.+)$/.exec(trimmed);
    const host = scpLike?.[1];
    const path = scpLike?.[2];
    if (host !== undefined && path !== undefined) {
      return `remote:${host.toLowerCase()}/${path
        .replace(/^\/+/, "")
        .replace(/\.git\/?$/i, "")
        .replace(/\/$/, "")}`;
    }
    return `local:${trimmed
      .replace(/\.git\/?$/i, "")
      .replace(/\/$/, "")}`;
  }
}

async function selectedRemoteName(
  repositoryPath: string,
): Promise<
  | { readonly state: "none" }
  | { readonly state: "ambiguous" }
  | { readonly state: "selected"; readonly name: string }
> {
  const result = await runGit(repositoryPath, ["remote"]);
  if (result.exit_code !== 0) {
    throw new GitAdapterError(
      `Unable to inspect repository remotes: ${result.stderr || result.stdout}`,
    );
  }
  const remotes = result.stdout.split("\n").filter(Boolean);
  if (remotes.length === 0) {
    return { state: "none" };
  }

  const pushDefault = await runGit(repositoryPath, [
    "config",
    "--get",
    "remote.pushDefault",
  ]);
  if (
    pushDefault.exit_code === 0 &&
    remotes.includes(pushDefault.stdout)
  ) {
    return { state: "selected", name: pushDefault.stdout };
  }

  const branch = await runGit(repositoryPath, [
    "symbolic-ref",
    "--quiet",
    "--short",
    "HEAD",
  ]);
  if (branch.exit_code === 0 && branch.stdout.length > 0) {
    const branchRemote = await runGit(repositoryPath, [
      "config",
      "--get",
      `branch.${branch.stdout}.remote`,
    ]);
    if (
      branchRemote.exit_code === 0 &&
      remotes.includes(branchRemote.stdout)
    ) {
      return { state: "selected", name: branchRemote.stdout };
    }
  }

  return remotes.length === 1
    ? { state: "selected", name: remotes[0] ?? "" }
    : { state: "ambiguous" };
}

export async function inspectSynchronizationAuthority(
  config: GitAdapterConfig,
): Promise<SynchronizationAuthority> {
  assertAdapterPaths(config);
  const selected = await selectedRemoteName(config.repository_path);
  if (selected.state !== "selected") {
    return selected;
  }

  const fetchUrls = await runGit(config.repository_path, [
    "remote",
    "get-url",
    "--all",
    selected.name,
  ]);
  const pushUrls = await runGit(config.repository_path, [
    "remote",
    "get-url",
    "--push",
    "--all",
    selected.name,
  ]);
  if (fetchUrls.exit_code !== 0 || pushUrls.exit_code !== 0) {
    throw new GitAdapterError(
      `Unable to inspect synchronization remote ${selected.name}`,
    );
  }
  const fetchLocations = fetchUrls.stdout.split("\n").filter(Boolean);
  const pushLocations = pushUrls.stdout.split("\n").filter(Boolean);
  if (
    fetchLocations.length !== 1 ||
    pushLocations.length !== 1
  ) {
    return { state: "ambiguous" };
  }
  const fetchLocation = fetchLocations[0];
  const pushLocation = pushLocations[0];
  if (
    fetchLocation === undefined ||
    pushLocation === undefined ||
    endpointIdentity(fetchLocation) !== endpointIdentity(pushLocation)
  ) {
    return { state: "ambiguous" };
  }

  return {
    state: "selected",
    remote: {
      name: selected.name,
      location: sanitizeSynchronizationRemoteLocation(pushLocation),
    },
    fetch_location: fetchLocation,
    push_location: pushLocation,
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
  if (authority.state === "none") {
    return "local-only";
  }
  return authority.state === "selected"
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
  const treeResult = await runGit(repositoryPath, [
    "ls-tree",
    "-r",
    ref,
  ]);
  if (treeResult.exit_code !== 0) {
    throw new GitAdapterError(
      `Unable to enumerate candidate snapshot: ${treeResult.stderr}`,
    );
  }

  const files = new Map<string, string>();
  const lines = treeResult.stdout.split("\n").filter(Boolean);
  for (const line of lines) {
    const tab = line.indexOf("\t");
    if (tab < 0) {
      throw new GitAdapterError(
        "Candidate snapshot tree entry is malformed",
      );
    }
    const metadata = line.slice(0, tab).split(" ");
    const mode = metadata[0];
    const type = metadata[1];
    const path = line.slice(tab + 1);
    const allowed =
      path === "format.json" ||
      /^tasks\/[0-9a-f-]+\.json$/i.test(path) ||
      /^recurrences\/[0-9a-f-]+\.json$/i.test(path);
    if (!allowed || mode !== "100644" || type !== "blob") {
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

async function refHead(
  repositoryPath: string,
  ref: string,
): Promise<string | null> {
  const result = await runGit(repositoryPath, [
    "show-ref",
    "--verify",
    "--hash",
    ref,
  ]);
  return result.exit_code === 0 && result.stdout.length > 0
    ? result.stdout
    : null;
}

async function isAncestor(
  repositoryPath: string,
  ancestor: string,
  descendant: string,
): Promise<boolean | null> {
  const result = await runGit(repositoryPath, [
    "merge-base",
    "--is-ancestor",
    ancestor,
    descendant,
  ]);
  if (result.exit_code === 0) {
    return true;
  }
  if (result.exit_code === 1) {
    return false;
  }
  return null;
}

async function commonBase(
  repositoryPath: string,
  left: string,
  right: string,
): Promise<string | null> {
  const result = await runGit(repositoryPath, [
    "merge-base",
    left,
    right,
  ]);
  return result.exit_code === 0 && result.stdout.length > 0
    ? result.stdout.split("\n")[0] ?? null
    : null;
}

function zeroOid(): string {
  return "0".repeat(40);
}

async function updateTrackingRef(
  repositoryPath: string,
  ref: string,
  next: string,
  previous: string | null,
): Promise<void> {
  const result = await runGit(repositoryPath, [
    "update-ref",
    ref,
    next,
    previous ?? zeroOid(),
  ]);
  if (result.exit_code !== 0) {
    throw new GitAdapterError(
      "Synchronization observation changed concurrently; retry required",
    );
  }
}

export async function observePortableRemote(
  config: GitAdapterConfig,
  expectedDatasetId: string,
  networkEnvironment: Readonly<Record<string, string>> = {},
): Promise<PortableRemoteObservation> {
  assertAdapterPaths(config);
  const authority = await inspectSynchronizationAuthority(config);
  const localHead = await refHead(config.repository_path, DATA_REF);

  if (authority.state === "none") {
    return {
      authority,
      remote_state: "none",
      local_head: localHead,
      previous_remote_head: null,
      remote_head: null,
      remote_rewritten: false,
      lineage: "unknown",
      remote_snapshot: null,
      base: null,
    };
  }
  if (authority.state === "ambiguous") {
    return {
      authority,
      remote_state: "ambiguous",
      local_head: localHead,
      previous_remote_head: null,
      remote_head: null,
      remote_rewritten: false,
      lineage: "unknown",
      remote_snapshot: null,
      base: null,
    };
  }

  const observedRef =
    `refs/jig/observed/${authority.remote.name}/jig-data`;
  const legacyTrackingRef =
    `refs/remotes/${authority.remote.name}/jig-data`;
  const observedRefHead = await refHead(
    config.repository_path,
    observedRef,
  );
  const previousRemoteHead =
    observedRefHead ??
    (await refHead(config.repository_path, legacyTrackingRef));
  const advertised = await runGit(
    config.repository_path,
    [
      "ls-remote",
      "--heads",
      authority.remote.name,
      "refs/heads/jig-data",
    ],
    undefined,
    networkEnvironment,
    60_000,
  );
  if (advertised.exit_code !== 0) {
    throw new GitAdapterError(
      advertised.stderr || "Unable to observe remote jig-data head",
    );
  }
  if (advertised.stdout.length === 0) {
    return {
      authority,
      remote_state: "absent",
      local_head: localHead,
      previous_remote_head: previousRemoteHead,
      remote_head: null,
      remote_rewritten: false,
      lineage: "unknown",
      remote_snapshot: null,
      base: null,
    };
  }

  const remoteHead = advertised.stdout.split(/\s+/, 1)[0];
  if (remoteHead === undefined || remoteHead.length === 0) {
    throw new GitAdapterError("Remote jig-data advertisement is malformed");
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
    networkEnvironment,
    60_000,
  );
  if (fetched.exit_code !== 0) {
    throw new GitAdapterError(
      fetched.stderr || "Unable to fetch remote jig-data",
    );
  }

  const remoteSnapshot = await readSnapshotAtRef(
    config.repository_path,
    remoteHead,
  );

  let remoteRewritten = false;
  if (
    previousRemoteHead !== null &&
    previousRemoteHead !== remoteHead
  ) {
    const advances = await isAncestor(
      config.repository_path,
      previousRemoteHead,
      remoteHead,
    );
    remoteRewritten = advances !== true;
  }

  let lineage: GitLineage = "unknown";
  let base: PortableSnapshotCandidate | null = null;
  if (localHead !== null) {
    if (localHead === remoteHead) {
      lineage = "equal";
      base = {
        head: localHead,
        snapshot: await readSnapshotAtRef(
          config.repository_path,
          localHead,
          expectedDatasetId,
        ),
      };
    } else {
      const localToRemote = await isAncestor(
        config.repository_path,
        localHead,
        remoteHead,
      );
      const remoteToLocal = await isAncestor(
        config.repository_path,
        remoteHead,
        localHead,
      );
      if (localToRemote === true) {
        lineage = "remote-ahead";
        base = {
          head: localHead,
          snapshot: await readSnapshotAtRef(
            config.repository_path,
            localHead,
            expectedDatasetId,
          ),
        };
      } else if (remoteToLocal === true) {
        lineage = "local-ahead";
        base = {
          head: remoteHead,
          snapshot: remoteSnapshot,
        };
      } else if (
        localToRemote === false &&
        remoteToLocal === false
      ) {
        lineage = "diverged";
        const mergeBase = await commonBase(
          config.repository_path,
          localHead,
          remoteHead,
        );
        if (mergeBase !== null) {
          base = {
            head: mergeBase,
            snapshot: await readSnapshotAtRef(
              config.repository_path,
              mergeBase,
              expectedDatasetId,
            ),
          };
        }
      }
    }
  }

  if (!remoteRewritten) {
    await updateTrackingRef(
      config.repository_path,
      observedRef,
      remoteHead,
      observedRefHead,
    );
  }

  return {
    authority,
    remote_state: "present",
    local_head: localHead,
    previous_remote_head: previousRemoteHead,
    remote_head: remoteHead,
    remote_rewritten: remoteRewritten,
    lineage,
    remote_snapshot: remoteSnapshot,
    base,
  };
}

export async function acknowledgePortableRemoteHead(
  config: GitAdapterConfig,
  head: string,
): Promise<void> {
  const authority = await inspectSynchronizationAuthority(config);
  if (authority.state !== "selected") {
    throw new GitAdapterError(
      "Cannot acknowledge a remote head without one synchronization destination",
    );
  }
  const observedRef =
    `refs/jig/observed/${authority.remote.name}/jig-data`;
  const current = await refHead(
    config.repository_path,
    observedRef,
  );
  await updateTrackingRef(
    config.repository_path,
    observedRef,
    head,
    current,
  );
}

export async function alignPortableDataRef(
  config: GitAdapterConfig,
  expectedHead: string,
  targetHead: string,
): Promise<void> {
  const moved = await runGit(config.repository_path, [
    "update-ref",
    DATA_REF,
    targetHead,
    expectedHead,
  ]);
  if (moved.exit_code !== 0) {
    throw new GitAdapterError(
      "Local jig-data ref changed concurrently; retry required",
    );
  }
  const refreshed = await runGit(jigWorktreePath(config), [
    "reset",
    "--hard",
    "HEAD",
  ]);
  if (refreshed.exit_code !== 0) {
    throw new GitAdapterError(
      "Unable to refresh the private Jig worktree",
    );
  }
}

export async function pushPortableDataRef(
  config: GitAdapterConfig,
  expectedRemote: SynchronizationRemote,
  networkEnvironment: Readonly<Record<string, string>> = {},
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
    networkEnvironment,
    60_000,
  );
  return {
    status:
      result.exit_code === 0
        ? "synchronized"
        : "sync-issue",
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