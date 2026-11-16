import { Database } from "bun:sqlite";
import {
  assertUuid,
  normalizeOptionalText,
  normalizeTitle,
  type Task,
  type TaskCommand,
  validateTask,
} from "../core/task";
import {
  assertTaskSet,
  completeTask,
  createTask,
  deleteTask,
  editTask,
  moveTask,
  PlanningError,
  reopenTask,
} from "../core/planning";

export const SQLITE_SCHEMA_VERSION = 1;
export const PORTABLE_FORMAT_VERSION = 1;
export const DATA_REF = "refs/heads/jig-data";

export type RepositoryStatus =
  | "local-only"
  | "pending"
  | "retrying"
  | "synchronized"
  | "sync-issue";

export interface PersistenceMetadata {
  readonly schema_version: number;
  readonly dataset_id: string;
  readonly revision: number;
  readonly last_exported_revision: number;
  readonly last_exported_head: string | null;
  readonly last_adopted_head: string | null;
  readonly data_ref: typeof DATA_REF;
  readonly pending_sync: boolean;
}

export interface CanonicalState {
  readonly revision: number;
  readonly tasks: readonly Task[];
}

export type CommandResult =
  | { readonly revision: number; readonly task: Task }
  | { readonly revision: number; readonly deleted_task_id: string };

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
  data_ref TEXT NOT NULL,
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

export function initializeDatabase(
  path: string,
  datasetId: string,
): Database {
  assertUuid(datasetId, "dataset_id");
  const db = new Database(path, { create: true });
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(CREATE_SCHEMA_SQL);

  db.query(
    `INSERT OR IGNORE INTO app_metadata (
      singleton,
      schema_version,
      dataset_id,
      revision,
      last_exported_revision,
      last_exported_head,
      last_adopted_head,
      data_ref,
      pending_sync
    ) VALUES (1, ?, ?, 0, 0, NULL, NULL, ?, 0)`,
  ).run(SQLITE_SCHEMA_VERSION, datasetId, DATA_REF);

  const metadata = readMetadata(db);
  if (metadata.schema_version !== SQLITE_SCHEMA_VERSION) {
    db.close();
    throw new PersistenceConfigurationError(
      `Unsupported SQLite schema version ${metadata.schema_version}`,
    );
  }
  if (metadata.dataset_id !== datasetId) {
    db.close();
    throw new PersistenceConfigurationError(
      "Configured dataset identity does not match the existing database",
    );
  }
  if (metadata.data_ref !== DATA_REF) {
    db.close();
    throw new PersistenceConfigurationError(
      `Unsupported data ref ${metadata.data_ref}`,
    );
  }

  readCanonicalState(db);
  return db;
}

export function openDatabase(path: string): Database {
  const db = new Database(path);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  const metadata = readMetadata(db);

  if (metadata.schema_version !== SQLITE_SCHEMA_VERSION) {
    db.close();
    throw new PersistenceConfigurationError(
      `Unsupported SQLite schema version ${metadata.schema_version}`,
    );
  }
  if (metadata.data_ref !== DATA_REF) {
    db.close();
    throw new PersistenceConfigurationError(
      `Unsupported data ref ${metadata.data_ref}`,
    );
  }

  readCanonicalState(db);
  return db;
}

export function readMetadata(db: Database): PersistenceMetadata {
  const row = db
    .query(
      `SELECT
        schema_version,
        dataset_id,
        revision,
        last_exported_revision,
        last_exported_head,
        last_adopted_head,
        data_ref,
        pending_sync
      FROM app_metadata
      WHERE singleton = 1`,
    )
    .get() as
    | {
        schema_version: number;
        dataset_id: string;
        revision: number;
        last_exported_revision: number;
        last_exported_head: string | null;
        last_adopted_head: string | null;
        data_ref: string;
        pending_sync: number;
      }
    | null;

  if (row === null) {
    throw new PersistenceConfigurationError(
      "Jig metadata is missing from the configured database",
    );
  }

  assertUuid(row.dataset_id, "dataset_id");
  if (row.data_ref !== DATA_REF) {
    throw new PersistenceConfigurationError(
      `Unsupported data ref ${row.data_ref}`,
    );
  }

  return {
    schema_version: row.schema_version,
    dataset_id: row.dataset_id,
    revision: row.revision,
    last_exported_revision: row.last_exported_revision,
    last_exported_head: row.last_exported_head,
    last_adopted_head: row.last_adopted_head,
    data_ref: DATA_REF,
    pending_sync: row.pending_sync === 1,
  };
}

