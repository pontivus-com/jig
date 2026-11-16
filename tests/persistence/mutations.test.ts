import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  applyTaskCommand,
  initializeDatabase,
  openDatabase,
  readCanonicalState,
  rollForwardOutstandingInDatabase,
  StaleRevisionError,
} from "../../src/shell/sqlite";

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
let db: Database;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "jig-mutations-"));
  db = initializeDatabase(join(root, "jig.sqlite"), DATASET_ID);
});

afterEach(async () => {
  db.close();
  await rm(root, { recursive: true, force: true });
});

describe("transactional canonical persistence", () => {
  it("increments the revision exactly once per successful mutation", () => {
    const created = applyTaskCommand(
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
    expect(readCanonicalState(db).revision).toBe(1);

    const completed = applyTaskCommand(
      db,
      { type: "complete", task_id: IDS[0] },
      1,
      TIMES[1],
    );
    expect(completed.revision).toBe(2);
    expect(readCanonicalState(db).revision).toBe(2);
  });

  it("rejects a stale revision without mutation", () => {
    applyTaskCommand(
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
    const before = readCanonicalState(db);

    expect(() =>
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
    ).toThrow(StaleRevisionError);

    expect(readCanonicalState(db)).toStrictEqual(before);
  });

  it("rolls back cross-date writes and revision on injected SQL failure", () => {
    applyTaskCommand(
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
    applyTaskCommand(
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

    const before = readCanonicalState(db);
    db.exec(`
      CREATE TRIGGER inject_move_failure
      BEFORE UPDATE OF scheduled_date ON task
      WHEN NEW.scheduled_date = '2026-11-17'
      BEGIN
        SELECT RAISE(ABORT, 'injected move failure');
      END;
    `);

    expect(() =>
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
    ).toThrow(/injected move failure/);

    expect(readCanonicalState(db)).toStrictEqual(before);
  });

  it("persists rollover atomically with one revision and pending sync", () => {
    applyTaskCommand(
      db,
      {
        type: "create",
        title: "Old one",
        scheduled_date: "2026-11-14",
        reminder_time: "10:00",
      },
      0,
      TIMES[0],
      () => IDS[0],
    );
    applyTaskCommand(
      db,
      {
        type: "create",
        title: "Today one",
        scheduled_date: "2026-11-16",
      },
      1,
      TIMES[1],
      () => IDS[1],
    );

    const result = rollForwardOutstandingInDatabase(
      db,
      "2026-11-16",
      TIMES[2],
    );

    expect(result).toStrictEqual({
      revision: 3,
      moved_task_ids: [IDS[0]],
    });
    const state = readCanonicalState(db);
    expect(
      state.tasks
        .filter((task) => task.scheduled_date === "2026-11-16")
        .sort((left, right) => (left.position ?? 0) - (right.position ?? 0))
        .map((task) => ({
          title: task.title,
          position: task.position,
          reminder: task.reminder_time,
        })),
    ).toStrictEqual([
      { title: "Old one", position: 0, reminder: "10:00" },
      { title: "Today one", position: 1, reminder: null },
    ]);
  });

  it("does not increment revision when rollover has nothing to move", () => {
    applyTaskCommand(
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

    expect(
      rollForwardOutstandingInDatabase(
        db,
        "2026-11-16",
        TIMES[1],
      ),
    ).toStrictEqual({
      revision: 1,
      moved_task_ids: [],
    });
    expect(readCanonicalState(db).revision).toBe(1);
  });

  it("restarts from the exact committed canonical state", () => {
    applyTaskCommand(
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
    const before = readCanonicalState(db);
    db.close();

    db = openDatabase(join(root, "jig.sqlite"));

    expect(readCanonicalState(db)).toStrictEqual(before);
  });
});
