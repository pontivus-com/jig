import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  adoptCanonicalSnapshot,
  applyTaskCommand,
  markExported,
  readCanonicalState,
  readMetadata,
  rollForwardOutstandingInDatabase,
  StaleRevisionError,
  type JigSqlConnection,
} from "../../src/persistence/sqlite";
import {
  initializeDatabase,
  openDatabase,
} from "../../src/shell/sqlite-bun";

const DATASET_ID = "018f47f0-7b5c-7d4d-8e2b-9c3aa11f0001";
const IDS = [
  "018f47f0-7b5c-7d4d-8e2b-9c3aa11f0101",
  "018f47f0-7b5c-7d4d-8e2b-9c3aa11f0102",
  "018f47f0-7b5c-7d4d-8e2b-9c3aa11f0103",
] as const;
const TIMES = [
  "2026-11-16T01:00:00.000Z",
  "2026-11-16T02:00:00.000Z",
  "2026-11-16T03:00:00.000Z",
  "2026-11-16T04:00:00.000Z",
] as const;

let root = "";
let db: JigSqlConnection;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "jig-mutations-"));
  db = await initializeDatabase(join(root, "jig.sqlite"), DATASET_ID);
});

afterEach(async () => {
  await db.close();
  await rm(root, { recursive: true, force: true });
});

describe("daily rollover persistence", () => {
  it("persists all rolled-forward dates in one revision and marks sync pending", async () => {
    await applyTaskCommand(
      db,
      {
        type: "create",
        title: "Yesterday one",
        scheduled_date: "2026-11-15",
        reminder_time: "10:00",
      },
      0,
      TIMES[0],
      () => IDS[0],
    );
    await applyTaskCommand(
      db,
      {
        type: "create",
        title: "Yesterday two",
        scheduled_date: "2026-11-15",
      },
      1,
      TIMES[1],
      () => IDS[1],
    );
    await applyTaskCommand(
      db,
      {
        type: "create",
        title: "Today existing",
        scheduled_date: "2026-11-16",
      },
      2,
      TIMES[2],
      () => IDS[2],
    );

    const result = await rollForwardOutstandingInDatabase(
      db,
      "2026-11-16",
      TIMES[3],
    );

    expect(result.revision).toBe(4);
    expect(result.moved_task_ids).toEqual([IDS[0], IDS[1]]);
    const state = await readCanonicalState(db);
    expect(state.revision).toBe(4);
    expect(
      state.tasks
        .filter(
          (task) =>
            task.completed_at === null &&
            task.scheduled_date === "2026-11-16",
        )
        .sort(
          (left, right) =>
            (left.position ?? 0) - (right.position ?? 0),
        )
        .map((task) => [task.title, task.reminder_time]),
    ).toEqual([
      ["Yesterday one", "10:00"],
      ["Yesterday two", null],
      ["Today existing", null],
    ]);
    expect((await readMetadata(db)).pending_sync).toBe(true);
  });

  it("does not increment revision when no rollover is required", async () => {
    await applyTaskCommand(
      db,
      {
        type: "create",
        title: "Today",
        scheduled_date: "2026-11-16",
      },
      0,
      TIMES[0],
      () => IDS[0],
    );

    const result = await rollForwardOutstandingInDatabase(
      db,
      "2026-11-16",
      TIMES[1],
    );

    expect(result).toStrictEqual({
      revision: 1,
      moved_task_ids: [],
    });
    expect((await readCanonicalState(db)).revision).toBe(1);
  });

  it("rolls back the entire rollover transaction on SQL failure", async () => {
    await applyTaskCommand(
      db,
      {
        type: "create",
        title: "Will stay yesterday",
        scheduled_date: "2026-11-15",
      },
      0,
      TIMES[0],
      () => IDS[0],
    );
    const before = await readCanonicalState(db);
    await db.execute(`
      CREATE TRIGGER inject_rollover_failure
      BEFORE UPDATE OF scheduled_date ON task
      WHEN NEW.scheduled_date = '2026-11-16'
      BEGIN
        SELECT RAISE(ABORT, 'injected rollover failure');
      END;
    `);

    await expect(
      rollForwardOutstandingInDatabase(
        db,
        "2026-11-16",
        TIMES[1],
      ),
    ).rejects.toThrow(/injected rollover failure/);

    expect(await readCanonicalState(db)).toStrictEqual(before);
  });
});

