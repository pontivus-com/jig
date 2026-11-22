import type { TaskCommand } from "../../src/core/task";
import type {
  JigDataConflictCase,
  JigDataResolution,
} from "../../src/core/synchronization-recovery";
import {
  PORTABLE_FORMAT_VERSION,
  SQLITE_SCHEMA_VERSION,
  applyTaskCommand,
  readCanonicalState,
  readMetadata,
  rollForwardOutstandingInDatabase,
  type JigSqlConnection,
} from "../../src/persistence/sqlite";
import type {
  CanonicalState,
  CommandResult,
  Diagnostics,
  RepositorySynchronizationStatus,
  ServiceStatus,
} from "../../src/protocol/runtime";
import { todayCivilDate } from "./dates";
import { configuredNativeSynchronization } from "./native/configured-sync";
import { openNativeDatabase } from "./native/jig-sqlite";
import { reconcileAndroidReminders } from "./native/reminder-reconciliation";
import {
  ANDROID_DATABASE_PATH,
  ANDROID_REPOSITORY_ROOT,
} from "./native/paths";

let databasePromise: Promise<JigSqlConnection> | null = null;

function database(): Promise<JigSqlConnection> {
  databasePromise ??= openNativeDatabase(ANDROID_DATABASE_PATH).catch(
    (error: unknown) => {
      databasePromise = null;
      throw error;
    },
  );
  return databasePromise;
}

async function runRollover(
  connection: JigSqlConnection,
): Promise<boolean> {
  const before = (await readMetadata(connection)).revision;
  await rollForwardOutstandingInDatabase(
    connection,
    todayCivilDate(),
    new Date().toISOString(),
  );
  return (await readMetadata(connection)).revision !== before;
}


export async function rollForwardRuntimeLocalDay(): Promise<boolean> {
  return runRollover(await database());
}

export async function readCanonicalTasksAfterActivationRollover():
Promise<CanonicalState> {
  return readCanonicalState(await database());
}

export async function reconcileRuntimeReminders(
  tasks: CanonicalState["tasks"],
  now: Date,
): Promise<void> {
  await reconcileAndroidReminders(tasks, now);
}

export async function readCanonicalTasks(): Promise<CanonicalState> {
  const connection = await database();
  const changed = await runRollover(connection);
  const state = await readCanonicalState(connection);
  try {
    await reconcileAndroidReminders(
      state.tasks,
      new Date(),
    );
  } catch {
    // Reminder side-effect drift is repaired on the next reconciliation.
  }
  const synchronization =
    await configuredNativeSynchronization(connection);
  if (changed) {
    synchronization.notifyMutation();
  }
  return state;
}

export async function readStatus(): Promise<ServiceStatus> {
  const connection = await database();
  const synchronization =
    await configuredNativeSynchronization(connection);
  return {
    ready: true,
    repository_path: `app-private://${ANDROID_REPOSITORY_ROOT}`,
    repository_status: synchronization.status(),
  };
}

export async function readDiagnostics(): Promise<Diagnostics> {
  const connection = await database();
  const synchronization =
    await configuredNativeSynchronization(connection);
  const status = synchronization.status();
  return {
    service_healthy: true,
    sqlite_available: true,
    sqlite_schema_version: SQLITE_SCHEMA_VERSION,
    repository_path: `app-private://${ANDROID_REPOSITORY_ROOT}`,
    portable_format_version: PORTABLE_FORMAT_VERSION,
    repository_adapter_healthy:
      status.local_git !== "issue" &&
      status.remote.state !== "sync-issue",
    synchronization: synchronization.diagnostics(),
  };
}

export async function submitTaskCommand(
  command: TaskCommand,
  expectedRevision: number,
): Promise<CommandResult> {
  const connection = await database();
  const result = await applyTaskCommand(
    connection,
    command,
    expectedRevision,
    todayCivilDate(),
    new Date().toISOString(),
    () => crypto.randomUUID(),
  );
  try {
    const state = await readCanonicalState(connection);
    await reconcileAndroidReminders(
      state.tasks,
      new Date(),
    );
  } catch {
    // Canonical mutation stays committed; reconciliation retries on resume/start.
  }
  (
    await configuredNativeSynchronization(connection)
  ).notifyMutation();
  return result;
}

export async function readSynchronizationConflict(): Promise<
  JigDataConflictCase | null
> {
  const connection = await database();
  return (
    await configuredNativeSynchronization(connection)
  ).readSynchronizationConflict();
}

export async function resolveSynchronizationConflict(
  resolution: JigDataResolution,
): Promise<RepositorySynchronizationStatus> {
  const connection = await database();
  return (
    await configuredNativeSynchronization(connection)
  ).resolveSynchronizationConflict(resolution);
}

export async function triggerSync(): Promise<RepositorySynchronizationStatus> {
  const connection = await database();
  return (
    await configuredNativeSynchronization(connection)
  ).trigger();
}
