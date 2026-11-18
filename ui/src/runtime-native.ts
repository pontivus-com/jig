import type { TaskCommand } from "../../src/core/task";
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
} from "../../src/protocol";
import { todayCivilDate } from "./dates";
import { configuredNativeSynchronization } from "./native/configured-sync";
import { openNativeDatabase } from "./native/jig-sqlite";
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

export async function readCanonicalTasks(): Promise<CanonicalState> {
  const connection = await database();
  const changed = await runRollover(connection);
  const synchronization =
    await configuredNativeSynchronization(connection);
  if (changed) {
    synchronization.notifyMutation();
  }
  return readCanonicalState(connection);
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
    new Date().toISOString(),
    crypto.randomUUID,
  );
  (
    await configuredNativeSynchronization(connection)
  ).notifyMutation();
  return result;
}

export async function triggerSync(): Promise<RepositorySynchronizationStatus> {
  const connection = await database();
  return (
    await configuredNativeSynchronization(connection)
  ).trigger();
}
