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
  adoptCanonicalSnapshot,
  applyTaskCommand,
  markExported,
  readCanonicalState,
  readMetadata,
  type JigSqlConnection,
} from "../../src/persistence/sqlite";
import {
  serializeSnapshot,
  type PortableSnapshot,
} from "../../src/portable";
import type {
  PortableRemoteObservation,
  SynchronizationRemote,
} from "../../src/shell/git";
import {
  createSyncController,
  type SyncEffects,
} from "../../src/shell/sync";
import { initializeDatabase } from "../../src/shell/sqlite-bun";

const DATASET_ID =
  "018f47f0-7b5c-7d4d-8e2b-9c3aa11f0001";
const BASE_HEAD = "a".repeat(40);
const REMOTE: SynchronizationRemote = {
  name: "origin",
  location: "https://example.invalid/team/planning.git",
};

let root = "";
let db: JigSqlConnection;

function task(
  suffix: string,
  title: string,
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
    updated_at: "2026-11-19T01:00:00.000Z",
  };
}

function filesEqual(
  left: PortableSnapshot,
  right: PortableSnapshot,
): boolean {
  if (left.files.size !== right.files.size) {
    return false;
  }
  for (const [path, value] of left.files) {
    if (right.files.get(path) !== value) {
      return false;
    }
  }
  return true;
}

type RemoteMode =
  | "none"
  | "ambiguous"
  | "absent"
  | "unsafe"
  | "present";

interface FakeRepository {
  mode: RemoteMode;
  localHead: string;
  localSnapshot: PortableSnapshot;
  remoteHead: string | null;
  remoteSnapshot: PortableSnapshot | null;
  remoteRewritten: boolean;
  lineage:
    | "equal"
    | "remote-ahead"
    | "local-ahead"
    | "diverged"
    | "unknown";
  previouslySynchronized: boolean;
}

interface FakeOptions {
  readonly pushRace?: {
    readonly head: string;
    readonly snapshot: PortableSnapshot;
  };
  readonly ambiguousPushSuccess?: boolean;
  readonly pushFailure?: boolean;
}

function observation(
  repo: FakeRepository,
): PortableRemoteObservation {
  switch (repo.mode) {
    case "none":
      return {
        state: "none",
        local_head: repo.localHead,
      };
    case "ambiguous":
      return {
        state: "ambiguous",
        local_head: repo.localHead,
      };
    case "absent":
      return {
        state: "absent",
        remote: REMOTE,
        local_head: repo.localHead,
        previously_synchronized:
          repo.previouslySynchronized,
      };
    case "unsafe":
      return {
        state: "unsafe",
        remote: REMOTE,
        local_head: repo.localHead,
      };
    case "present":
      if (
        repo.remoteHead === null ||
        repo.remoteSnapshot === null
      ) {
        throw new Error("present fake remote is incomplete");
      }
      return {
        state: "present",
        remote: REMOTE,
        local_head: repo.localHead,
        remote_head: repo.remoteHead,
        remote_rewritten: repo.remoteRewritten,
        lineage:
          repo.localHead === repo.remoteHead
            ? "equal"
            : repo.lineage,
        remote_snapshot: repo.remoteSnapshot,
      };
  }
}

function fakeEffects(
  repo: FakeRepository,
  options: FakeOptions = {},
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
        if (!filesEqual(repo.localSnapshot, snapshot)) {
          repo.localHead =
            revision.toString(16).padStart(40, "0");
          repo.localSnapshot = snapshot;
        }
        return repo.localHead;
      },
      observeRemote: async () => {
        observes.count += 1;
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
          throw new Error("synthetic remote target missing");
        }
        repo.localHead = targetHead;
        repo.localSnapshot = repo.remoteSnapshot;
        repo.lineage = "equal";
      },
      push: async () => {
        pushes.count += 1;

        if (options.pushRace !== undefined && !raced) {
          raced = true;
          repo.mode = "present";
          repo.remoteHead = options.pushRace.head;
          repo.remoteSnapshot = options.pushRace.snapshot;
          repo.lineage = "diverged";
          return {
            status: "sync-issue",
            retryable: true,
          };
        }

        if (options.ambiguousPushSuccess === true && !raced) {
          raced = true;
          repo.mode = "present";
          repo.remoteHead = repo.localHead;
          repo.remoteSnapshot = repo.localSnapshot;
          repo.lineage = "equal";
          return {
            status: "sync-issue",
            retryable: true,
          };
        }

        if (options.pushFailure === true) {
          return {
            status: "sync-issue",
            retryable: true,
          };
        }

        repo.mode = "present";
        repo.remoteHead = repo.localHead;
        repo.remoteSnapshot = repo.localSnapshot;
        repo.lineage = "equal";
        return {
          status: "synchronized",
          retryable: false,
        };
      },
      networkEnvironment: async () => ({}),
    },
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
      remote_name: REMOTE.name,
      remote_location: REMOTE.location,
    },
  } as const;
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

