import {
  assertUuid,
  createCanonicalTask,
  type Task,
  type TaskCommand,
  validateTask,
} from "../core/task";
import type {
  CanonicalState,
  CommandResult,
} from "../protocol";
export type {
  CanonicalState,
  CommandResult,
} from "../protocol";
import {
  assertTaskSet,
  completeTask,
  createTask,
  deleteTask,
  editTask,
  moveTask,
  PlanningError,
  reopenTask,
  rollForwardOutstanding,
} from "../core/planning";

export type SqlValue = string | number | null;
export type SqlRow = Readonly<Record<string, SqlValue>>;

export interface SqlExecutionResult {
  readonly changes: number;
  readonly last_insert_rowid: number | null;
}

export interface JigSqlConnection {
  execute(
    sql: string,
    bindings?: readonly SqlValue[],
  ): Promise<SqlExecutionResult>;
  query(
    sql: string,
    bindings?: readonly SqlValue[],
  ): Promise<readonly SqlRow[]>;
  begin(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  close(): Promise<void>;
}

export const SQLITE_SCHEMA_VERSION = 2;
export const PORTABLE_FORMAT_VERSION = 1;

export interface PersistenceMetadata {
  readonly schema_version: number;
  readonly dataset_id: string;
  readonly revision: number;
  readonly last_exported_revision: number;
  readonly last_exported_head: string | null;
  readonly last_adopted_head: string | null;
  readonly pending_sync: boolean;
}

export class StaleRevisionError extends Error {
  readonly current_revision: number;

  constructor(currentRevision: number) {
    super(`Expected revision is stale; current revision is ${currentRevision}`);
    this.name = "StaleRevisionError";
    this.current_revision = currentRevision;
  }
}

export class PersistenceConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PersistenceConfigurationError";
  }
}

