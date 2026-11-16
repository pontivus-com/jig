import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Database } from "bun:sqlite";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { Task } from "../../src/core/task";
import type {
  GitAdapterConfig,
  PortableSnapshot,
} from "../../src/shell/git";
import { serializeSnapshot } from "../../src/shell/git";
import {
  applyTaskCommand,
  initializeDatabase,
  readCanonicalState,
  readMetadata,
} from "../../src/shell/sqlite";
import {
  createSyncController,
  type SyncEffects,
} from "../../src/shell/sync";

const DATASET_ID = "018f47f0-7b5c-7d4d-8e2b-9c3aa11f0001";
let root = "";
let db: Database;

function task(): Task {
  return {
    id: "018f47f0-7b5c-7d4d-8e2b-9c3aa11f0101",
    title: "Remote concrete task",
    scheduled_date: "2026-11-16",
    position: 0,
    priority: "NORMAL",
    context: null,
    reference: null,
    note: null,
    reminder_time: null,
    completed_at: null,
    created_at: "2026-11-16T01:00:00.000Z",
    updated_at: "2026-11-16T01:00:00.000Z",
  };
}

function fakeEffects(options: {
  readonly head?: string | null;
  readonly snapshot?: PortableSnapshot;
  readonly pushResults?: readonly ("synchronized" | "sync-issue")[];
  readonly remoteName?: string | null;
} = {}): {
  readonly effects: SyncEffects;
  readonly commitCalls: { count: number };
  readonly pushCalls: { count: number };
} {
  const commitCalls = { count: 0 };
  const pushCalls = { count: 0 };
  const pushResults = [...(options.pushResults ?? ["synchronized"])];

  const effects: SyncEffects = {
    ensurePortableData: async () => undefined,
    readCurrentSnapshot: async () => {
      const head = options.head ?? null;
      if (head === null) {
        return null;
      }
      if (options.snapshot === undefined) {
        throw new Error("No candidate snapshot");
      }
      return { head, snapshot: options.snapshot };
    },
    writeSnapshot: async (
      _config: GitAdapterConfig,
      _snapshot: PortableSnapshot,
      revision: number,
    ) => {
      commitCalls.count += 1;
      return revision.toString(16).padStart(40, "0");
    },
    synchronize: async () => {
      pushCalls.count += 1;
      return pushResults.shift() ?? "synchronized";
    },
    availability: async () =>
      (options.remoteName === undefined ? "origin" : options.remoteName) === null
        ? "local-only"
        : "synchronized",
  };

  return { effects, commitCalls, pushCalls };
}

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-16T00:00:00.000Z"));
  root = await mkdtemp(join(tmpdir(), "jig-worker-"));
  db = initializeDatabase(join(root, "jig.sqlite"), DATASET_ID);
});

afterEach(async () => {
  vi.useRealTimers();
  db.close();
  await rm(root, { recursive: true, force: true });
});

describe("serialized synchronization worker", () => {
  it("debounces a mutation for 3 seconds without blocking the SQLite save", async () => {
    const { effects, commitCalls } = fakeEffects();
    const controller = createSyncController(
      db,
      { repository_path: root },
      effects,
    );
    await controller.start();

    applyTaskCommand(
      db,
      {
        type: "create",
        title: "Saved now",
        scheduled_date: "2026-11-16",
      },
      0,
      "2026-11-16T00:00:01.000Z",
      () => "018f47f0-7b5c-7d4d-8e2b-9c3aa11f0201",
    );
    controller.notifyMutation();

    expect(readCanonicalState(db).revision).toBe(1);
    expect(commitCalls.count).toBe(0);

    await vi.advanceTimersByTimeAsync(2_999);
    expect(commitCalls.count).toBe(0);

    await vi.advanceTimersByTimeAsync(1);
    expect(commitCalls.count).toBe(1);
    controller.stop();
  });

  it("flushes by the 15-second maximum during continuous edits", async () => {
    const { effects, commitCalls } = fakeEffects();
    const controller = createSyncController(
      db,
      { repository_path: root },
      effects,
    );
    await controller.start();

    for (let index = 0; index < 7; index += 1) {
      const revision = readCanonicalState(db).revision;
      applyTaskCommand(
        db,
        {
          type: "create",
          title: `Task ${index}`,
          scheduled_date: "2026-11-16",
        },
        revision,
        new Date(Date.now() + 1_000).toISOString(),
        () =>
          `018f47f0-7b5c-7d4d-8e2b-9c3aa11f${(300 + index)
            .toString()
            .padStart(4, "0")}`,
      );
      controller.notifyMutation();
      if (index < 6) {
        await vi.advanceTimersByTimeAsync(2_000);
      }
    }

    expect(commitCalls.count).toBe(0);
    await vi.advanceTimersByTimeAsync(2_999);
    expect(commitCalls.count).toBe(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(commitCalls.count).toBe(1);
    controller.stop();
  });

  it("uses fixed retry backoff and resets after success", async () => {
    const { effects, pushCalls } = fakeEffects({
      pushResults: ["sync-issue", "sync-issue", "synchronized"],
    });
    const controller = createSyncController(
      db,
      { repository_path: root },
      effects,
    );

    expect(await controller.trigger()).toBe("sync-issue");
    expect(controller.status()).toBe("retrying");
    expect(pushCalls.count).toBe(1);

    await vi.advanceTimersByTimeAsync(4_999);
    expect(pushCalls.count).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(pushCalls.count).toBe(2);

    await vi.advanceTimersByTimeAsync(9_999);
    expect(pushCalls.count).toBe(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(pushCalls.count).toBe(3);
    expect(controller.status()).toBe("synchronized");

    await vi.advanceTimersByTimeAsync(59_999);
    expect(pushCalls.count).toBe(3);
    await vi.advanceTimersByTimeAsync(1);
    expect(pushCalls.count).toBe(4);
    controller.stop();
  });

  it("recovers commit-succeeded metadata lag from the concrete local snapshot", async () => {
    applyTaskCommand(
      db,
      {
        type: "create",
        title: "Committed before crash",
        scheduled_date: "2026-11-16",
      },
      0,
      "2026-11-16T01:00:00.000Z",
      () => "018f47f0-7b5c-7d4d-8e2b-9c3aa11f0201",
    );
    const snapshot = serializeSnapshot(
      readCanonicalState(db).tasks,
      DATASET_ID,
    );
    const { effects, commitCalls } = fakeEffects({
      head: "a".repeat(40),
      snapshot,
      remoteName: null,
    });
    const controller = createSyncController(
      db,
      { repository_path: root },
      effects,
    );

    await controller.start();

    expect(readMetadata(db)).toMatchObject({
      revision: 1,
      last_exported_revision: 1,
      last_exported_head: "a".repeat(40),
      pending_sync: false,
    });
    expect(commitCalls.count).toBe(0);
    controller.stop();
  });

  it("adopts an externally resolved concrete snapshot only when no local mutation is pending", async () => {
    const remoteTask = task();
    const snapshot = serializeSnapshot([remoteTask], DATASET_ID);
    const { effects } = fakeEffects({
      head: "b".repeat(40),
      snapshot,
    });
    const controller = createSyncController(
      db,
      { repository_path: root },
      effects,
    );

    await controller.start();

    expect(readCanonicalState(db).tasks).toStrictEqual([remoteTask]);
    expect(readMetadata(db)).toMatchObject({
      revision: 1,
      last_exported_revision: 1,
      last_exported_head: "b".repeat(40),
      last_adopted_head: "b".repeat(40),
      pending_sync: false,
    });
    controller.stop();
  });
});
