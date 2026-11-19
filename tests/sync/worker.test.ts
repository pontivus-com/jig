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
import {
  serializeSnapshot,
  type PortableSnapshot,
  type PortableRemoteObservation,
} from "../../src/shell/git";
import {
  applyTaskCommand,
  markExported,
  readCanonicalState,
  readMetadata,
  type JigSqlConnection,
} from "../../src/persistence/sqlite";
import { initializeDatabase } from "../../src/shell/sqlite-bun";
import {
  createSyncController,
  type SyncEffects,
} from "../../src/shell/sync";

const DATASET_ID =
  "018f47f0-7b5c-7d4d-8e2b-9c3aa11f0001";
const REMOTE_LOCATION =
  "https://example.invalid/personal/jig-data.git";
const BASE_HEAD = "a".repeat(40);
let root = "";
let db: JigSqlConnection;

function task(
  suffix: string,
  title: string,
  updatedAt = "2026-11-19T01:00:00.000Z",
): Task {
  return {
    id: `018f47f0-7b5c-7d4d-8e2b-${suffix.padStart(12, "0")}`,
    title,
    scheduled_date: "2026-11-19",
    position: 0,
    priority: "NORMAL",
    context: null,
    reference: null,
    note: null,
    reminder_time: null,
    recurrence_series_id: null,
    recurrence_occurrence_date: null,
    completed_at: null,
    created_at: "2026-11-19T01:00:00.000Z",
    updated_at: updatedAt,
  };
}

function configuredStatus(
  remoteState:
    | "pending"
    | "retrying"
    | "synchronized"
    | "sync-issue",
  localGit: "pending" | "committed" | "issue" = "committed",
) {
  return {
    local_git: localGit,
    remote: {
      state: remoteState,
      remote_name: "origin",
      remote_location: REMOTE_LOCATION,
    },
  } as const;
}

function localOnlyStatus(
  localGit: "pending" | "committed" | "issue" = "committed",
) {
  return {
    local_git: localGit,
    remote: {
      state: "not-configured",
      remote_name: null,
      remote_location: null,
    },
  } as const;
}

interface FakeRepository {
  localHead: string;
  localSnapshot: PortableSnapshot;
  remoteHead: string | null;
  remoteSnapshot: PortableSnapshot | null;
  baseHead: string;
  baseSnapshot: PortableSnapshot;
  remoteRewritten: boolean;
  lineage:
    | "equal"
    | "remote-ahead"
    | "local-ahead"
    | "diverged"
    | "unknown";
}

function selectedAuthority() {
  return {
    state: "selected",
    remote: {
      name: "origin",
      location: REMOTE_LOCATION,
    },
    fetch_location: REMOTE_LOCATION,
    push_location: REMOTE_LOCATION,
  } as const;
}

function observation(
  repo: FakeRepository,
): PortableRemoteObservation {
  if (repo.remoteHead === null || repo.remoteSnapshot === null) {
    return {
      authority: selectedAuthority(),
      remote_state: "absent",
      local_head: repo.localHead,
      previous_remote_head: null,
      remote_head: null,
      remote_rewritten: false,
      lineage: "unknown",
      remote_snapshot: null,
      base: null,
    };
  }
  return {
    authority: selectedAuthority(),
    remote_state: "present",
    local_head: repo.localHead,
    previous_remote_head: repo.baseHead,
    remote_head: repo.remoteHead,
    remote_rewritten: repo.remoteRewritten,
    lineage:
      repo.localHead === repo.remoteHead
        ? "equal"
        : repo.lineage,
    remote_snapshot: repo.remoteSnapshot,
    base: {
      head: repo.baseHead,
      snapshot: repo.baseSnapshot,
    },
  };
}

