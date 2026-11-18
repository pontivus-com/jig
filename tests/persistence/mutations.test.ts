import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  applyTaskCommand,
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
    expect(readCanonicalState(db).revision).toBe(2);
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

    expect(() =>
      await applyTaskCommand(
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

    expect(() =>
      await applyTaskCommand(
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
    ).toThrow(/injected move failure/);

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
    db.close();

    db = await openDatabase(join(root, "jig.sqlite"));

    expect(await readCanonicalState(db)).toStrictEqual(before);
  });
});
