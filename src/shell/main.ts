import { resolve } from "node:path";
import {
  DATA_REF,
  openDatabase,
  PORTABLE_FORMAT_VERSION,
  SQLITE_SCHEMA_VERSION,
  type RepositoryStatus,
} from "./sqlite";
import {
  createHttpHandler,
  type Diagnostics,
  type ServiceStatus,
} from "./http";
import { createSyncController } from "./sync";
import {
  loadConfig,
  type JigConfig,
} from "./config";
import { acquireWriterLease } from "./writer";

function writeToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
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
    before_task_mutation: () => undefined,
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
