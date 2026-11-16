import {
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute, resolve } from "node:path";
import type { Database } from "bun:sqlite";
import {
  commitSnapshot,
  ensureJigDataWorktree,
  EXPORT_DEBOUNCE_MS,
  EXPORT_MAX_FLUSH_MS,
  readSnapshotAtRef,
  retryDelayMs,
  runGit,
  serializeSnapshot,
  SYNC_HEALTHY_POLL_MS,
  type GitAdapterConfig,
  pushJigDataRef,
} from "./git";
import {
  DATA_REF,
  openDatabase,
  PORTABLE_FORMAT_VERSION,
  readCanonicalState,
  readMetadata,
  markExported,
  SQLITE_SCHEMA_VERSION,
  type RepositoryStatus,
} from "./sqlite";
import {
  createHttpHandler,
  type Diagnostics,
  type ServiceStatus,
} from "./http";

export interface JigConfig {
  readonly version: 1;
  readonly repository_path: string;
  readonly remote_name: string | null;
  readonly data_ref: typeof DATA_REF;
  readonly http_port: number;
}

export class RuntimeConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuntimeConfigurationError";
  }
}

export function defaultConfigPath(): string {
  return resolve(homedir(), ".config", "jig", "config.json");
}

export async function loadConfig(
  path = defaultConfigPath(),
): Promise<JigConfig> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    throw new RuntimeConfigurationError(
      `Unable to read Jig configuration at ${path}: ${String(error)}`,
    );
  }

  if (
    parsed === null ||
    typeof parsed !== "object" ||
    Array.isArray(parsed)
  ) {
    throw new RuntimeConfigurationError("Jig configuration must be an object");
  }

  const object = parsed as Record<string, unknown>;
  const expectedKeys = [
    "version",
    "repository_path",
    "remote_name",
    "data_ref",
    "http_port",
  ];
  const actualKeys = Object.keys(object).sort();
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key) => !expectedKeys.includes(key))
  ) {
    throw new RuntimeConfigurationError(
      "Jig configuration has missing or unknown keys",
    );
  }

  if (object.version !== 1) {
    throw new RuntimeConfigurationError("Unsupported Jig configuration version");
  }
  if (
    typeof object.repository_path !== "string" ||
    !isAbsolute(object.repository_path)
  ) {
    throw new RuntimeConfigurationError(
      "repository_path must be an absolute path",
    );
  }
  if (
    object.remote_name !== null &&
    (typeof object.remote_name !== "string" ||
      object.remote_name.trim().length === 0)
  ) {
    throw new RuntimeConfigurationError(
      "remote_name must be null or a nonblank Git remote name",
    );
  }
  if (object.data_ref !== DATA_REF) {
    throw new RuntimeConfigurationError(
      `data_ref must be exactly ${DATA_REF}`,
    );
  }
  if (
    typeof object.http_port !== "number" ||
    !Number.isInteger(object.http_port) ||
    object.http_port < 1024 ||
    object.http_port > 65535
  ) {
    throw new RuntimeConfigurationError(
      "http_port must be an integer from 1024 through 65535",
    );
  }

  return {
    version: 1,
    repository_path: object.repository_path,
    remote_name: object.remote_name,
    data_ref: DATA_REF,
    http_port: object.http_port,
  };
}

function writeToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

interface WriterLease {
  readonly path: string;
  readonly release: () => Promise<void>;
}

async function processIsAlive(pid: number): Promise<boolean> {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export async function acquireWriterLease(
  repositoryPath: string,
): Promise<WriterLease> {
  const localPath = resolve(repositoryPath, ".jig", "local");
  const leasePath = resolve(localPath, "writer.lock");
  await mkdir(localPath, { recursive: true });

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await mkdir(leasePath);
      await writeFile(
        resolve(leasePath, "pid"),
        `${process.pid}\n`,
        "utf8",
      );
      return {
        path: leasePath,
        release: async () => {
          await rm(leasePath, { recursive: true, force: true });
        },
      };
    } catch {
      let stale = false;
      try {
        const pid = Number(
          (await readFile(resolve(leasePath, "pid"), "utf8")).trim(),
        );
        stale = !Number.isInteger(pid) || !(await processIsAlive(pid));
      } catch {
        stale = true;
      }

      if (stale && attempt === 0) {
        await rm(leasePath, { recursive: true, force: true });
        continue;
      }

      throw new RuntimeConfigurationError(
        "Another Jig writer is already active for this data root",
      );
    }
  }

  throw new RuntimeConfigurationError(
    "Unable to acquire the Jig writer lease",
  );
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

interface SyncController {
  readonly start: () => Promise<void>;
  readonly stop: () => void;
  readonly notifyMutation: () => void;
  readonly trigger: () => Promise<RepositoryStatus>;
  readonly status: () => RepositoryStatus;
}

