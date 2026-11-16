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
