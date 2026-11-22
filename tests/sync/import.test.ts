import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Task } from "../../src/core/task";
import {
  adoptCanonicalSnapshot,
  applyTaskCommand as applyTaskCommandAtLocalDate,
  readCanonicalState,
  type JigSqlConnection,
} from "../../src/persistence/sqlite";

function applyTaskCommand(
  connection: Parameters<typeof applyTaskCommandAtLocalDate>[0],
  command: Parameters<typeof applyTaskCommandAtLocalDate>[1],
  expectedRevision: number,
  now: string,
  createId: () => string = crypto.randomUUID,
): ReturnType<typeof applyTaskCommandAtLocalDate> {
  const currentLocalDate =
    command.type === "create"
      ? command.scheduled_date
      : now.slice(0, 10);
  return applyTaskCommandAtLocalDate(
    connection,
    command,
    expectedRevision,
    currentLocalDate,
    now,
    createId,
  );
}

import { initializeDatabase } from "../../src/shell/sqlite-bun";
import {
  serializeSnapshot,
  validateSnapshot,
} from "../../src/core/portable";

const DATASET_ID = "018f47f0-7b5c-7d4d-8e2b-9c3aa11f0001";
let root = "";
let db: JigSqlConnection;

function snapshotTask(idSuffix: string, title: string, position: number): Task {
  return {
    id: `018f47f0-7b5c-7d4d-8e2b-9c3aa11f${idSuffix}`,
    title,
    scheduled_date: "2026-11-16",
    position,
    priority: "NORMAL",
    context: null,
    reference: null,
    note: null,
    reminder_time: null,
    recurrence_series_id: null,
    recurrence_occurrence_date: null,
    completed_at: null,
    created_at: "2026-11-16T01:00:00.000Z",
    updated_at: "2026-11-16T01:00:00.000Z",
  };
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "jig-import-"));
  db = await initializeDatabase(join(root, "jig.sqlite"), DATASET_ID);
});

afterEach(async () => {
  await db.close();
  await rm(root, { recursive: true, force: true });
});

describe("complete-snapshot adoption", () => {
  it("adopts canonical values and deletion by absence atomically", async () => {
    await applyTaskCommand(
      db,
      {
        type: "create",
        title: "Local only",
        scheduled_date: "2026-11-15",
      },
      0,
      "2026-11-16T01:00:00.000Z",
      () => "018f47f0-7b5c-7d4d-8e2b-9c3aa11f0999",
    );

    const remote = snapshotTask("0101", "Remote", 0);
    const snapshot = validateSnapshot(
      serializeSnapshot([remote], DATASET_ID).files,
      DATASET_ID,
    );
    const adopted = await adoptCanonicalSnapshot(
      db,
      snapshot.tasks,
      snapshot.recurrences,
      "0123456789012345678901234567890123456789",
    );

    expect(adopted.tasks).toStrictEqual([remote]);
    expect((await readCanonicalState(db)).tasks).toStrictEqual([remote]);
  });

  it("rejects invalid candidate data before SQLite mutation", async () => {
    const before = await readCanonicalState(db);
    const bad = snapshotTask("0101", "Bad", 3);

    expect(() =>
      validateSnapshot(
        new Map(
          serializeSnapshot(
            [{ ...bad, position: 0 }],
            DATASET_ID,
          ).files,
        ).set(
          `tasks/${bad.id}.json`,
          `${JSON.stringify(bad, null, 2)}\n`,
        ),
        DATASET_ID,
      ),
    ).toThrow();

    expect(await readCanonicalState(db)).toStrictEqual(before);
  });

  it("rolls back an interrupted adoption and can retry", async () => {
    const remote = snapshotTask("0101", "Remote", 0);
    const snapshot = validateSnapshot(
      serializeSnapshot([remote], DATASET_ID).files,
      DATASET_ID,
    );
    const before = await readCanonicalState(db);

    await db.execute(`
      CREATE TRIGGER inject_import_failure
      BEFORE INSERT ON task
      BEGIN
        SELECT RAISE(ABORT, 'injected import failure');
      END;
    `);

    await expect(
      adoptCanonicalSnapshot(
        db,
        snapshot.tasks,
        snapshot.recurrences,
        "head-a",
      ),
    ).rejects.toThrow(/injected import failure/);
    expect(await readCanonicalState(db)).toStrictEqual(before);

    await db.execute("DROP TRIGGER inject_import_failure");
    expect(
      (await adoptCanonicalSnapshot(
        db,
        snapshot.tasks,
        snapshot.recurrences,
        "head-a",
      )).tasks,
    ).toStrictEqual([remote]);
  });
});