describe("transactional canonical persistence", () => {
  it("increments the revision exactly once per successful mutation", async () => {
    const created = await applyTaskCommand(
      db,
      {
        type: "create",
        title: "First",
        scheduled_date: "2026-11-16",
      },
      0,
      TIMES[0],
      () => IDS[0],
    );

    expect(created.revision).toBe(1);
    expect((await readCanonicalState(db)).revision).toBe(1);

    const completed = await applyTaskCommand(
      db,
      { type: "complete", task_id: IDS[0] },
      1,
      TIMES[1],
    );
    expect(completed.revision).toBe(2);
    expect((await readCanonicalState(db)).revision).toBe(2);
  });

  it("rejects a stale revision without mutation", async () => {
    await applyTaskCommand(
      db,
      {
        type: "create",
        title: "First",
        scheduled_date: "2026-11-16",
      },
      0,
      TIMES[0],
      () => IDS[0],
    );
    const before = await readCanonicalState(db);

    await expect(
      applyTaskCommand(
        db,
        {
          type: "create",
          title: "Stale",
          scheduled_date: "2026-11-16",
        },
        0,
        TIMES[1],
        () => IDS[1],
      ),
    ).rejects.toThrow(StaleRevisionError);

    expect(await readCanonicalState(db)).toStrictEqual(before);
  });

  it("rolls back cross-date writes and revision on injected SQL failure", async () => {
    await applyTaskCommand(
      db,
      {
        type: "create",
        title: "One",
        scheduled_date: "2026-11-16",
      },
      0,
      TIMES[0],
      () => IDS[0],
    );
    await applyTaskCommand(
      db,
      {
        type: "create",
        title: "Two",
        scheduled_date: "2026-11-17",
      },
      1,
      TIMES[1],
      () => IDS[1],
    );

    const before = await readCanonicalState(db);
    await db.execute(`
      CREATE TRIGGER inject_move_failure
      BEFORE UPDATE OF scheduled_date ON task
      WHEN NEW.scheduled_date = '2026-11-17'
      BEGIN
        SELECT RAISE(ABORT, 'injected move failure');
      END;
    `);

    await expect(
      applyTaskCommand(
        db,
        {
          type: "move",
          task_id: IDS[0],
          destination_date: "2026-11-17",
          destination_index: 1,
        },
        2,
        TIMES[2],
      ),
    ).rejects.toThrow(/injected move failure/);

    expect(await readCanonicalState(db)).toStrictEqual(before);
  });

  it("restarts from the exact committed canonical state", async () => {
    await applyTaskCommand(
      db,
      {
        type: "create",
        title: "Persistent",
        scheduled_date: "2026-11-16",
        priority: "HIGH",
        note: "durable",
      },
      0,
      TIMES[0],
      () => IDS[0],
    );
    const before = await readCanonicalState(db);
    await db.close();

    db = await openDatabase(join(root, "jig.sqlite"));

    expect(await readCanonicalState(db)).toStrictEqual(before);
  });


describe("transactional recurrence persistence", () => {
  it("materializes a recurrence in one revision and survives restart", async () => {
    const ids = [
      "018f47f0-7b5c-7d4d-8e2b-9c3aa11f1001",
      "018f47f0-7b5c-7d4d-8e2b-9c3aa11f1002",
      "018f47f0-7b5c-7d4d-8e2b-9c3aa11f1003",
      "018f47f0-7b5c-7d4d-8e2b-9c3aa11f1004",
    ];
    let index = 0;
    const result = await applyTaskCommand(
      db,
      {
        type: "create",
        title: "Recurring persistence",
        scheduled_date: "2026-11-16",
        reminder_time: "09:00",
        recurrence: {
          pattern: {
            kind: "weekly",
            interval_weeks: 1,
            weekdays: ["MON"],
          },
          end_date: "2026-11-30",
        },
      },
      0,
      "2026-11-16T01:00:00.000Z",
      () => {
        const id = ids[index];
        if (id === undefined) {
          throw new Error("recurrence id fixture exhausted");
        }
        index += 1;
        return id;
      },
    );

    expect(result.revision).toBe(1);
    const before = await readCanonicalState(db);
    expect(before.revision).toBe(1);
    expect(before.recurrences).toHaveLength(1);
    expect(before.tasks).toHaveLength(3);
    expect(
      before.tasks.map((task) => task.recurrence_occurrence_date),
    ).toEqual(["2026-11-16", "2026-11-23", "2026-11-30"]);
    expect((await readMetadata(db)).pending_sync).toBe(true);

    await db.close();
    db = await openDatabase(join(root, "jig.sqlite"));
    expect(await readCanonicalState(db)).toStrictEqual(before);
  });

  it("edits one occurrence without changing sibling content or series config", async () => {
    const ids = [
      "018f47f0-7b5c-7d4d-8e2b-9c3aa11f1101",
      "018f47f0-7b5c-7d4d-8e2b-9c3aa11f1102",
      "018f47f0-7b5c-7d4d-8e2b-9c3aa11f1103",
    ];
    let index = 0;
    await applyTaskCommand(
      db,
      {
        type: "create",
        title: "Independent occurrence",
        scheduled_date: "2026-11-16",
        recurrence: {
          pattern: {
            kind: "weekly",
            interval_weeks: 1,
            weekdays: ["MON"],
          },
          end_date: "2026-11-23",
        },
      },
      0,
      "2026-11-16T01:00:00.000Z",
      () => {
        const id = ids[index];
        if (id === undefined) {
          throw new Error("recurrence id fixture exhausted");
        }
        index += 1;
        return id;
      },
    );
    const before = await readCanonicalState(db);
    const later = before.tasks.find(
      (task) =>
        task.recurrence_occurrence_date === "2026-11-23",
    );
    if (later === undefined) {
      throw new Error("later recurrence fixture missing");
    }

    await applyTaskCommand(
      db,
      {
        type: "edit",
        task_id: later.id,
        changes: {
          title: "Only this occurrence",
          note: "independent",
        },
      },
      1,
      "2026-11-16T02:00:00.000Z",
    );

    const after = await readCanonicalState(db);
    expect(after.revision).toBe(2);
    expect(after.recurrences).toStrictEqual(before.recurrences);
    expect(
      after.tasks.find(
        (task) =>
          task.recurrence_occurrence_date === "2026-11-16",
      )?.title,
    ).toBe("Independent occurrence");
    expect(
      after.tasks.find((task) => task.id === later.id),
    ).toMatchObject({
      title: "Only this occurrence",
      note: "independent",
    });
  });

  it("stops recurrence in one revision while preserving completed History", async () => {
    const ids = [
      "018f47f0-7b5c-7d4d-8e2b-9c3aa11f1201",
      "018f47f0-7b5c-7d4d-8e2b-9c3aa11f1202",
      "018f47f0-7b5c-7d4d-8e2b-9c3aa11f1203",
      "018f47f0-7b5c-7d4d-8e2b-9c3aa11f1204",
    ];
    let index = 0;
    await applyTaskCommand(
      db,
      {
        type: "create",
        title: "Stop series",
        scheduled_date: "2026-11-16",
        recurrence: {
          pattern: {
            kind: "weekly",
            interval_weeks: 1,
            weekdays: ["MON"],
          },
          end_date: "2026-11-30",
        },
      },
      0,
      "2026-11-16T01:00:00.000Z",
      () => {
        const id = ids[index];
        if (id === undefined) {
          throw new Error("recurrence id fixture exhausted");
        }
        index += 1;
        return id;
      },
    );
    let state = await readCanonicalState(db);
    const completed = state.tasks.find(
      (task) =>
        task.recurrence_occurrence_date === "2026-11-16",
    );
    const invoking = state.tasks.find(
      (task) =>
        task.recurrence_occurrence_date === "2026-11-23",
    );
    if (completed === undefined || invoking === undefined) {
      throw new Error("stop recurrence fixtures missing");
    }

    await applyTaskCommand(
      db,
      { type: "complete", task_id: completed.id },
      1,
      "2026-11-16T18:00:00.000Z",
    );
    const stopped = await applyTaskCommand(
      db,
      {
        type: "edit",
        task_id: invoking.id,
        changes: {},
        recurrence: null,
      },
      2,
      "2026-11-17T01:00:00.000Z",
    );
    expect(stopped.revision).toBe(3);

    state = await readCanonicalState(db);
    expect(state.revision).toBe(3);
    expect(
      state.tasks.find((task) => task.id === invoking.id),
    ).toMatchObject({
      recurrence_series_id: null,
      recurrence_occurrence_date: null,
      completed_at: null,
    });
    expect(
      state.tasks.find((task) => task.id === completed.id),
    ).toMatchObject({
      completed_at: "2026-11-16T18:00:00.000Z",
    });
    expect(
      state.tasks.filter(
        (task) =>
          task.id !== invoking.id &&
          task.completed_at === null,
      ),
    ).toEqual([]);
    expect(state.recurrences).toHaveLength(1);
  });
});
});