describe("cross-installation synchronization worker", () => {
  it("keeps a repository without a remote healthy and exports local pending work", async () => {
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
      "2026-11-19T01:00:00.000Z",
      () =>
        "018f47f0-7b5c-7d4d-8e2b-000000000101",
    );

    const repo: FakeRepository = {
      mode: "none",
      localHead: BASE_HEAD,
      localSnapshot: base,
      remoteHead: null,
      remoteSnapshot: null,
      remoteRewritten: false,
      lineage: "unknown",
      previouslySynchronized: false,
    };
    const { effects, writes, pushes } = fakeEffects(repo);
    const controller = createSyncController(
      db,
      { repository_path: root },
      effects,
    );

    expect(await controller.trigger()).toMatchObject({
      local_git: "committed",
      remote: { state: "not-configured" },
    });
    expect(writes.count).toBe(1);
    expect(pushes.count).toBe(0);
  });

  it("reports equal confirmed heads as synchronized", async () => {
    const base = serializeSnapshot([], DATASET_ID);
    await markExported(db, 0, BASE_HEAD);
    const repo: FakeRepository = {
      mode: "present",
      localHead: BASE_HEAD,
      localSnapshot: base,
      remoteHead: BASE_HEAD,
      remoteSnapshot: base,
      remoteRewritten: false,
      lineage: "equal",
      previouslySynchronized: true,
    };
    const { effects } = fakeEffects(repo);
    const controller = createSyncController(
      db,
      { repository_path: root },
      effects,
    );

    expect(await controller.trigger()).toStrictEqual(
      configuredStatus("synchronized"),
    );
    expect(await readMetadata(db)).toMatchObject({
      last_adopted_head: BASE_HEAD,
    });
  });

  it("adopts a remote fast-forward before creating any local snapshot", async () => {
    const base = serializeSnapshot([], DATASET_ID);
    const remote = serializeSnapshot(
      [task("201", "Android change")],
      DATASET_ID,
    );
    await markExported(db, 0, BASE_HEAD);
    const repo: FakeRepository = {
      mode: "present",
      localHead: BASE_HEAD,
      localSnapshot: base,
      remoteHead: "b".repeat(40),
      remoteSnapshot: remote,
      remoteRewritten: false,
      lineage: "remote-ahead",
      previouslySynchronized: true,
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
    expect(writes.count).toBe(0);
    expect(pushes.count).toBe(0);
    expect(
      (await readCanonicalState(db)).tasks.map(
        (candidate) => candidate.title,
      ),
    ).toEqual(["Android change"]);
  });

  it("pushes a local-ahead portable head through an ordinary push", async () => {
    const base = serializeSnapshot([], DATASET_ID);
    const localHead = "c".repeat(40);
    await markExported(db, 0, localHead);
    const repo: FakeRepository = {
      mode: "present",
      localHead,
      localSnapshot: base,
      remoteHead: BASE_HEAD,
      remoteSnapshot: base,
      remoteRewritten: false,
      lineage: "local-ahead",
      previouslySynchronized: true,
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
    expect(writes.count).toBe(0);
    expect(pushes.count).toBe(1);
  });

  it("SYNC-E1 stops before committing pending SQLite on a stale local head", async () => {
    const base = serializeSnapshot([], DATASET_ID);
    const remote = serializeSnapshot(
      [task("202", "Remote change")],
      DATASET_ID,
    );
    await markExported(db, 0, BASE_HEAD);
    await applyTaskCommand(
      db,
      {
        type: "create",
        title: "Local pending",
        scheduled_date: "2026-11-19",
      },
      0,
      "2026-11-19T02:00:00.000Z",
      () =>
        "018f47f0-7b5c-7d4d-8e2b-000000000202",
    );

    const repo: FakeRepository = {
      mode: "present",
      localHead: BASE_HEAD,
      localSnapshot: base,
      remoteHead: "d".repeat(40),
      remoteSnapshot: remote,
      remoteRewritten: false,
      lineage: "remote-ahead",
      previouslySynchronized: true,
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
    expect(
      (await readCanonicalState(db)).tasks[0]?.title,
    ).toBe("Local pending");
  });

  it("SYNC-E2 re-observes after a rejected push and never repeats that push in the same cycle", async () => {
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
        "018f47f0-7b5c-7d4d-8e2b-000000000203",
    );
    const racedRemote = serializeSnapshot(
      [task("204", "Other client")],
      DATASET_ID,
    );
    const repo: FakeRepository = {
      mode: "present",
      localHead: BASE_HEAD,
      localSnapshot: base,
      remoteHead: BASE_HEAD,
      remoteSnapshot: base,
      remoteRewritten: false,
      lineage: "equal",
      previouslySynchronized: true,
    };
    const { effects, pushes, observes } = fakeEffects(repo, {
      pushRace: {
        head: "e".repeat(40),
        snapshot: racedRemote,
      },
    });
    const controller = createSyncController(
      db,
      { repository_path: root },
      effects,
    );

    expect(await controller.trigger()).toMatchObject({
      remote: { state: "sync-issue" },
    });
    expect(pushes.count).toBe(1);
    expect(observes.count).toBe(2);
    expect(
      (await readCanonicalState(db)).tasks[0]?.title,
    ).toBe("Desktop pending");
  });

  it("SYNC-E3 treats an accepted push with a lost acknowledgement as synchronized after re-observation", async () => {
    const base = serializeSnapshot([], DATASET_ID);
    await markExported(db, 0, BASE_HEAD);
    await applyTaskCommand(
      db,
      {
        type: "create",
        title: "Possibly accepted",
        scheduled_date: "2026-11-19",
      },
      0,
      "2026-11-19T02:00:00.000Z",
      () =>
        "018f47f0-7b5c-7d4d-8e2b-000000000205",
    );
    const repo: FakeRepository = {
      mode: "present",
      localHead: BASE_HEAD,
      localSnapshot: base,
      remoteHead: BASE_HEAD,
      remoteSnapshot: base,
      remoteRewritten: false,
      lineage: "equal",
      previouslySynchronized: true,
    };
    const { effects, pushes, observes } = fakeEffects(repo, {
      ambiguousPushSuccess: true,
    });
    const controller = createSyncController(
      db,
      { repository_path: root },
      effects,
    );

    expect(await controller.trigger()).toStrictEqual(
      configuredStatus("synchronized"),
    );
    expect(pushes.count).toBe(1);
    expect(observes.count).toBe(2);
  });

  it("SYNC-E4 preserves pending SQLite when credentials are unavailable before remote observation", async () => {
    const base = serializeSnapshot([], DATASET_ID);
    await markExported(db, 0, BASE_HEAD);
    await applyTaskCommand(
      db,
      {
        type: "create",
        title: "Offline safe",
        scheduled_date: "2026-11-19",
      },
      0,
      "2026-11-19T02:00:00.000Z",
      () =>
        "018f47f0-7b5c-7d4d-8e2b-000000000207",
    );

    const repo: FakeRepository = {
      mode: "present",
      localHead: BASE_HEAD,
      localSnapshot: base,
      remoteHead: BASE_HEAD,
      remoteSnapshot: base,
      remoteRewritten: false,
      lineage: "equal",
      previouslySynchronized: true,
    };
    const fake = fakeEffects(repo);
    const controller = createSyncController(
      db,
      { repository_path: root },
      {
        ...fake.effects,
        networkEnvironment: async () => null,
      },
    );

    expect(await controller.trigger()).toMatchObject({
      local_git: "pending",
      remote: { state: "sync-issue" },
    });
    expect(fake.writes.count).toBe(0);
    expect(fake.pushes.count).toBe(0);
    expect(await readMetadata(db)).toMatchObject({
      revision: 1,
      last_exported_revision: 0,
      pending_sync: true,
    });
  });

  it("SYNC-E5 finishes SQLite-adopted remote state without creating another snapshot", async () => {
    const base = serializeSnapshot([], DATASET_ID);
    const remoteTask = task("208", "Adopted before restart");
    const remote = serializeSnapshot(
      [remoteTask],
      DATASET_ID,
    );
    const remoteHead = "8".repeat(40);
    await markExported(db, 0, BASE_HEAD);
    const applied = await adoptCanonicalSnapshot(
      db,
      [remoteTask],
      [],
      remoteHead,
      0,
    );
    expect(applied.revision).toBe(1);

    const repo: FakeRepository = {
      mode: "present",
      localHead: BASE_HEAD,
      localSnapshot: base,
      remoteHead,
      remoteSnapshot: remote,
      remoteRewritten: false,
      lineage: "remote-ahead",
      previouslySynchronized: true,
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
    expect(writes.count).toBe(0);
    expect(pushes.count).toBe(0);
    expect(repo.localHead).toBe(remoteHead);
    expect(await readMetadata(db)).toMatchObject({
      revision: 1,
      last_exported_revision: 1,
      last_exported_head: remoteHead,
      pending_sync: false,
    });
  });

  it("SYNC-E5 repairs commit-before-metadata lag without creating a duplicate commit", async () => {
    await applyTaskCommand(
      db,
      {
        type: "create",
        title: "Already in Git",
        scheduled_date: "2026-11-19",
      },
      0,
      "2026-11-19T02:00:00.000Z",
      () =>
        "018f47f0-7b5c-7d4d-8e2b-000000000206",
    );
    const state = await readCanonicalState(db);
    const committed = serializeSnapshot(
      state.tasks,
      DATASET_ID,
      state.recurrences,
    );
    const head = "f".repeat(40);
    const repo: FakeRepository = {
      mode: "present",
      localHead: head,
      localSnapshot: committed,
      remoteHead: head,
      remoteSnapshot: committed,
      remoteRewritten: false,
      lineage: "equal",
      previouslySynchronized: true,
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
    expect(await readMetadata(db)).toMatchObject({
      last_exported_revision: state.revision,
      last_exported_head: head,
      pending_sync: false,
    });
  });

  it("SYNC-E6 treats ambiguous, unsafe and divergent remote state as non-destructive attention", async () => {
    const base = serializeSnapshot([], DATASET_ID);
    await markExported(db, 0, BASE_HEAD);

    for (const mode of ["ambiguous", "unsafe"] as const) {
      const repo: FakeRepository = {
        mode,
        localHead: BASE_HEAD,
        localSnapshot: base,
        remoteHead: null,
        remoteSnapshot: null,
        remoteRewritten: false,
        lineage: "unknown",
        previouslySynchronized: true,
      };
      const { effects, writes, pushes } = fakeEffects(repo);
      const controller = createSyncController(
        db,
        { repository_path: root },
        effects,
      );

      expect(await controller.trigger()).toMatchObject({
        remote: { state: "sync-issue" },
      });
      expect(writes.count).toBe(0);
      expect(pushes.count).toBe(0);
    }

    const divergent: FakeRepository = {
      mode: "present",
      localHead: BASE_HEAD,
      localSnapshot: base,
      remoteHead: "9".repeat(40),
      remoteSnapshot: base,
      remoteRewritten: false,
      lineage: "diverged",
      previouslySynchronized: true,
    };
    const divergentEffects = fakeEffects(divergent);
    const controller = createSyncController(
      db,
      { repository_path: root },
      divergentEffects.effects,
    );

    expect(await controller.trigger()).toMatchObject({
      remote: { state: "sync-issue" },
    });
    expect(divergentEffects.writes.count).toBe(0);
    expect(divergentEffects.pushes.count).toBe(0);
  });
});
