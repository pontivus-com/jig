import {
  mkdir,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import {
  assertUuid,
  type Task,
  validateTask,
} from "../core/task";
import {
  validateRecurrenceSeries,
  type RecurrencePattern,
  type RecurrenceSeries,
} from "../core/recurrence";
import { assertRecurrenceState } from "../core/recurrence-planning";
import { PORTABLE_FORMAT_VERSION } from "../persistence/sqlite";

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

export interface PortableSnapshot {
  readonly dataset_id: string;
  readonly files: ReadonlyMap<string, string>;
  readonly tasks: readonly Task[];
  readonly recurrences: readonly RecurrenceSeries[];
}

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

export class SnapshotValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SnapshotValidationError";
  }
}

export class GitAdapterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GitAdapterError";
  }
}

function canonicalTaskRecord(task: Task): Record<string, unknown> {
  return {
    completed_at: task.completed_at,
    context: task.context,
    created_at: task.created_at,
    id: task.id,
    note: task.note,
    position: task.position,
    priority: task.priority,
    reference: task.reference,
    reminder_time: task.reminder_time,
    recurrence_occurrence_date: task.recurrence_occurrence_date,
    recurrence_series_id: task.recurrence_series_id,
    scheduled_date: task.scheduled_date,
    title: task.title,
    updated_at: task.updated_at,
  };
}

function canonicalRecurrenceRecord(
  series: RecurrenceSeries,
): Record<string, unknown> {
  return {
    created_at: series.created_at,
    effective_from: series.effective_from,
    end_date: series.end_date,
    id: series.id,
    pattern: series.pattern,
    updated_at: series.updated_at,
  };
}

function stableJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function serializeSnapshot(
  tasks: readonly Task[],
  datasetId: string,
  recurrences: readonly RecurrenceSeries[] = [],
): PortableSnapshot {
  assertUuid(datasetId, "dataset_id");
  assertRecurrenceState(tasks, recurrences);

  const files = new Map<string, string>();
  files.set(
    "format.json",
    stableJson({
      dataset_id: datasetId,
      version: PORTABLE_FORMAT_VERSION,
    }),
  );

  for (const task of [...tasks].sort((left, right) =>
    left.id.localeCompare(right.id),
  )) {
    files.set(
      `tasks/${task.id}.json`,
      stableJson(canonicalTaskRecord(task)),
    );
  }

  for (const series of [...recurrences].sort((left, right) =>
    left.id.localeCompare(right.id),
  )) {
    files.set(
      `recurrences/${series.id}.json`,
      stableJson(canonicalRecurrenceRecord(series)),
    );
  }

  return {
    dataset_id: datasetId,
    files,
    tasks: [...tasks],
    recurrences: [...recurrences],
  };
}

function isUnknownRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function parseJsonObject(
  content: string,
  path: string,
): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new SnapshotValidationError(`${path} is not valid JSON`);
  }

  if (!isUnknownRecord(parsed)) {
    throw new SnapshotValidationError(
      `${path} must contain a JSON object`,
    );
  }
  return parsed;
}

function exactKeys(
  object: Record<string, unknown>,
  keys: readonly string[],
  path: string,
  meaning: string,
): void {
  const actualKeys = Object.keys(object).sort();
  const expectedKeys = [...keys].sort();
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key, index) => key !== expectedKeys[index])
  ) {
    throw new SnapshotValidationError(
      `${path} does not contain exactly the canonical ${meaning} fields`,
    );
  }
}

function parseTaskRecord(
  content: string,
  path: string,
  expectedId: string,
  version: 1 | 2,
): Task {
  const raw = parseJsonObject(content, path);
  const v1Keys = [
    "completed_at",
    "context",
    "created_at",
    "id",
    "note",
    "position",
    "priority",
    "reference",
    "reminder_time",
    "scheduled_date",
    "title",
    "updated_at",
  ] as const;
  const v2Keys = [
    ...v1Keys,
    "recurrence_occurrence_date",
    "recurrence_series_id",
  ] as const;
  exactKeys(raw, version === 1 ? v1Keys : v2Keys, path, "Task");

  const object =
    version === 1
      ? {
          ...raw,
          recurrence_series_id: null,
          recurrence_occurrence_date: null,
        }
      : raw;
  const task = validateTask(object);
  if (task.id !== expectedId) {
    throw new SnapshotValidationError(
      `${path} id does not match its filename`,
    );
  }
  return task;
}

