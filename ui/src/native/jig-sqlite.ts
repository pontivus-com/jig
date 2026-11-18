import { registerPlugin } from "@capacitor/core";
import {
  initializePersistence,
  validateOpenedPersistence,
  type JigSqlConnection,
  type SqlExecutionResult,
  type SqlRow,
  type SqlValue,
} from "../../../src/persistence/sqlite";

export interface NativeJigSqlitePlugin {
  open(options: {
    readonly path: string;
    readonly create: boolean;
  }): Promise<unknown>;
  execute(options: {
    readonly sql: string;
    readonly bindings: readonly SqlValue[];
  }): Promise<unknown>;
  query(options: {
    readonly sql: string;
    readonly bindings: readonly SqlValue[];
  }): Promise<unknown>;
  begin(): Promise<unknown>;
  commit(): Promise<unknown>;
  rollback(): Promise<unknown>;
  close(): Promise<unknown>;
}

const nativeSqlite = registerPlugin<NativeJigSqlitePlugin>("JigSqlite");

function objectValue(
  value: unknown,
  meaning: string,
): Record<string, unknown> {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw new TypeError(`JigSqlite returned invalid ${meaning}`);
  }
  return Object.fromEntries(Object.entries(value));
}

function sqlValue(value: unknown, meaning: string): SqlValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number"
  ) {
    return value;
  }
  throw new TypeError(
    `JigSqlite returned unsupported value for ${meaning}`,
  );
}

function executionResult(value: unknown): SqlExecutionResult {
  const object = objectValue(value, "execution result");
  const changes = object.changes;
  const lastInsertRowId = object.last_insert_rowid;
  if (
    typeof changes !== "number" ||
    !Number.isInteger(changes) ||
    changes < 0
  ) {
    throw new TypeError("JigSqlite returned invalid change count");
  }
  if (
    lastInsertRowId !== null &&
    (typeof lastInsertRowId !== "number" ||
      !Number.isInteger(lastInsertRowId))
  ) {
    throw new TypeError(
      "JigSqlite returned invalid last insert row id",
    );
  }
  return {
    changes,
    last_insert_rowid: lastInsertRowId,
  };
}

function queryRows(value: unknown): readonly SqlRow[] {
  const object = objectValue(value, "query result");
  if (!Array.isArray(object.rows)) {
    throw new TypeError("JigSqlite returned invalid query rows");
  }
  return object.rows.map((candidate, rowIndex) => {
    const row = objectValue(candidate, `query row ${rowIndex}`);
    return Object.fromEntries(
      Object.entries(row).map(([key, field]) => [
        key,
        sqlValue(field, `query row ${rowIndex} field ${key}`),
      ]),
    );
  });
}

export function createJigSqlConnection(
  plugin: NativeJigSqlitePlugin,
): JigSqlConnection {
  return {
    async execute(sql, bindings = []) {
      return executionResult(
        await plugin.execute({ sql, bindings }),
      );
    },
    async query(sql, bindings = []) {
      return queryRows(
        await plugin.query({ sql, bindings }),
      );
    },
    async begin() {
      await plugin.begin();
    },
    async commit() {
      await plugin.commit();
    },
    async rollback() {
      await plugin.rollback();
    },
    async close() {
      await plugin.close();
    },
  };
}

async function openNativeConnection(
  path: string,
  create: boolean,
): Promise<JigSqlConnection> {
  await nativeSqlite.open({ path, create });
  return createJigSqlConnection(nativeSqlite);
}

export async function initializeNativeDatabase(
  path: string,
  datasetId: string,
): Promise<JigSqlConnection> {
  const database = await openNativeConnection(path, true);
  try {
    await initializePersistence(database, datasetId);
    return database;
  } catch (error) {
    await database.close();
    throw error;
  }
}

export async function openNativeDatabase(
  path: string,
): Promise<JigSqlConnection> {
  const database = await openNativeConnection(path, false);
  try {
    await validateOpenedPersistence(database);
    return database;
  } catch (error) {
    await database.close();
    throw error;
  }
}
