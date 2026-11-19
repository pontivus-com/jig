import {
  assertUuid,
  createCanonicalTask,
  type Task,
  type TaskCommand,
  validateTask,
} from "../core/task";
import {
  validateRecurrenceSeries,
  type RecurrencePattern,
  type RecurrenceSeries,
  type Weekday,
} from "../core/recurrence";
import {
  assertRecurrenceState,
  enableTaskRecurrence,
  setTaskRecurrence,
} from "../core/recurrence-planning";
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

export const SQLITE_SCHEMA_VERSION = 3;
export { PORTABLE_FORMAT_VERSION } from "../portable";

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

const CREATE_SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS recurrence_series (
  id TEXT PRIMARY KEY,
  effective_from TEXT NOT NULL,
  end_date TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('weekly', 'monthly')),
  interval_weeks INTEGER,
  weekdays_mask INTEGER,
  day_of_month INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (
    (kind = 'weekly'
      AND interval_weeks IS NOT NULL AND interval_weeks > 0
      AND weekdays_mask IS NOT NULL
      AND weekdays_mask BETWEEN 1 AND 127
      AND day_of_month IS NULL)
    OR
    (kind = 'monthly'
      AND interval_weeks IS NULL
      AND weekdays_mask IS NULL
      AND day_of_month BETWEEN 1 AND 31)
  )
)`,
  `CREATE TABLE IF NOT EXISTS task (
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
  recurrence_series_id TEXT REFERENCES recurrence_series(id),
  recurrence_occurrence_date TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (
    (completed_at IS NULL AND position IS NOT NULL AND position >= 0)
    OR (completed_at IS NOT NULL AND position IS NULL)
  ),
  CHECK (
    (recurrence_series_id IS NULL AND recurrence_occurrence_date IS NULL)
    OR
    (recurrence_series_id IS NOT NULL AND recurrence_occurrence_date IS NOT NULL)
  )
)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS task_active_position
  ON task(scheduled_date, position)
  WHERE completed_at IS NULL`,
  `CREATE INDEX IF NOT EXISTS task_completed_at
  ON task(completed_at)`,
  `CREATE TABLE IF NOT EXISTS app_metadata (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  schema_version INTEGER NOT NULL,
  dataset_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision >= 0),
  last_exported_revision INTEGER NOT NULL CHECK (last_exported_revision >= 0),
  last_exported_head TEXT,
  last_adopted_head TEXT,
  pending_sync INTEGER NOT NULL CHECK (pending_sync IN (0, 1))
)`,
  `CREATE TABLE IF NOT EXISTS reminder_delivery (
  delivery_key TEXT PRIMARY KEY,
  delivered_at TEXT NOT NULL
)`,
] as const;

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
recurrence_series_id,
recurrence_occurrence_date,
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
        2,
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

const WEEKDAY_BITS: Readonly<Record<Weekday, number>> = {
  MON: 1,
  TUE: 2,
  WED: 4,
  THU: 8,
  FRI: 16,
  SAT: 32,
  SUN: 64,
};

function weekdaysToMask(weekdays: readonly Weekday[]): number {
  return weekdays.reduce(
    (mask, weekday) => mask | WEEKDAY_BITS[weekday],
    0,
  );
}

function weekdaysFromMask(mask: number): readonly Weekday[] {
  const weekdays = Object.entries(WEEKDAY_BITS)
    .filter(([, bit]) => (mask & bit) !== 0)
    .map(([weekday]) => weekday);
  return weekdays.filter(
    (weekday): weekday is Weekday =>
      weekday === "MON" ||
      weekday === "TUE" ||
      weekday === "WED" ||
      weekday === "THU" ||
      weekday === "FRI" ||
      weekday === "SAT" ||
      weekday === "SUN",
  );
}

async function migrateRecurrenceSchema(
  connection: JigSqlConnection,
): Promise<void> {
  const rows = await connection.query(
    "SELECT schema_version FROM app_metadata WHERE singleton = 1",
  );
  const row = rows[0];
  if (row === undefined) {
    return;
  }
  const schemaVersion = requireNumber(row, "schema_version");
  if (schemaVersion === SQLITE_SCHEMA_VERSION) {
    return;
  }
  if (schemaVersion !== 2) {
    throw new PersistenceConfigurationError(
      `Unsupported SQLite schema version ${schemaVersion}`,
    );
  }

  const taskColumns = await connection.query("PRAGMA table_info(task)");
  const alreadyHasRecurrence = taskColumns.some(
    (column) => column.name === "recurrence_series_id",
  );

  await withTransaction(connection, async () => {
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS recurrence_series (
        id TEXT PRIMARY KEY,
        effective_from TEXT NOT NULL,
        end_date TEXT NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('weekly', 'monthly')),
        interval_weeks INTEGER,
        weekdays_mask INTEGER,
        day_of_month INTEGER,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        CHECK (
          (kind = 'weekly'
            AND interval_weeks IS NOT NULL AND interval_weeks > 0
            AND weekdays_mask IS NOT NULL
            AND weekdays_mask BETWEEN 1 AND 127
            AND day_of_month IS NULL)
          OR
          (kind = 'monthly'
            AND interval_weeks IS NULL
            AND weekdays_mask IS NULL
            AND day_of_month BETWEEN 1 AND 31)
        )
      );
    `);

    if (!alreadyHasRecurrence) {
      await connection.execute(
        "DROP INDEX IF EXISTS task_active_position",
      );
      await connection.execute(
        "DROP INDEX IF EXISTS task_completed_at",
      );
      await connection.execute("ALTER TABLE task RENAME TO task_v2");
      await connection.execute(`
        CREATE TABLE task (
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
          recurrence_series_id TEXT REFERENCES recurrence_series(id),
          recurrence_occurrence_date TEXT,
          completed_at TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          CHECK (
            (completed_at IS NULL AND position IS NOT NULL AND position >= 0)
            OR (completed_at IS NOT NULL AND position IS NULL)
          ),
          CHECK (
            (recurrence_series_id IS NULL AND recurrence_occurrence_date IS NULL)
            OR
            (recurrence_series_id IS NOT NULL AND recurrence_occurrence_date IS NOT NULL)
          )
        )
      `);
      await connection.execute(`
        INSERT INTO task (
          id, title, scheduled_date, position, priority,
          context, reference, note, reminder_time,
          recurrence_series_id, recurrence_occurrence_date,
          completed_at, created_at, updated_at
        )
        SELECT
          id, title, scheduled_date, position, priority,
          context, reference, note, reminder_time,
          NULL, NULL,
          completed_at, created_at, updated_at
        FROM task_v2
      `);
      await connection.execute("DROP TABLE task_v2");
    }

    await connection.execute(`
      CREATE UNIQUE INDEX IF NOT EXISTS task_active_position
        ON task(scheduled_date, position)
        WHERE completed_at IS NULL
    `);
    await connection.execute(`
      CREATE UNIQUE INDEX IF NOT EXISTS task_recurrence_slot
        ON task(recurrence_series_id, recurrence_occurrence_date)
        WHERE recurrence_series_id IS NOT NULL
    `);
    await connection.execute(`
      CREATE INDEX IF NOT EXISTS task_completed_at
        ON task(completed_at)
    `);
    await connection.execute(
      "UPDATE app_metadata SET schema_version = ? WHERE singleton = 1",
      [SQLITE_SCHEMA_VERSION],
    );
  });
}