function parseRecurrencePattern(
  value: unknown,
  path: string,
): RecurrencePattern {
  if (!isUnknownRecord(value)) {
    throw new SnapshotValidationError(
      `${path} pattern must be an object`,
    );
  }
  if (value.kind === "weekly") {
    exactKeys(
      value,
      ["kind", "interval_weeks", "weekdays"],
      `${path}.pattern`,
      "weekly recurrence pattern",
    );
    if (
      typeof value.interval_weeks !== "number" ||
      !Array.isArray(value.weekdays) ||
      !value.weekdays.every((weekday) => typeof weekday === "string")
    ) {
      throw new SnapshotValidationError(
        `${path} weekly recurrence pattern is invalid`,
      );
    }
    const weekdays = value.weekdays.filter(
      (weekday) =>
        weekday === "MON" ||
        weekday === "TUE" ||
        weekday === "WED" ||
        weekday === "THU" ||
        weekday === "FRI" ||
        weekday === "SAT" ||
        weekday === "SUN",
    );
    if (weekdays.length !== value.weekdays.length) {
      throw new SnapshotValidationError(
        `${path} weekly recurrence weekday is invalid`,
      );
    }
    return {
      kind: "weekly",
      interval_weeks: value.interval_weeks,
      weekdays,
    };
  }
  if (value.kind === "monthly") {
    exactKeys(
      value,
      ["kind", "day_of_month"],
      `${path}.pattern`,
      "monthly recurrence pattern",
    );
    if (typeof value.day_of_month !== "number") {
      throw new SnapshotValidationError(
        `${path} monthly recurrence pattern is invalid`,
      );
    }
    return {
      kind: "monthly",
      day_of_month: value.day_of_month,
    };
  }
  throw new SnapshotValidationError(
    `${path} recurrence pattern kind is invalid`,
  );
}

function requirePortableString(
  object: Record<string, unknown>,
  key: string,
  path: string,
): string {
  const value = object[key];
  if (typeof value !== "string") {
    throw new SnapshotValidationError(
      `${path} ${key} must be a string`,
    );
  }
  return value;
}

function parseRecurrenceRecord(
  content: string,
  path: string,
  expectedId: string,
): RecurrenceSeries {
  const object = parseJsonObject(content, path);
  exactKeys(
    object,
    [
      "created_at",
      "effective_from",
      "end_date",
      "id",
      "pattern",
      "updated_at",
    ],
    path,
    "RecurrenceSeries",
  );
  const series = validateRecurrenceSeries({
    id: requirePortableString(object, "id", path),
    effective_from: requirePortableString(
      object,
      "effective_from",
      path,
    ),
    end_date: requirePortableString(object, "end_date", path),
    pattern: parseRecurrencePattern(object.pattern, path),
    created_at: requirePortableString(object, "created_at", path),
    updated_at: requirePortableString(object, "updated_at", path),
  });
  if (series.id !== expectedId) {
    throw new SnapshotValidationError(
      `${path} id does not match its filename`,
    );
  }
  return series;
}