const CREATE_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS task (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  scheduled_date TEXT NOT NULL,
  position INTEGER,
  priority TEXT NOT NULL
    CHECK (priority IN ('HIGH', 'NORMAL', 'LOW')),
  context TEXT,
  reference TEXT,
  note TEXT,
  reminder_time TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (
    (completed_at IS NULL AND position IS NOT NULL AND position >= 0)
    OR (completed_at IS NOT NULL AND position IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS task_active_position
  ON task(scheduled_date, position)
  WHERE completed_at IS NULL;

CREATE INDEX IF NOT EXISTS task_completed_at
  ON task(completed_at);

CREATE TABLE IF NOT EXISTS app_metadata (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  schema_version INTEGER NOT NULL,
  dataset_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision >= 0),
  last_exported_revision INTEGER NOT NULL CHECK (last_exported_revision >= 0),
  last_exported_head TEXT,
  last_adopted_head TEXT,
  pending_sync INTEGER NOT NULL CHECK (pending_sync IN (0, 1))
);

CREATE TABLE IF NOT EXISTS reminder_delivery (
  delivery_key TEXT PRIMARY KEY,
  delivered_at TEXT NOT NULL
);
`;

const TASK_COLUMNS = `
id,
title,
scheduled_date,
position,
priority,
context,
reference,
note,
reminder_time,
completed_at,
created_at,
updated_at
`;

function requireNumber(row: SqlRow, key: string): number {
  const value = row[key];
  if (typeof value !== "number") {
    throw new PersistenceConfigurationError(`Invalid SQLite numeric field ${key}`);
  }
  return value;
}

function requireString(row: SqlRow, key: string): string {
  const value = row[key];
  if (typeof value !== "string") {
    throw new PersistenceConfigurationError(`Invalid SQLite text field ${key}`);
  }
  return value;
}

function nullableString(row: SqlRow, key: string): string | null {
  const value = row[key];
  if (value === null) return null;
  if (typeof value !== "string") {
    throw new PersistenceConfigurationError(`Invalid SQLite nullable text field ${key}`);
  }
  return value;
}

export async function withTransaction<T>(
  connection: JigSqlConnection,
  operation: () => Promise<T>,
): Promise<T> {
  await connection.begin();
  try {
    const result = await operation();
    await connection.commit();
    return result;
  } catch (error) {
    try {
      await connection.rollback();
    } catch {
      // Preserve the original operation error.
    }
    throw error;
  }
}

async function migrateMetadataSchema(
  connection: JigSqlConnection,
): Promise<void> {
  const columns = await connection.query("PRAGMA table_info(app_metadata)");
  if (!columns.some((column) => column.name === "data_ref")) {
    return;
  }

  const rows = await connection.query(
    "SELECT schema_version FROM app_metadata WHERE singleton = 1",
  );
  const row = rows[0];
  if (row === undefined) return;

  const schemaVersion = requireNumber(row, "schema_version");
  if (schemaVersion !== 1) {
    throw new PersistenceConfigurationError(
      `Unsupported SQLite schema version ${schemaVersion}`,
    );
  }

  await withTransaction(connection, async () => {
    await connection.execute("ALTER TABLE app_metadata RENAME TO app_metadata_v1;");
    await connection.execute(`
      CREATE TABLE app_metadata (
        singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
        schema_version INTEGER NOT NULL,
        dataset_id TEXT NOT NULL,
        revision INTEGER NOT NULL CHECK (revision >= 0),
        last_exported_revision INTEGER NOT NULL CHECK (last_exported_revision >= 0),
        last_exported_head TEXT,
        last_adopted_head TEXT,
        pending_sync INTEGER NOT NULL CHECK (pending_sync IN (0, 1))
      );
    `);
    await connection.execute(`
      INSERT INTO app_metadata (
        singleton,
        schema_version,
        dataset_id,
        revision,
        last_exported_revision,
        last_exported_head,
        last_adopted_head,
        pending_sync
      )
      SELECT
        singleton,
        ${SQLITE_SCHEMA_VERSION},
        dataset_id,
        revision,
        last_exported_revision,
        last_exported_head,
        last_adopted_head,
        pending_sync
      FROM app_metadata_v1;
    `);
    await connection.execute("DROP TABLE app_metadata_v1;");
  });
}

export async function initializePersistence(
  connection: JigSqlConnection,
  datasetId: string,
): Promise<void> {
  assertUuid(datasetId, "dataset_id");
  await connection.execute("PRAGMA journal_mode = WAL;");
  await connection.execute("PRAGMA foreign_keys = ON;");
  await connection.execute(CREATE_SCHEMA_SQL);
  await migrateMetadataSchema(connection);

  await connection.execute(
    `INSERT OR IGNORE INTO app_metadata (
      singleton,
      schema_version,
      dataset_id,
      revision,
      last_exported_revision,
      last_exported_head,
      last_adopted_head,
      pending_sync
    ) VALUES (1, ?, ?, 0, 0, NULL, NULL, 0)`,
    [SQLITE_SCHEMA_VERSION, datasetId],
  );

  const metadata = await readMetadata(connection);
  if (metadata.schema_version !== SQLITE_SCHEMA_VERSION) {
    throw new PersistenceConfigurationError(
      `Unsupported SQLite schema version ${metadata.schema_version}`,
    );
  }
  if (metadata.dataset_id !== datasetId) {
    throw new PersistenceConfigurationError(
      "Configured dataset identity does not match the existing database",
    );
  }
  await readCanonicalState(connection);
}

export async function validateOpenedPersistence(
  connection: JigSqlConnection,
): Promise<void> {
  await connection.execute("PRAGMA journal_mode = WAL;");
  await connection.execute("PRAGMA foreign_keys = ON;");
  await migrateMetadataSchema(connection);
  const metadata = await readMetadata(connection);

  if (metadata.schema_version !== SQLITE_SCHEMA_VERSION) {
    throw new PersistenceConfigurationError(
      `Unsupported SQLite schema version ${metadata.schema_version}`,
    );
  }
  await readCanonicalState(connection);
}

export async function readMetadata(
  connection: JigSqlConnection,
): Promise<PersistenceMetadata> {
  const rows = await connection.query(
    `SELECT
      schema_version,
      dataset_id,
      revision,
      last_exported_revision,
      last_exported_head,
      last_adopted_head,
      pending_sync
    FROM app_metadata
    WHERE singleton = 1`,
  );
  const row = rows[0];
  if (row === undefined) {
    throw new PersistenceConfigurationError(
      "Jig metadata is missing from the configured database",
    );
  }

  const datasetId = requireString(row, "dataset_id");
  assertUuid(datasetId, "dataset_id");
  return {
    schema_version: requireNumber(row, "schema_version"),
    dataset_id: datasetId,
    revision: requireNumber(row, "revision"),
    last_exported_revision: requireNumber(row, "last_exported_revision"),
    last_exported_head: nullableString(row, "last_exported_head"),
    last_adopted_head: nullableString(row, "last_adopted_head"),
    pending_sync: requireNumber(row, "pending_sync") === 1,
  };
}

export async function readTasks(
  connection: JigSqlConnection,
): Promise<readonly Task[]> {
  const rows = await connection.query(
    `SELECT ${TASK_COLUMNS}
     FROM task
     ORDER BY scheduled_date, completed_at IS NOT NULL, position, id`,
  );
  const tasks = rows.map((row) => validateTask(row));
  assertTaskSet(tasks);
  return tasks;
}

export async function readCanonicalState(
  connection: JigSqlConnection,
): Promise<CanonicalState> {
  const metadata = await readMetadata(connection);
  return {
    revision: metadata.revision,
    tasks: await readTasks(connection),
  };
}

function executeCoreCommand(
  tasks: readonly Task[],
  command: TaskCommand,
  now: string,
  createId: () => string,
):
  | { readonly tasks: readonly Task[]; readonly task: Task }
  | { readonly tasks: readonly Task[]; readonly deleted_task_id: string } {
  switch (command.type) {
    case "create":
      return createTask(tasks, createCanonicalTask(command, createId(), now));
    case "edit":
      return editTask(tasks, command.task_id, command.changes, now);
    case "move":
      return moveTask(
        tasks,
        command.task_id,
        command.destination_date,
        command.destination_index,
        now,
      );
    case "complete":
      return completeTask(tasks, command.task_id, now);
    case "reopen":
      return reopenTask(tasks, command.task_id, now);
    case "delete":
      return deleteTask(tasks, command.task_id, now);
  }
}

async function persistCanonicalSet(
  connection: JigSqlConnection,
  currentTasks: readonly Task[],
  nextTasks: readonly Task[],
): Promise<void> {
  await connection.execute(
    "UPDATE task SET position = position + 1000000000 WHERE completed_at IS NULL",
  );

  const nextIds = new Set(nextTasks.map((task) => task.id));
  for (const current of currentTasks) {
    if (!nextIds.has(current.id)) {
      await connection.execute("DELETE FROM task WHERE id = ?", [current.id]);
    }
  }

  const upsert = `INSERT INTO task (
    ${TASK_COLUMNS}
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    title = excluded.title,
    scheduled_date = excluded.scheduled_date,
    position = excluded.position,
    priority = excluded.priority,
    context = excluded.context,
    reference = excluded.reference,
    note = excluded.note,
    reminder_time = excluded.reminder_time,
    completed_at = excluded.completed_at,
    created_at = excluded.created_at,
    updated_at = excluded.updated_at`;

  for (const task of nextTasks) {
    await connection.execute(upsert, [
      task.id,
      task.title,
      task.scheduled_date,
      task.position,
      task.priority,
      task.context,
      task.reference,
      task.note,
      task.reminder_time,
      task.completed_at,
      task.created_at,
      task.updated_at,
    ]);
  }
}

export async function applyTaskCommand(
  connection: JigSqlConnection,
  command: TaskCommand,
  expectedRevision: number,
  now: string,
  createId: () => string = crypto.randomUUID,
): Promise<CommandResult> {
  return withTransaction(connection, async () => {
    const state = await readCanonicalState(connection);
    if (state.revision !== expectedRevision) {
      throw new StaleRevisionError(state.revision);
    }

    const result = executeCoreCommand(state.tasks, command, now, createId);
    await persistCanonicalSet(connection, state.tasks, result.tasks);

    const revision = state.revision + 1;
    await connection.execute(
      `UPDATE app_metadata
       SET revision = ?, pending_sync = 1
       WHERE singleton = 1`,
      [revision],
    );

    if ("task" in result) {
      return { revision, task: result.task };
    }
    return { revision, deleted_task_id: result.deleted_task_id };
  });
}

export interface RolloverResult {
  readonly revision: number;
  readonly moved_task_ids: readonly string[];
}

export async function rollForwardOutstandingInDatabase(
  connection: JigSqlConnection,
  currentLocalDate: string,
  updatedAt: string,
): Promise<RolloverResult> {
  return withTransaction(connection, async () => {
    const state = await readCanonicalState(connection);
    const result = rollForwardOutstanding(
      state.tasks,
      currentLocalDate,
      updatedAt,
    );
    if (result.moved_task_ids.length === 0) {
      return { revision: state.revision, moved_task_ids: [] };
    }

    await persistCanonicalSet(connection, state.tasks, result.tasks);
    const revision = state.revision + 1;
    await connection.execute(
      `UPDATE app_metadata
       SET revision = ?, pending_sync = 1
       WHERE singleton = 1`,
      [revision],
    );

    return { revision, moved_task_ids: result.moved_task_ids };
  });
}

export async function markExported(
  connection: JigSqlConnection,
  exportedRevision: number,
  head: string | null,
): Promise<void> {
  const metadata = await readMetadata(connection);
  if (
    exportedRevision < metadata.last_exported_revision ||
    exportedRevision > metadata.revision
  ) {
    throw new PersistenceConfigurationError(
      "Exported revision is outside the durable SQLite revision range",
    );
  }

  await connection.execute(
    `UPDATE app_metadata
     SET
       last_exported_revision = ?,
       last_exported_head = ?,
       pending_sync = CASE WHEN revision > ? THEN 1 ELSE 0 END
     WHERE singleton = 1`,
    [exportedRevision, head, exportedRevision],
  );
}

export async function markAdoptedHead(
  connection: JigSqlConnection,
  head: string | null,
): Promise<void> {
  await connection.execute(
    `UPDATE app_metadata
     SET last_adopted_head = ?
     WHERE singleton = 1`,
    [head],
  );
}

export async function adoptCanonicalSnapshot(
  connection: JigSqlConnection,
  tasks: readonly Task[],
  adoptedHead: string | null,
): Promise<CanonicalState> {
  assertTaskSet(tasks);

  return withTransaction(connection, async () => {
    const current = await readCanonicalState(connection);
    await persistCanonicalSet(connection, current.tasks, tasks);

    const revision = current.revision + 1;
    await connection.execute(
      `UPDATE app_metadata
       SET
         revision = ?,
         last_exported_revision = ?,
         last_exported_head = ?,
         last_adopted_head = ?,
         pending_sync = 0
       WHERE singleton = 1`,
      [revision, revision, adoptedHead, adoptedHead],
    );

    return { revision, tasks: await readTasks(connection) };
  });
}