function createSyncController(
  db: Database,
  config: JigConfig,
): SyncController {
  const adapter: GitAdapterConfig = {
    repository_path: config.repository_path,
    worktree_path: resolve(config.repository_path, ".jig", "git"),
    remote_name: config.remote_name,
  };

  let currentStatus: RepositoryStatus =
    config.remote_name === null ? "local-only" : "pending";
  let running: Promise<RepositoryStatus> | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let firstDirtyAt: number | null = null;
  let failureCount = 0;
  let stopped = false;

  const clearTimer = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const schedule = (delayMs: number): void => {
    if (stopped) {
      return;
    }
    clearTimer();
    timer = setTimeout(() => {
      void trigger();
    }, delayMs);
  };

  const reconcileCommittedExport = async (): Promise<void> => {
    const metadata = readMetadata(db);
    const state = readCanonicalState(db);
    try {
      const headResult = await runGit(config.repository_path, [
        "rev-parse",
        DATA_REF,
      ]);
      if (headResult.exit_code !== 0) {
        return;
      }
      const head = headResult.stdout;
      const snapshot = await readSnapshotAtRef(
        config.repository_path,
        DATA_REF,
        metadata.dataset_id,
      );
      const expected = serializeSnapshot(
        state.tasks,
        metadata.dataset_id,
      );
      if (
        snapshotsEqual(snapshot.files, expected.files) &&
        (metadata.last_exported_head !== head ||
          metadata.last_exported_revision !== state.revision)
      ) {
        markExported(db, state.revision, head);
      }
    } catch {
      // No committed export exists yet; the normal export path will create it.
    }
  };

  const runOnce = async (): Promise<RepositoryStatus> => {
    try {
      await ensureJigDataWorktree(adapter);
      await reconcileCommittedExport();

      const state = readCanonicalState(db);
      const metadata = readMetadata(db);
      if (state.revision !== metadata.last_exported_revision) {
        currentStatus = "pending";
        const snapshot = serializeSnapshot(
          state.tasks,
          metadata.dataset_id,
        );
        const head = await commitSnapshot(
          adapter,
          snapshot,
          state.revision,
        );
        markExported(db, state.revision, head);
      }

      const pushed = await pushJigDataRef(adapter);
      currentStatus = pushed;
      failureCount = pushed === "sync-issue" ? failureCount + 1 : 0;
      firstDirtyAt = null;

      if (pushed === "sync-issue") {
        currentStatus = "retrying";
        schedule(retryDelayMs(failureCount));
      } else {
        schedule(SYNC_HEALTHY_POLL_MS);
      }
      return pushed;
    } catch {
      failureCount += 1;
      currentStatus = "retrying";
      schedule(retryDelayMs(failureCount));
      return "sync-issue";
    }
  };

  const trigger = async (): Promise<RepositoryStatus> => {
    if (running !== null) {
      return running;
    }
    clearTimer();
    running = runOnce().finally(() => {
      running = null;
    });
    return running;
  };

  return {
    start: async () => {
      stopped = false;
      await ensureJigDataWorktree(adapter);
      await reconcileCommittedExport();
      const metadata = readMetadata(db);
      if (metadata.pending_sync) {
        currentStatus = "pending";
        schedule(0);
      } else {
        currentStatus =
          config.remote_name === null ? "local-only" : "synchronized";
        schedule(SYNC_HEALTHY_POLL_MS);
      }
    },
    stop: () => {
      stopped = true;
      clearTimer();
    },
    notifyMutation: () => {
      currentStatus = "pending";
      const now = Date.now();
      firstDirtyAt ??= now;
      const latestTarget = now + EXPORT_DEBOUNCE_MS;
      const maximumTarget = firstDirtyAt + EXPORT_MAX_FLUSH_MS;
      schedule(Math.max(0, Math.min(latestTarget, maximumTarget) - now));
    },
    trigger,
    status: () => currentStatus,
  };
}

function createStatus(
  config: JigConfig,
  repositoryStatus: RepositoryStatus,
): ServiceStatus {
  return {
    ready: true,
    repository_path: config.repository_path,
    remote_configured: config.remote_name !== null,
    repository_status: repositoryStatus,
  };
}

function createDiagnostics(
  config: JigConfig,
  repositoryStatus: RepositoryStatus,
): Diagnostics {
  return {
    service_healthy: true,
    sqlite_available: true,
    sqlite_schema_version: SQLITE_SCHEMA_VERSION,
    repository_path: config.repository_path,
    data_ref: DATA_REF,
    portable_format_version: PORTABLE_FORMAT_VERSION,
    remote_configured: config.remote_name !== null,
    repository_adapter_healthy: repositoryStatus !== "sync-issue",
  };
}

export async function main(): Promise<void> {
  const config = await loadConfig();
  const lease = await acquireWriterLease(config.repository_path);
  const db = openDatabase(
    resolve(config.repository_path, ".jig", "local", "jig.sqlite"),
  );
  const sync = createSyncController(db, config);
  let migrationInProgress = false;

  const shutdown = async (): Promise<void> => {
    sync.stop();
    db.close();
    await lease.release();
  };

  process.once("SIGINT", () => {
    void shutdown().finally(() => process.exit(0));
  });
  process.once("SIGTERM", () => {
    void shutdown().finally(() => process.exit(0));
  });

  await sync.start();

  const handler = createHttpHandler({
    db,
    write_token: writeToken(),
    repository_path: config.repository_path,
    ui_directory: resolve(import.meta.dir, "..", "..", "dist"),
    now: () => new Date().toISOString(),
    create_id: () => crypto.randomUUID(),
    get_status: () => createStatus(config, sync.status()),
    get_diagnostics: () => createDiagnostics(config, sync.status()),
    trigger_sync: sync.trigger,
    before_task_mutation: () => {
      if (migrationInProgress) {
        throw new RuntimeConfigurationError(
          "Task mutations are temporarily blocked during repository migration",
        );
      }
    },
    migrate_repository: async () => {
      migrationInProgress = true;
      try {
        throw new RuntimeConfigurationError(
          "Repository migration requires the installed lifecycle command",
        );
      } finally {
        migrationInProgress = false;
      }
    },
    on_task_mutation: sync.notifyMutation,
  });

  Bun.serve({
    hostname: "127.0.0.1",
    port: config.http_port,
    fetch: handler,
  });
}

if (import.meta.main) {
  await main();
}
