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
import { assertTaskSet } from "../core/planning";
import {
  DATA_REF,
  PORTABLE_FORMAT_VERSION,
  type RepositoryStatus,
} from "./sqlite";

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
}

export interface GitAdapterConfig {
  readonly repository_path: string;
  readonly worktree_path: string;
  readonly remote_name: string | null;
}

export interface GitCommandResult {
  readonly exit_code: number;
  readonly stdout: string;
  readonly stderr: string;
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
    scheduled_date: task.scheduled_date,
    title: task.title,
    updated_at: task.updated_at,
  };
}

function stableJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function serializeSnapshot(
  tasks: readonly Task[],
  datasetId: string,
): PortableSnapshot {
  assertUuid(datasetId, "dataset_id");
  assertTaskSet(tasks);

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

  return {
    dataset_id: datasetId,
    files,
    tasks: [...tasks],
  };
}

function parseJsonObject(content: string, path: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new SnapshotValidationError(`${path} is not valid JSON`);
  }

  if (
    parsed === null ||
    typeof parsed !== "object" ||
    Array.isArray(parsed)
  ) {
    throw new SnapshotValidationError(`${path} must contain a JSON object`);
  }
  return parsed as Record<string, unknown>;
}

function parseTaskRecord(
  content: string,
  path: string,
  expectedId: string,
): Task {
  const object = parseJsonObject(content, path);
  const keys = [
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
  ];
  const actualKeys = Object.keys(object).sort();
  if (
    actualKeys.length !== keys.length ||
    actualKeys.some((key, index) => key !== keys[index])
  ) {
    throw new SnapshotValidationError(
      `${path} does not contain exactly the canonical Task fields`,
    );
  }

  const task = object as unknown as Task;
  validateTask(task);
  if (task.id !== expectedId) {
    throw new SnapshotValidationError(
      `${path} id does not match its filename`,
    );
  }
  return task;
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
  if (
    format.version !== PORTABLE_FORMAT_VERSION ||
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
  const ids = new Set<string>();
  for (const [path, content] of files) {
    if (path === "format.json") {
      continue;
    }

    const match = /^tasks\/([0-9a-f-]+)\.json$/i.exec(path);
    if (match === null || match[1] === undefined) {
      throw new SnapshotValidationError(
        `Unexpected portable snapshot path ${path}`,
      );
    }

    const task = parseTaskRecord(content, path, match[1]);
    if (ids.has(task.id)) {
      throw new SnapshotValidationError(
        `Duplicate Task id ${task.id} in snapshot`,
      );
    }
    ids.add(task.id);
    tasks.push(task);
  }

  assertTaskSet(tasks);
  return {
    dataset_id: format.dataset_id,
    files: new Map(files),
    tasks,
  };
}

function assertAdapterPaths(config: GitAdapterConfig): void {
  if (!isAbsolute(config.repository_path) || !isAbsolute(config.worktree_path)) {
    throw new GitAdapterError("Repository and Jig worktree paths must be absolute");
  }

  const expected = resolve(config.repository_path, ".jig", "git");
  if (resolve(config.worktree_path) !== expected) {
    throw new GitAdapterError(
      "Jig linked worktree must be <repository>/.jig/git",
    );
  }

  const relation = relative(config.repository_path, config.worktree_path);
  if (relation.startsWith("..") || isAbsolute(relation)) {
    throw new GitAdapterError("Jig worktree escapes the configured repository");
  }
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


export async function ensureJigDataWorktree(
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
    const emptyTree = await requireGit(
      config.repository_path,
      ["mktree"],
      "",
    );
    const commit = await requireGit(
      config.repository_path,
      ["commit-tree", emptyTree, "-m", "Initialize Jig data"],
      undefined,
      {
        GIT_AUTHOR_NAME: "Jig",
        GIT_AUTHOR_EMAIL: "jig@local.invalid",
        GIT_COMMITTER_NAME: "Jig",
        GIT_COMMITTER_EMAIL: "jig@local.invalid",
      },
    );
    await requireGit(config.repository_path, [
      "update-ref",
      DATA_REF,
      commit,
    ]);
  } else if (expectedDatasetId !== undefined) {
    try {
      await readSnapshotAtRef(
        config.repository_path,
        DATA_REF,
        expectedDatasetId,
      );
    } catch (error) {
      throw new GitAdapterError(
        `Existing jig-data ref is not a compatible Jig snapshot: ${String(error)}`,
      );
    }
  }

  const worktreeGit = resolve(config.worktree_path, ".git");
  try {
    await readFile(worktreeGit, "utf8");
    await requireGit(config.worktree_path, [
      "rev-parse",
      "--verify",
      "HEAD",
    ]);
    const checkedOutRef = await requireGit(config.worktree_path, [
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
      const entries = await readdir(config.worktree_path);
      if (entries.length > 0) {
        throw new GitAdapterError(
          "Refusing to replace a non-empty existing Jig worktree path",
        );
      }
      await rm(config.worktree_path, { recursive: true, force: true });
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
    config.worktree_path,
    DATA_REF.replace("refs/heads/", ""),
  ]);
}

export async function writeSnapshotToWorktree(
  worktreePath: string,
  snapshot: PortableSnapshot,
): Promise<void> {
  const tasksPath = resolve(worktreePath, "tasks");
  await mkdir(tasksPath, { recursive: true });

  const expectedFiles = new Set(
    [...snapshot.files.keys()].filter((path) => path.startsWith("tasks/")),
  );
  for (const entry of await readdir(tasksPath, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) {
      continue;
    }
    const relativePath = `tasks/${entry.name}`;
    if (!expectedFiles.has(relativePath)) {
      await rm(resolve(tasksPath, entry.name));
    }
  }

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

export async function commitSnapshot(
  config: GitAdapterConfig,
  snapshot: PortableSnapshot,
  revision: number,
): Promise<string> {
  assertAdapterPaths(config);
  await writeSnapshotToWorktree(config.worktree_path, snapshot);
  await requireGit(config.worktree_path, [
    "add",
    "-A",
    "--",
    "format.json",
    "tasks",
  ]);

  const status = await requireGit(config.worktree_path, [
    "status",
    "--porcelain",
    "--",
    "format.json",
    "tasks",
  ]);

  if (status.length !== 0) {
    await requireGit(
      config.worktree_path,
      [
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

  return requireGit(config.worktree_path, ["rev-parse", "HEAD"]);
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
    .filter((name) => name === "format.json" || /^tasks\/.+\.json$/.test(name));

  for (const path of names) {
    const content = await requireGit(repositoryPath, [
      "show",
      `${ref}:${path}`,
    ]);
    files.set(path, `${content}\n`);
  }

  return validateSnapshot(files, expectedDatasetId);
}

export async function fetchRemoteCandidate(
  config: GitAdapterConfig,
  expectedDatasetId: string,
): Promise<{ readonly head: string; readonly snapshot: PortableSnapshot } | null> {
  assertAdapterPaths(config);
  if (config.remote_name === null) {
    return null;
  }

  const trackingRef = `refs/remotes/${config.remote_name}/jig-data`;
  const fetchResult = await runGit(config.repository_path, [
    "fetch",
    "--no-tags",
    config.remote_name,
    `refs/heads/jig-data:${trackingRef}`,
  ]);

  if (fetchResult.exit_code !== 0) {
    throw new GitAdapterError(
      `Repository synchronization failed: ${fetchResult.stderr || fetchResult.stdout}`,
    );
  }

  const head = await requireGit(config.repository_path, [
    "rev-parse",
    trackingRef,
  ]);
  const snapshot = await readSnapshotAtRef(
    config.repository_path,
    trackingRef,
    expectedDatasetId,
  );
  return { head, snapshot };
}

export async function pushJigDataRef(
  config: GitAdapterConfig,
): Promise<RepositoryStatus> {
  assertAdapterPaths(config);
  if (config.remote_name === null) {
    return "local-only";
  }

  const result = await runGit(config.repository_path, [
    "push",
    config.remote_name,
    `${DATA_REF}:refs/heads/jig-data`,
  ]);

  return result.exit_code === 0 ? "synchronized" : "sync-issue";
}

export function retryDelayMs(failureCount: number): number {
  if (!Number.isInteger(failureCount) || failureCount < 1) {
    throw new GitAdapterError("failureCount must be a positive integer");
  }
  const index = Math.min(failureCount - 1, SYNC_RETRY_SECONDS.length - 1);
  return (SYNC_RETRY_SECONDS[index] ?? 300) * 1000;
}