function fakeEffects(
  repo: FakeRepository,
  options: {
    readonly noRemote?: boolean;
    readonly conflict?: boolean;
    readonly pushRace?: {
      readonly head: string;
      readonly snapshot: PortableSnapshot;
    };
  } = {},
): {
  readonly effects: SyncEffects;
  readonly writes: { count: number };
  readonly pushes: { count: number };
  readonly observes: { count: number };
} {
  const writes = { count: 0 };
  const pushes = { count: 0 };
  const observes = { count: 0 };
  let raced = false;

  return {
    writes,
    pushes,
    observes,
    effects: {
      ensurePortableData: async () => undefined,
      readCurrentSnapshot: async () => ({
        head: repo.localHead,
        snapshot: repo.localSnapshot,
      }),
      writeSnapshot: async (
        _config,
        snapshot,
        revision,
      ) => {
        writes.count += 1;
        repo.localHead =
          revision.toString(16).padStart(40, "0");
        repo.localSnapshot = snapshot;
        repo.lineage = "local-ahead";
        return repo.localHead;
      },
      observeRemote: async () => {
        observes.count += 1;
        if (options.noRemote === true) {
          return {
            authority: { state: "none" },
            remote_state: "none",
            local_head: repo.localHead,
            previous_remote_head: null,
            remote_head: null,
            remote_rewritten: false,
            lineage: "unknown",
            remote_snapshot: null,
            base: null,
          };
        }
        return observation(repo);
      },
      alignLocal: async (
        _config,
        expectedHead,
        targetHead,
      ) => {
        if (repo.localHead !== expectedHead) {
          throw new Error("synthetic local ref race");
        }
        if (
          repo.remoteHead !== targetHead ||
          repo.remoteSnapshot === null
        ) {
          throw new Error("synthetic target missing");
        }
        repo.localHead = targetHead;
        repo.localSnapshot = repo.remoteSnapshot;
        repo.lineage = "equal";
      },
      push: async () => {
        pushes.count += 1;
        if (
          options.pushRace !== undefined &&
          !raced
        ) {
          raced = true;
          repo.remoteHead = options.pushRace.head;
          repo.remoteSnapshot = options.pushRace.snapshot;
          repo.lineage = "remote-ahead";
          return { status: "sync-issue", retryable: true };
        }
        if (options.conflict === true) {
          return { status: "sync-issue", retryable: false };
        }
        repo.remoteHead = repo.localHead;
        repo.remoteSnapshot = repo.localSnapshot;
        repo.lineage = "equal";
        return { status: "synchronized", retryable: false };
      },
      networkEnvironment: async () => ({}),
    },
  };
}

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-19T00:00:00.000Z"));
  root = await mkdtemp(join(tmpdir(), "jig-worker-"));
  db = await initializeDatabase(
    join(root, "jig.sqlite"),
    DATASET_ID,
  );
});

afterEach(async () => {
  vi.useRealTimers();
  await db.close();
  await rm(root, { recursive: true, force: true });
});