async function ensureRecurrenceIndexes(
  connection: JigSqlConnection,
): Promise<void> {
  await connection.execute(`
    CREATE UNIQUE INDEX IF NOT EXISTS task_recurrence_slot
      ON task(recurrence_series_id, recurrence_occurrence_date)
      WHERE recurrence_series_id IS NOT NULL
  `);
}

export async function initializePersistence(
  connection: JigSqlConnection,
  datasetId: string,
): Promise<void> {
  assertUuid(datasetId, "dataset_id");
  await connection.execute("PRAGMA journal_mode = WAL;");
  await connection.execute("PRAGMA foreign_keys = ON;");
  for (const statement of CREATE_SCHEMA_STATEMENTS) {
    await connection.execute(statement);
  }
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
  await migrateRecurrenceSchema(connection);
  await ensureRecurrenceIndexes(connection);

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
  await migrateRecurrenceSchema(connection);
  await ensureRecurrenceIndexes(connection);
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

export async function readRecurrences(
  connection: JigSqlConnection,
): Promise<readonly RecurrenceSeries[]> {
  const rows = await connection.query(
    `SELECT
      id,
      effective_from,
      end_date,
      kind,
      interval_weeks,
      weekdays_mask,
      day_of_month,
      created_at,
      updated_at
    FROM recurrence_series
    ORDER BY id`,
  );

  return rows.map((row) => {
    const kind = requireString(row, "kind");
    let pattern: RecurrencePattern;
    if (kind === "weekly") {
      const intervalWeeks = requireNumber(row, "interval_weeks");
      const weekdaysMask = requireNumber(row, "weekdays_mask");
      pattern = {
        kind: "weekly",
        interval_weeks: intervalWeeks,
        weekdays: weekdaysFromMask(weekdaysMask),
      };
    } else if (kind === "monthly") {
      pattern = {
        kind: "monthly",
        day_of_month: requireNumber(row, "day_of_month"),
      };
    } else {
      throw new PersistenceConfigurationError(
        `Invalid recurrence kind ${kind}`,
      );
    }

    return validateRecurrenceSeries({
      id: requireString(row, "id"),
      effective_from: requireString(row, "effective_from"),
      end_date: requireString(row, "end_date"),
      pattern,
      created_at: requireString(row, "created_at"),
      updated_at: requireString(row, "updated_at"),
    });
  });
}

export async function readCanonicalState(
  connection: JigSqlConnection,
): Promise<CanonicalState> {
  const metadata = await readMetadata(connection);
  const tasks = await readTasks(connection);
  const recurrences = await readRecurrences(connection);
  assertRecurrenceState(tasks, recurrences);
  return {
    revision: metadata.revision,
    tasks,
    recurrences,
  };
}

function pruneOrphanRecurrences(
  tasks: readonly Task[],
  recurrences: readonly RecurrenceSeries[],
): readonly RecurrenceSeries[] {
  const linked = new Set(
    tasks
      .map((task) => task.recurrence_series_id)
      .filter((id): id is string => id !== null),
  );
  return recurrences.filter((series) => linked.has(series.id));
}

function executeCoreCommand(
  state: Pick<CanonicalState, "tasks" | "recurrences">,
  command: TaskCommand,
  now: string,
  createId: () => string,
):
  | {
      readonly tasks: readonly Task[];
      readonly recurrences: readonly RecurrenceSeries[];
      readonly task: Task;
    }
  | {
      readonly tasks: readonly Task[];
      readonly recurrences: readonly RecurrenceSeries[];
      readonly deleted_task_id: string;
    } {
  if (command.type === "create") {
    const created = createTask(
      state.tasks,
      createCanonicalTask(command, createId(), now),
    );
    if (command.recurrence === undefined) {
      return {
        ...created,
        recurrences: state.recurrences,
      };
    }
    return enableTaskRecurrence(
      created.tasks,
      state.recurrences,
      created.task.id,
      command.recurrence,
      createId,
      createId,
      now,
    );
  }

  let result:
    | { readonly tasks: readonly Task[]; readonly task: Task }
    | { readonly tasks: readonly Task[]; readonly deleted_task_id: string };
  switch (command.type) {
    case "edit": {
      const edited = editTask(
        state.tasks,
        command.task_id,
        command.changes,
        now,
      );
      if (command.recurrence === undefined) {
        result = edited;
        break;
      }
      return setTaskRecurrence(
        edited.tasks,
        state.recurrences,
        command.task_id,
        command.recurrence,
        createId,
        createId,
        now,
      );
    }
    case "move":
      result = moveTask(
        state.tasks,
        command.task_id,
        command.destination_date,
        command.destination_index,
        now,
      );
      break;
    case "complete":
      result = completeTask(state.tasks, command.task_id, now);
      break;
    case "reopen":
      result = reopenTask(state.tasks, command.task_id, now);
      break;
    case "delete":
      result = deleteTask(state.tasks, command.task_id, now);
      break;
  }

  const recurrences = pruneOrphanRecurrences(
    result.tasks,
    state.recurrences,
  );
  assertRecurrenceState(result.tasks, recurrences);
  return {
    ...result,
    recurrences,
  };
}

async function persistCanonicalSet(
  connection: JigSqlConnection,
  currentTasks: readonly Task[],
  currentRecurrences: readonly RecurrenceSeries[],
  nextTasks: readonly Task[],
  nextRecurrences: readonly RecurrenceSeries[],
): Promise<void> {
  assertRecurrenceState(nextTasks, nextRecurrences);

  for (const series of nextRecurrences) {
    const pattern = series.pattern;
    await connection.execute(
      `INSERT INTO recurrence_series (
        id,
        effective_from,
        end_date,
        kind,
        interval_weeks,
        weekdays_mask,
        day_of_month,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        effective_from = excluded.effective_from,
        end_date = excluded.end_date,
        kind = excluded.kind,
        interval_weeks = excluded.interval_weeks,
        weekdays_mask = excluded.weekdays_mask,
        day_of_month = excluded.day_of_month,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at`,
      [
        series.id,
        series.effective_from,
        series.end_date,
        pattern.kind,
        pattern.kind === "weekly" ? pattern.interval_weeks : null,
        pattern.kind === "weekly"
          ? weekdaysToMask(pattern.weekdays)
          : null,
        pattern.kind === "monthly" ? pattern.day_of_month : null,
        series.created_at,
        series.updated_at,
      ],
    );
  }

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
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    title = excluded.title,
    scheduled_date = excluded.scheduled_date,
    position = excluded.position,
    priority = excluded.priority,
    context = excluded.context,
    reference = excluded.reference,
    note = excluded.note,
    reminder_time = excluded.reminder_time,
    recurrence_series_id = excluded.recurrence_series_id,
    recurrence_occurrence_date = excluded.recurrence_occurrence_date,
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
      task.recurrence_series_id,
      task.recurrence_occurrence_date,
      task.completed_at,
      task.created_at,
      task.updated_at,
    ]);
  }

  const nextSeriesIds = new Set(
    nextRecurrences.map((series) => series.id),
  );
  for (const current of currentRecurrences) {
    if (!nextSeriesIds.has(current.id)) {
      await connection.execute(
        "DELETE FROM recurrence_series WHERE id = ?",
        [current.id],
      );
    }
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

    const result = executeCoreCommand(state, command, now, createId);
    await persistCanonicalSet(
      connection,
      state.tasks,
      state.recurrences,
      result.tasks,
      result.recurrences,
    );

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

    await persistCanonicalSet(
      connection,
      state.tasks,
      state.recurrences,
      result.tasks,
      state.recurrences,
    );
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

export async function applySynchronizedCanonicalState(
  connection: JigSqlConnection,
  expectedRevision: number,
  tasks: readonly Task[],
  recurrences: readonly RecurrenceSeries[],
  adoptedHead: string,
): Promise<CanonicalState> {
  assertRecurrenceState(tasks, recurrences);
  if (!Number.isInteger(expectedRevision) || expectedRevision < 0) {
    throw new PersistenceConfigurationError(
      "Expected synchronization revision must be a non-negative integer",
    );
  }

  return withTransaction(connection, async () => {
    const current = await readCanonicalState(connection);
    if (current.revision !== expectedRevision) {
      throw new StaleRevisionError(current.revision);
    }

    await persistCanonicalSet(
      connection,
      current.tasks,
      current.recurrences,
      tasks,
      recurrences,
    );
    const revision = current.revision + 1;
    await connection.execute(
      `UPDATE app_metadata
       SET
         revision = ?,
         last_adopted_head = ?,
         pending_sync = 1
       WHERE singleton = 1`,
      [revision, adoptedHead],
    );

    return {
      revision,
      tasks: await readTasks(connection),
      recurrences: await readRecurrences(connection),
    };
  });
}

export async function adoptCanonicalSnapshot(
  connection: JigSqlConnection,
  tasks: readonly Task[],
  recurrences: readonly RecurrenceSeries[],
  adoptedHead: string | null,
): Promise<CanonicalState> {
  assertRecurrenceState(tasks, recurrences);

  return withTransaction(connection, async () => {
    const current = await readCanonicalState(connection);
    await persistCanonicalSet(
      connection,
      current.tasks,
      current.recurrences,
      tasks,
      recurrences,
    );

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

    return {
      revision,
      tasks: await readTasks(connection),
      recurrences: await readRecurrences(connection),
    };
  });
}