export function validateSnapshot(
  files: ReadonlyMap<string, string>,
  expectedDatasetId?: string,
): PortableSnapshot {
  const formatContent = files.get("format.json");
  if (formatContent === undefined) {
    throw new SnapshotValidationError("format.json is missing");
  }

  const format = parseJsonObject(formatContent, "format.json");
  const version =
    format.version === 1 || format.version === 2
      ? format.version
      : null;
  if (
    version === null ||
    typeof format.dataset_id !== "string"
  ) {
    throw new SnapshotValidationError(
      "format.json has an unsupported format version or dataset identity",
    );
  }
  assertUuid(format.dataset_id, "dataset_id");

  if (
    expectedDatasetId !== undefined &&
    format.dataset_id !== expectedDatasetId
  ) {
    throw new SnapshotValidationError(
      "Snapshot dataset identity does not match the configured dataset",
    );
  }

  const tasks: Task[] = [];
  const recurrences: RecurrenceSeries[] = [];
  const taskIds = new Set<string>();
  const recurrenceIds = new Set<string>();

  for (const [path, content] of files) {
    if (path === "format.json") {
      continue;
    }

    const taskMatch = /^tasks\/([0-9a-f-]+)\.json$/i.exec(path);
    if (taskMatch !== null && taskMatch[1] !== undefined) {
      const task = parseTaskRecord(
        content,
        path,
        taskMatch[1],
        version,
      );
      if (taskIds.has(task.id)) {
        throw new SnapshotValidationError(
          `Duplicate Task id ${task.id} in snapshot`,
        );
      }
      taskIds.add(task.id);
      tasks.push(task);
      continue;
    }

    const recurrenceMatch =
      /^recurrences\/([0-9a-f-]+)\.json$/i.exec(path);
    if (
      version === 2 &&
      recurrenceMatch !== null &&
      recurrenceMatch[1] !== undefined
    ) {
      const series = parseRecurrenceRecord(
        content,
        path,
        recurrenceMatch[1],
      );
      if (recurrenceIds.has(series.id)) {
        throw new SnapshotValidationError(
          `Duplicate recurrence series id ${series.id} in snapshot`,
        );
      }
      recurrenceIds.add(series.id);
      recurrences.push(series);
      continue;
    }

    throw new SnapshotValidationError(
      `Unexpected portable snapshot path ${path}`,
    );
  }

  assertRecurrenceState(tasks, recurrences);
  return {
    dataset_id: format.dataset_id,
    files: new Map(files),
    tasks,
    recurrences,
  };
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
): Promise<GitCommandResult> {
  const processHandle = Bun.spawn({
    cmd: ["git", ...args],
    cwd,
    stdin: input === undefined ? "ignore" : new Blob([input]),
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, ...extraEnv },
  });

  const [exitCode, stdout, stderr] = await Promise.all([
    processHandle.exited,
    new Response(processHandle.stdout).text(),
    new Response(processHandle.stderr).text(),
  ]);

  return {
    exit_code: exitCode,
    stdout: stdout.trim(),
    stderr: stderr.trim(),
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

export async function discoverSynchronizationRemote(
  repositoryPath: string,
): Promise<string | null> {
  const result = await runGit(repositoryPath, ["remote"]);
  if (result.exit_code !== 0) {
    throw new GitAdapterError(
      `Unable to inspect repository remotes: ${result.stderr || result.stdout}`,
    );
  }
  const remotes = result.stdout.split("\n").filter(Boolean);
  if (remotes.length === 0) {
    return null;
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
    return pushDefault.stdout;
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
      return branchRemote.stdout;
    }
  }

  return remotes.length === 1 ? remotes[0] ?? null : null;
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
  const remoteName = await discoverSynchronizationRemote(
    config.repository_path,
  );
  if (remoteName === null) {
    return null;
  }

  const urls = await runGit(config.repository_path, [
    "remote",
    "get-url",
    "--push",
    "--all",
    remoteName,
  ]);
  if (urls.exit_code !== 0) {
    throw new GitAdapterError(
      `Unable to inspect synchronization remote ${remoteName}: ${urls.stderr || urls.stdout}`,
    );
  }
  const pushUrl = urls.stdout.split("\n").find((value) => value.length > 0);
  if (pushUrl === undefined) {
    throw new GitAdapterError(
      `Synchronization remote ${remoteName} has no push target`,
    );
  }

  return {
    name: remoteName,
    location: sanitizeSynchronizationRemoteLocation(pushUrl),
  };
}

export async function repositorySynchronizationMode(
  config: GitAdapterConfig,
): Promise<"local-only" | "remote"> {
  return (await discoverSynchronizationRemote(config.repository_path)) === null
    ? "local-only"
    : "remote";
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
  const namesResult = await runGit(repositoryPath, [
    "ls-tree",
    "-r",
    "--name-only",
    ref,
  ]);
  if (namesResult.exit_code !== 0) {
    throw new GitAdapterError(
      `Unable to enumerate candidate snapshot: ${namesResult.stderr}`,
    );
  }

  const files = new Map<string, string>();
  const names = namesResult.stdout
    .split("\n")
    .filter(
      (name) =>
        name === "format.json" ||
        /^tasks\/.+\.json$/.test(name) ||
        /^recurrences\/.+\.json$/.test(name),
    );

  for (const path of names) {
    const content = await requireGit(repositoryPath, [
      "show",
      `${ref}:${path}`,
    ]);
    files.set(path, `${content}\n`);
  }

  return validateSnapshot(files, expectedDatasetId);
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