describe("convergence-first synchronization worker", () => {
  it("adopts a supported remote fast-forward without creating a stale-base commit", async () => {
    const base = serializeSnapshot([], DATASET_ID);
    const remote = serializeSnapshot(
      [task("201", "Android change")],
      DATASET_ID,
    );
    await markExported(db, 0, BASE_HEAD);
    const repo: FakeRepository = {
      localHead: BASE_HEAD,
      localSnapshot: base,
      remoteHead: "b".repeat(40),
      remoteSnapshot: remote,
      baseHead: BASE_HEAD,
      baseSnapshot: base,
      remoteRewritten: false,
      lineage: "remote-ahead",
    };
    const { effects, writes } = fakeEffects(repo);
    const controller = createSyncController(
      db,
      { repository_path: root },
      effects,
    );

    expect(await controller.trigger()).toStrictEqual(
      configuredStatus("synchronized"),
    );
    expect(writes.count).toBe(0);
    expect(
      (await readCanonicalState(db)).tasks.map(
        (candidate) => candidate.title,
      ),
    ).toEqual(["Android change"]);
    expect(await readMetadata(db)).toMatchObject({
      pending_sync: false,
      last_exported_head: "b".repeat(40),
    });
    controller.stop();
  });

  it("reconciles non-conflicting local SQLite and remote changes before committing", async () => {
    const base = serializeSnapshot([], DATASET_ID);
    const remote = serializeSnapshot(
      [task("202", "Remote task")],
      DATASET_ID,
    );
    await markExported(db, 0, BASE_HEAD);
    await applyTaskCommand(
      db,
      {
        type: "create",
        title: "Local task",
        scheduled_date: "2026-11-19",
      },
      0,
      "2026-11-19T02:00:00.000Z",
      () =>
        "018f47f0-7b5c-7d4d-8e2b-000000000203",
    );
    const repo: FakeRepository = {
      localHead: BASE_HEAD,
      localSnapshot: base,
      remoteHead: "c".repeat(40),
      remoteSnapshot: remote,
      baseHead: BASE_HEAD,
      baseSnapshot: base,
      remoteRewritten: false,
      lineage: "remote-ahead",
    };
    const { effects, writes, pushes } = fakeEffects(repo);
    const controller = createSyncController(
      db,
      { repository_path: root },
      effects,
    );

    expect(await controller.trigger()).toStrictEqual(
      configuredStatus("synchronized"),
    );
    expect(writes.count).toBe(1);
    expect(pushes.count).toBe(1);
    expect(
      (await readCanonicalState(db)).tasks
        .map((candidate) => candidate.title)
        .sort(),
    ).toEqual(["Local task", "Remote task"]);
    controller.stop();
  });

  it("re-observes a push race rather than blindly retrying the rejected push", async () => {
    const base = serializeSnapshot([], DATASET_ID);
    await markExported(db, 0, BASE_HEAD);
    await applyTaskCommand(
      db,
      {
        type: "create",
        title: "Desktop pending",
        scheduled_date: "2026-11-19",
      },
      0,
      "2026-11-19T02:00:00.000Z",
      () =>
        "018f47f0-7b5c-7d4d-8e2b-000000000204",
    );
    const repo: FakeRepository = {
      localHead: BASE_HEAD,
      localSnapshot: base,
      remoteHead: BASE_HEAD,
      remoteSnapshot: base,
      baseHead: BASE_HEAD,
      baseSnapshot: base,
      remoteRewritten: false,
      lineage: "equal",
    };
    const racedRemote = serializeSnapshot(
      [task("205", "Other client")],
      DATASET_ID,
    );
    const { effects, observes, pushes } = fakeEffects(repo, {
      pushRace: {
        head: "d".repeat(40),
        snapshot: racedRemote,
      },
    });
    const controller = createSyncController(
      db,
      { repository_path: root },
      effects,
    );

    expect(await controller.trigger()).toStrictEqual(
      configuredStatus("synchronized"),
    );
    expect(pushes.count).toBe(2);
    expect(observes.count).toBeGreaterThanOrEqual(3);
    expect(
      (await readCanonicalState(db)).tasks
        .map((candidate) => candidate.title)
        .sort(),
    ).toEqual(["Desktop pending", "Other client"]);
    controller.stop();
  });

  it("settles a semantic conflict into a quiescent sync issue without writing", async () => {
    const baseTask = task("206", "Base");
    const base = serializeSnapshot([baseTask], DATASET_ID);
    await markExported(db, 0, BASE_HEAD);
    await applyTaskCommand(
      db,
      {
        type: "edit",
        task_id: baseTask.id,
        changes: { title: "Local title" },
      },
      0,
      "2026-11-19T02:00:00.000Z",
    ).catch(() => undefined);

    // Seed canonical SQLite with the base first, then create the local edit.
    const seededDb = db;
    await seededDb.close();
    await rm(root, { recursive: true, force: true });
    root = await mkdtemp(join(tmpdir(), "jig-worker-conflict-"));
    db = await initializeDatabase(
      join(root, "jig.sqlite"),
      DATASET_ID,
    );
    await applyTaskCommand(
      db,
      {
        type: "create",
        title: "Base",
        scheduled_date: "2026-11-19",
      },
      0,
      "2026-11-19T01:00:00.000Z",
      () => baseTask.id,
    );
    await markExported(db, 1, BASE_HEAD);
    await applyTaskCommand(
      db,
      {
        type: "edit",
        task_id: baseTask.id,
        changes: { title: "Local title" },
      },
      1,
      "2026-11-19T02:00:00.000Z",
    );
    const remote = serializeSnapshot(
      [{
        ...baseTask,
        title: "Remote title",
        updated_at: "2026-11-19T03:00:00.000Z",
      }],
      DATASET_ID,
    );
    const repo: FakeRepository = {
      localHead: BASE_HEAD,
      localSnapshot: base,
      remoteHead: "e".repeat(40),
      remoteSnapshot: remote,
      baseHead: BASE_HEAD,
      baseSnapshot: base,
      remoteRewritten: false,
      lineage: "remote-ahead",
    };
    const { effects, writes, pushes } = fakeEffects(repo);
    const controller = createSyncController(
      db,
      { repository_path: root },
      effects,
    );

    expect(await controller.trigger()).toStrictEqual(
      configuredStatus("sync-issue", "pending"),
    );
    expect(writes.count).toBe(0);
    expect(pushes.count).toBe(0);
    await vi.advanceTimersByTimeAsync(59_999);
    expect(pushes.count).toBe(0);
    controller.stop();
  });

  it("keeps local-only repositories healthy and exports pending work without remote I/O", async () => {
    const base = serializeSnapshot([], DATASET_ID);
    await markExported(db, 0, BASE_HEAD);
    await applyTaskCommand(
      db,
      {
        type: "create",
        title: "Local only",
        scheduled_date: "2026-11-19",
      },
      0,
      "2026-11-19T02:00:00.000Z",
      () =>
        "018f47f0-7b5c-7d4d-8e2b-000000000207",
    );
    const repo: FakeRepository = {
      localHead: BASE_HEAD,
      localSnapshot: base,
      remoteHead: null,
      remoteSnapshot: null,
      baseHead: BASE_HEAD,
      baseSnapshot: base,
      remoteRewritten: false,
      lineage: "unknown",
    };
    const { effects, writes, pushes } = fakeEffects(repo, {
      noRemote: true,
    });
    const controller = createSyncController(
      db,
      { repository_path: root },
      effects,
    );

    expect(await controller.trigger()).toStrictEqual(
      localOnlyStatus(),
    );
    expect(writes.count).toBe(1);
    expect(pushes.count).toBe(0);
    controller.stop();
  });
});