describe("synchronized canonical application", () => {
  it("requires the exact observed revision and leaves the applied state pending until Git export", async () => {
    const before = await readCanonicalState(db);
    const synchronizedTask = {
      id: IDS[0],
      title: "Remote adopted",
      scheduled_date: "2026-11-16",
      position: 0,
      priority: "NORMAL" as const,
      context: null,
      reference: null,
      note: null,
      reminder_time: null,
      recurrence_series_id: null,
      recurrence_occurrence_date: null,
      completed_at: null,
      created_at: TIMES[0],
      updated_at: TIMES[0],
    };

    const applied = await adoptCanonicalSnapshot(
      db,
      [synchronizedTask],
      [],
      "a".repeat(40),
      before.revision,
    );

    expect(applied.revision).toBe(before.revision + 1);
    expect(applied.tasks).toStrictEqual([synchronizedTask]);
    expect(await readMetadata(db)).toMatchObject({
      revision: before.revision + 1,
      last_adopted_head: "a".repeat(40),
      last_exported_revision: 0,
      last_exported_head: null,
      pending_sync: true,
    });
  });

  it("cannot overwrite a Task mutation that lands after remote observation", async () => {
    const observedRevision = (await readCanonicalState(db)).revision;
    await applyTaskCommand(
      db,
      {
        type: "create",
        title: "Newer local mutation",
        scheduled_date: "2026-11-16",
      },
      observedRevision,
      TIMES[0],
      () => IDS[0],
    );
    const before = await readCanonicalState(db);

    await expect(
      adoptCanonicalSnapshot(
        db,
        [],
        [],
        "b".repeat(40),
        observedRevision,
      ),
    ).rejects.toThrow(StaleRevisionError);

    expect(await readCanonicalState(db)).toStrictEqual(before);
  });
});


describe("export metadata truthfulness", () => {
  it("keeps a newer SQLite mutation pending when Git represents only an older revision", async () => {
    await applyTaskCommand(
      db,
      {
        type: "create",
        title: "Revision one",
        scheduled_date: "2026-11-16",
      },
      0,
      TIMES[0],
      () => IDS[0],
    );
    await applyTaskCommand(
      db,
      {
        type: "create",
        title: "Revision two",
        scheduled_date: "2026-11-16",
      },
      1,
      TIMES[1],
      () => IDS[1],
    );

    await markExported(db, 1, "c".repeat(40));

    expect(await readMetadata(db)).toMatchObject({
      revision: 2,
      last_exported_revision: 1,
      last_exported_head: "c".repeat(40),
      pending_sync: true,
    });
  });
});
