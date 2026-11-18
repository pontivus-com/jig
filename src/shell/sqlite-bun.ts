import { Database } from "bun:sqlite";
import {
  initializePersistence,
  validateOpenedPersistence,
  type JigSqlConnection,
  type SqlExecutionResult,
  type SqlRow,
  type SqlValue,
} from "../persistence/sqlite";

function executionResult(
  value: { readonly changes?: number; readonly lastInsertRowid?: number | bigint },
): SqlExecutionResult {
  return {
    changes: value.changes ?? 0,
    last_insert_rowid:
      value.lastInsertRowid === undefined
        ? null
        : Number(value.lastInsertRowid),
  };
}

export function bunSqlConnection(database: Database): JigSqlConnection {
  return {
    async execute(sql, bindings = []) {
      if (bindings.length === 0) {
        database.exec(sql);
        return { changes: 0, last_insert_rowid: null };
      }
      return executionResult(database.query(sql).run(...bindings));
    },
    async query(sql, bindings = []) {
      return database.query(sql).all(...bindings) as readonly SqlRow[];
    },
    async begin() {
      database.exec("BEGIN IMMEDIATE;");
    },
    async commit() {
      database.exec("COMMIT;");
    },
    async rollback() {
      database.exec("ROLLBACK;");
    },
    async close() {
      database.close();
    },
  };
}

export async function initializeDatabase(
  path: string,
  datasetId: string,
): Promise<JigSqlConnection> {
  const database = new Database(path, { create: true });
  const connection = bunSqlConnection(database);
  try {
    await initializePersistence(connection, datasetId);
    return connection;
  } catch (error) {
    await connection.close();
    throw error;
  }
}

export async function openDatabase(path: string): Promise<JigSqlConnection> {
  const database = new Database(path);
  const connection = bunSqlConnection(database);
  try {
    await validateOpenedPersistence(connection);
    return connection;
  } catch (error) {
    await connection.close();
    throw error;
  }
}
