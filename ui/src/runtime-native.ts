import type { TaskCommand } from "../../src/core/task";
import {
  PORTABLE_FORMAT_VERSION,
  SQLITE_SCHEMA_VERSION,
  applyTaskCommand,
  readCanonicalState,
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

function pendingRepositoryStatus(): RepositorySynchronizationStatus {
  return {
    local_git: "pending",
    remote: {
      state: "not-configured",
      remote_name: null,
      remote_location: null,
    },
  };
}

async function runRollover(
  connection: JigSqlConnection,
): Promise<void> {
  await rollForwardOutstandingInDatabase(
    connection,
    todayCivilDate(),
    new Date().toISOString(),
  );
}

export async function readCanonicalTasks(): Promise<CanonicalState> {
  const connection = await database();
  await runRollover(connection);
  return readCanonicalState(connection);
}

export async function readStatus(): Promise<ServiceStatus> {
  await database();
  return {
    ready: true,
    repository_path: `app-private://${ANDROID_REPOSITORY_ROOT}`,
    repository_status: pendingRepositoryStatus(),
  };
}

export async function readDiagnostics(): Promise<Diagnostics> {
  await database();
  return {
    service_healthy: true,
    sqlite_available: true,
    sqlite_schema_version: SQLITE_SCHEMA_VERSION,
    repository_path: `app-private://${ANDROID_REPOSITORY_ROOT}`,
    portable_format_version: PORTABLE_FORMAT_VERSION,
    repository_adapter_healthy: false,
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
  return result;
}

export async function triggerSync(): Promise<RepositorySynchronizationStatus> {
  await database();
  return pendingRepositoryStatus();
}
