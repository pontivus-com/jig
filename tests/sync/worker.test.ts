import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
  readCanonicalState,
  readMetadata,
  type JigSqlConnection,
} from "../../src/persistence/sqlite";
import { initializeDatabase } from "../../src/shell/sqlite-bun";
import {
  createSyncController,
  SyncAuthenticationError,
  type SyncEffects,
} from "../../src/shell/sync";

const DATASET_ID = "018f47f0-7b5c-7d4d-8e2b-9c3aa11f0001";
let root = "";
let db: JigSqlConnection;

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
  readonly networkEnvironments: Array<
    Readonly<Record<string, string>> | undefined
  >;
} {
  const commitCalls = { count: 0 };
  const pushCalls = { count: 0 };
  const networkEnvironments: Array<
    Readonly<Record<string, string>> | undefined
  > = [];
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
    synchronize: async (_config, networkEnvironment) => {
      pushCalls.count += 1;
      networkEnvironments.push(networkEnvironment);
      return pushResults.shift() ?? "synchronized";
    },
    mode: async () =>
      (options.remoteName === undefined ? "origin" : options.remoteName) === null
        ? "local-only"
        : "remote",
  };

  return {
    effects,
    commitCalls,
    pushCalls,
    networkEnvironments,
  };
}

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-16T00:00:00.000Z"));
  root = await mkdtemp(join(tmpdir(), "jig-worker-"));
  db = await initializeDatabase(join(root, "jig.sqlite"), DATASET_ID);
});

afterEach(async () => {
  vi.useRealTimers();
  await db.close();
  await rm(root, { recursive: true, force: true });
});

describe("serialized synchronization worker", () => {
  it("does not claim synchronization merely because a remote target exists", async () => {
    const { effects, pushCalls } = fakeEffects();
    const controller = createSyncController(
      db,
      { repository_path: root },
      effects,
    );

    await controller.start();
    expect(controller.status()).toBe("pending");
    expect(pushCalls.count).toBe(0);

    await vi.advanceTimersByTimeAsync(0);
    expect(pushCalls.count).toBe(1);
    expect(controller.status()).toBe("synchronized");
    controller.stop();
  });

  it("supplies runtime network authentication without persisting it in Git config", async () => {
    const { effects, networkEnvironments } = fakeEffects();
    const controller = createSyncController(
      db,
      {
        repository_path: root,
        get_network_environment: async () => ({
          GIT_ASKPASS: "/tmp/jig-askpass",
          GIT_TERMINAL_PROMPT: "0",
          JIG_GITHUB_ACCESS_TOKEN: "device-token",
        }),
      },
      effects,
    );

    expect(await controller.trigger()).toBe("synchronized");
    expect(networkEnvironments).toStrictEqual([
      {
        GIT_ASKPASS: "/tmp/jig-askpass",
        GIT_TERMINAL_PROMPT: "0",
        JIG_GITHUB_ACCESS_TOKEN: "device-token",
      },
    ]);
    controller.stop();
  });

  it("surfaces managed GitHub credential failure immediately as a sync issue", async () => {
    const { effects, pushCalls } = fakeEffects();
    const controller = createSyncController(
      db,
      {
        repository_path: root,
        get_network_environment: async () => {
          throw new SyncAuthenticationError(
            "GitHub credential is unavailable; reconnect GitHub",
          );
        },
      },
      effects,
    );

    expect(await controller.trigger()).toBe("sync-issue");
    expect(controller.status()).toBe("sync-issue");
    expect(pushCalls.count).toBe(0);
    controller.stop();
  });

  it("debounces a mutation for 3 seconds without blocking the SQLite save", async () => {
    const { effects, commitCalls } = fakeEffects();
    const controller = createSyncController(
      db,
      { repository_path: root },
      effects,
    );
    await controller.start();

    await applyTaskCommand(
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

    expect((await readCanonicalState(db)).revision).toBe(1);
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
      const revision = (await readCanonicalState(db)).revision;
      await applyTaskCommand(
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
    await applyTaskCommand(
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
      (await readCanonicalState(db)).tasks,
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

    expect(await readMetadata(db)).toMatchObject({
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

    expect((await readCanonicalState(db)).tasks).toStrictEqual([remoteTask]);
    expect(await readMetadata(db)).toMatchObject({
      revision: 1,
      last_exported_revision: 1,
      last_exported_head: "b".repeat(40),
      last_adopted_head: "b".repeat(40),
      pending_sync: false,
    });
    controller.stop();
  });
});