export function readTasks(db: Database): readonly Task[] {
  const rows = db
    .query(
      `SELECT ${TASK_COLUMNS}
       FROM task
       ORDER BY scheduled_date, completed_at IS NOT NULL, position, id`,
    )
    .all() as Task[];

  for (const task of rows) {
    validateTask(task);
  }
  assertTaskSet(rows);
  return rows;
}

export function readCanonicalState(db: Database): CanonicalState {
  const metadata = readMetadata(db);
  return {
    revision: metadata.revision,
    tasks: readTasks(db),
  };
}

function createCanonicalTask(
  command: Extract<TaskCommand, { readonly type: "create" }>,
  id: string,
  now: string,
): Task {
  assertUuid(id);
  return validateTask({
    id,
    title: normalizeTitle(command.title),
    scheduled_date: command.scheduled_date,
    position: 0,
    priority: command.priority ?? "NORMAL",
    context: normalizeOptionalText(command.context),
    reference: normalizeOptionalText(command.reference),
    note: normalizeOptionalText(command.note),
    reminder_time: command.reminder_time ?? null,
    completed_at: null,
    created_at: now,
    updated_at: now,
  });
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
      return createTask(
        tasks,
        createCanonicalTask(command, createId(), now),
      );
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

function persistCanonicalSet(
  db: Database,
  currentTasks: readonly Task[],
  nextTasks: readonly Task[],
): void {
  db.exec(
    "UPDATE task SET position = position + 1000000000 WHERE completed_at IS NULL",
  );

  const nextIds = new Set(nextTasks.map((task) => task.id));
  const deleteStatement = db.query("DELETE FROM task WHERE id = ?");
  for (const current of currentTasks) {
    if (!nextIds.has(current.id)) {
      deleteStatement.run(current.id);
    }
  }

  const upsert = db.query(
    `INSERT INTO task (
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
      updated_at = excluded.updated_at`,
  );

  for (const task of nextTasks) {
    upsert.run(
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
    );
  }
}

export function applyTaskCommand(
  db: Database,
  command: TaskCommand,
  expectedRevision: number,
  now: string,
  createId: () => string = crypto.randomUUID,
): CommandResult {
  const transaction = db.transaction((): CommandResult => {
    const state = readCanonicalState(db);
    if (state.revision !== expectedRevision) {
      throw new StaleRevisionError(state.revision);
    }

    const result = executeCoreCommand(
      state.tasks,
      command,
      now,
      createId,
    );
    persistCanonicalSet(db, state.tasks, result.tasks);

    const revision = state.revision + 1;
    db.query(
      `UPDATE app_metadata
       SET revision = ?, pending_sync = 1
       WHERE singleton = 1`,
    ).run(revision);

    if ("task" in result) {
      return { revision, task: result.task };
    }
    return {
      revision,
      deleted_task_id: result.deleted_task_id,
    };
  });

  try {
    return transaction();
  } catch (error) {
    if (
      error instanceof StaleRevisionError ||
      error instanceof PlanningError
    ) {
      throw error;
    }
    throw error;
  }
}

export function markExported(
  db: Database,
  exportedRevision: number,
  head: string | null,
): void {
  const metadata = readMetadata(db);
  if (
    exportedRevision < metadata.last_exported_revision ||
    exportedRevision > metadata.revision
  ) {
    throw new PersistenceConfigurationError(
      "Exported revision is outside the durable SQLite revision range",
    );
  }

  db.query(
    `UPDATE app_metadata
     SET
       last_exported_revision = ?,
       last_exported_head = ?,
       pending_sync = CASE WHEN revision > ? THEN 1 ELSE 0 END
     WHERE singleton = 1`,
  ).run(exportedRevision, head, exportedRevision);
}

export function markAdoptedHead(
  db: Database,
  head: string | null,
): void {
  db.query(
    `UPDATE app_metadata
     SET last_adopted_head = ?
     WHERE singleton = 1`,
  ).run(head);
}

export function adoptCanonicalSnapshot(
  db: Database,
  tasks: readonly Task[],
  adoptedHead: string | null,
): CanonicalState {
  assertTaskSet(tasks);

  const transaction = db.transaction((): CanonicalState => {
    const current = readCanonicalState(db);
    persistCanonicalSet(db, current.tasks, tasks);

    const revision = current.revision + 1;
    db.query(
      `UPDATE app_metadata
       SET
         revision = ?,
         last_exported_revision = ?,
         last_exported_head = ?,
         last_adopted_head = ?,
         pending_sync = 0
       WHERE singleton = 1`,
    ).run(revision, revision, adoptedHead, adoptedHead);

    return { revision, tasks: readTasks(db) };
  });

  return transaction();
}
