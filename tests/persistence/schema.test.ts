import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  initializeDatabase,
  openDatabase,
  readMetadata,
  SQLITE_SCHEMA_VERSION,
} from "../../src/shell/sqlite";

const roots: string[] = [];
const DATASET_ID = "018f47f0-7b5c-7d4d-8e2b-9c3aa11f0001";

async function databasePath(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "jig-schema-"));
  roots.push(root);
  return join(root, "jig.sqlite");
}

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) =>
      rm(root, { recursive: true, force: true }),
    ),
  );
});

describe("SQLite schema and metadata", () => {
  it("initializes idempotently with WAL and stable dataset identity", async () => {
    const path = await databasePath();

    const first = initializeDatabase(path, DATASET_ID);
    expect(
      first.query("PRAGMA journal_mode").get() as { journal_mode: string },
    ).toEqual({ journal_mode: "wal" });
    expect(readMetadata(first)).toMatchObject({
      schema_version: SQLITE_SCHEMA_VERSION,
      dataset_id: DATASET_ID,
      revision: 0,
      last_exported_revision: 0,
      pending_sync: false,
    });
    first.close();

    const second = initializeDatabase(path, DATASET_ID);
    expect(readMetadata(second).dataset_id).toBe(DATASET_ID);
    second.close();

    const reopened = openDatabase(path);
    expect(readMetadata(reopened).dataset_id).toBe(DATASET_ID);
    reopened.close();
  });

  it("migrates v1 metadata without carrying Git topology into persistence", async () => {
    const path = await databasePath();
    const { Database } = await import("bun:sqlite");
    const legacy = new Database(path, { create: true });
    legacy.exec(`
      CREATE TABLE task (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        scheduled_date TEXT NOT NULL,
        position INTEGER,
        priority TEXT NOT NULL,
        context TEXT,
        reference TEXT,
        note TEXT,
        reminder_time TEXT,
        completed_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE app_metadata (
        singleton INTEGER PRIMARY KEY,
        schema_version INTEGER NOT NULL,
        dataset_id TEXT NOT NULL,
        revision INTEGER NOT NULL,
        last_exported_revision INTEGER NOT NULL,
        last_exported_head TEXT,
        last_adopted_head TEXT,
        data_ref TEXT NOT NULL,
        pending_sync INTEGER NOT NULL
      );
      CREATE TABLE reminder_delivery (
        delivery_key TEXT PRIMARY KEY,
        delivered_at TEXT NOT NULL
      );
      INSERT INTO app_metadata VALUES (
        1,
        1,
        '018f47f0-7b5c-7d4d-8e2b-9c3aa11f0001',
        3,
        2,
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        'refs/heads/jig-data',
        1
      );
      INSERT INTO task VALUES (
        '018f47f0-7b5c-7d4d-8e2b-9c3aa11f0101',
        'Preserved task',
        '2026-11-16',
        0,
        'NORMAL',
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        '2026-11-16T00:00:00.000Z',
        '2026-11-16T00:00:00.000Z'
      );
    `);
    legacy.close();

    const migrated = openDatabase(path);
    expect(readMetadata(migrated)).toMatchObject({
      schema_version: SQLITE_SCHEMA_VERSION,
      dataset_id: DATASET_ID,
      revision: 3,
      last_exported_revision: 2,
      last_exported_head: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      last_adopted_head: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      pending_sync: true,
    });
    const columns = migrated
      .query("PRAGMA table_info(app_metadata)")
      .all() as Array<{ name: string }>;
    expect(columns.map((column) => column.name)).not.toContain("data_ref");
    expect(migrated.query("SELECT title FROM task").get()).toEqual({
      title: "Preserved task",
    });
    migrated.close();
  });

  it("rejects an incompatible schema version rather than guessing", async () => {
    const path = await databasePath();
    const db = initializeDatabase(path, DATASET_ID);
    db.query(
      "UPDATE app_metadata SET schema_version = 999 WHERE singleton = 1",
    ).run();
    db.close();

    expect(() => openDatabase(path)).toThrow(
      /Unsupported SQLite schema version 999/,
    );
  });

  it("rejects a different configured dataset identity", async () => {
    const path = await databasePath();
    initializeDatabase(path, DATASET_ID).close();

    expect(() =>
      initializeDatabase(
        path,
        "018f47f0-7b5c-7d4d-8e2b-9c3aa11f0002",
      ),
    ).toThrow(/dataset identity/);
  });
});
