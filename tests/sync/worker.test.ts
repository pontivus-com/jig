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
  applyTaskCommand as applyTaskCommandAtLocalDate,
  markExported,
  readCanonicalState,
  readMetadata,
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

import {
  serializeSnapshot,
  type PortableSnapshot,
} from "../../src/core/portable";
import {
  deriveJigDataDateOrders,
  jigDataConflictKey,
  type JigDataConflictCase,
  type JigDataResolution,
} from "../../src/core/synchronization-recovery";
import type {
  PortableRemoteObservation,
  SynchronizationRemote,
} from "../../src/shell/git/remote";
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


const CONFLICT_ANCESTOR_HEAD = "1".repeat(40);
const CONFLICT_LOCAL_HEAD = "2".repeat(40);
const CONFLICT_REMOTE_HEAD = "3".repeat(40);
const CONFLICT_CANDIDATE_HEAD = "4".repeat(40);

function localConflictResolution(
  conflictCase: JigDataConflictCase,
): JigDataResolution {
  const conflict = conflictCase.conflicts[0];
  if (conflict === undefined) {
    throw new Error("expected one synthetic synchronization conflict");
  }
  const choices = [{
    conflict_key: jigDataConflictKey(conflict),
    side: "local" as const,
  }];
  const dateOrders = deriveJigDataDateOrders(
    conflictCase,
    choices,
  );
  if (dateOrders === null) {
    throw new Error("expected synthetic conflict date-order review");
  }
  return {
    ancestor_head: conflictCase.ancestor_head,
    local_head: conflictCase.local_head,
    remote_head: conflictCase.remote_head,
    expected_revision: conflictCase.expected_revision,
    choices,
    date_orders: dateOrders,
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
  readonly alignFailure?: boolean;
  readonly observeFailure?: boolean;
  readonly writeFailure?: boolean;
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
        unsafe_reason: "invalid-snapshot",
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
      readSnapshotAtRef: async (
        _config,
        ref,
        _datasetId,
      ) => {
        if (ref === repo.localHead) return repo.localSnapshot;
        if (
          repo.remoteHead !== null &&
          repo.remoteSnapshot !== null &&
          ref === repo.remoteHead
        ) {
          return repo.remoteSnapshot;
        }
        throw new Error("synthetic recovery snapshot is unavailable");
      },
      readRecoveryCandidateHead: async () => null,
      recoveryCandidateParents: async () => {
        throw new Error("synthetic recovery candidate is unavailable");
      },
      recoveryCommitterTimestampSeconds: async () => 0,
      uniqueRecoveryMergeBase: async () => null,
      writeRecoveryCandidate: async () => {
        throw new Error("synthetic recovery candidate construction is unavailable");
      },
      deleteRecoveryCandidate: async () => undefined,
      compareAndSetPortableHead: async (
        _config,
        expectedHead,
        targetHead,
      ) => {
        if (repo.localHead !== expectedHead) {
          throw new Error("synthetic recovery local ref race");
        }
        repo.localHead = targetHead;
      },
      writeSnapshot: async (
        _config,
        snapshot,
        revision,
      ) => {
        writes.count += 1;
        if (options.writeFailure === true) {
          throw new Error("synthetic local export failure");
        }
        if (!filesEqual(repo.localSnapshot, snapshot)) {
          repo.localHead =
            revision.toString(16).padStart(40, "0");
          repo.localSnapshot = snapshot;
        }
        return repo.localHead;
      },
      observeRemote: async () => {
        observes.count += 1;
        if (options.observeFailure === true) {
          throw new Error("synthetic transport outage");
        }
        return observation(repo);
      },
      alignLocal: async (
        _config,
        expectedHead,
        targetHead,
      ) => {
        if (
          options.alignFailure === true ||
          repo.localHead !== expectedHead
        ) {
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
    expect(controller.diagnostics()).toMatchObject({
      phase: "idle",
      reason: null,
      retryable: null,
      attempt_count: 0,
      local_head: "aaaaaaaaaaaa",
      remote_head: "aaaaaaaaaaaa",
      last_adopted_head: "aaaaaaaaaaaa",
      lineage: "equal",
      remote_name: "origin",
      remote_location: REMOTE.location,
      recovery_attempted: false,
      recovery_outcome: null,
      error_summary: null,
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
    expect(controller.diagnostics()).toMatchObject({
      phase: "observe-remote",
      reason: "authentication",
      retryable: false,
      attempt_count: 1,
      last_attempt_at: "2026-11-19T00:00:00.000Z",
      next_retry_at: null,
      recovery_attempted: false,
      recovery_outcome: null,
      error_summary: "Git authentication is unavailable",
    });
  });

  it("SYNC-E4 exports accepted local planning before retrying a transport outage", async () => {
    const base = serializeSnapshot([], DATASET_ID);
    await markExported(db, 0, BASE_HEAD);
    await applyTaskCommand(
      db,
      {
        type: "create",
        title: "Transport-outage safe",
        scheduled_date: "2026-11-19",
      },
      0,
      "2026-11-19T02:05:00.000Z",
      () =>
        "018f47f0-7b5c-7d4d-8e2b-000000000209",
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
    const fake = fakeEffects(repo, { observeFailure: true });
    const controller = createSyncController(
      db,
      { repository_path: root },
      fake.effects,
    );

    expect(await controller.trigger()).toMatchObject({
      local_git: "committed",
      remote: { state: "retrying" },
    });
    expect(fake.writes.count).toBe(1);
    expect(fake.pushes.count).toBe(0);
    expect(await readMetadata(db)).toMatchObject({
      revision: 1,
      last_exported_revision: 1,
      pending_sync: false,
    });
    expect(controller.diagnostics()).toMatchObject({
      phase: "observe-remote",
      reason: "transport",
      retryable: true,
      attempt_count: 1,
      last_attempt_at: "2026-11-19T00:00:00.000Z",
      next_retry_at: "2026-11-19T00:00:05.000Z",
      recovery_attempted: false,
      recovery_outcome: null,
      error_summary: "synthetic transport outage",
    });
  });

  it("diagnoses a local portable export failure at the export boundary", async () => {
    const base = serializeSnapshot([], DATASET_ID);
    await markExported(db, 0, BASE_HEAD);
    await applyTaskCommand(
      db,
      {
        type: "create",
        title: "Pending export",
        scheduled_date: "2026-11-19",
      },
      0,
      "2026-11-19T02:10:00.000Z",
      () =>
        "018f47f0-7b5c-7d4d-8e2b-000000000210",
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
    const fake = fakeEffects(repo, { writeFailure: true });
    const controller = createSyncController(
      db,
      { repository_path: root },
      fake.effects,
    );

    expect(await controller.trigger()).toMatchObject({
      local_git: "issue",
    });
    expect(controller.diagnostics()).toMatchObject({
      phase: "export-local",
      reason: "local-export-failed",
      retryable: true,
      attempt_count: 1,
      last_attempt_at: "2026-11-19T00:00:00.000Z",
      next_retry_at: "2026-11-19T00:00:05.000Z",
      error_summary: "synthetic local export failure",
    });
    expect(fake.pushes.count).toBe(0);
  });


  async function semanticConflictHarness(): Promise<{
    readonly controller: ReturnType<typeof createSyncController>;
    readonly repo: FakeRepository;
    readonly conflictCase: JigDataConflictCase;
    readonly resolution: JigDataResolution;
    readonly candidateBuildHook: {
      current: null | (() => Promise<void> | void);
    };
    readonly candidateWrites: () => number;
    readonly candidateDeletes: () => number;
    readonly observations: () => number;
  }> {
    const ancestorTask = task("301", "Shared conflict base");
    const localTask: Task = {
      ...ancestorTask,
      title: "Local conflict",
      updated_at: "2026-11-19T01:01:00.000Z",
    };
    const remoteTask: Task = {
      ...ancestorTask,
      title: "Remote conflict",
      updated_at: "2026-11-19T01:02:00.000Z",
    };
    const ancestor = serializeSnapshot(
      [ancestorTask],
      DATASET_ID,
    );
    const local = serializeSnapshot([localTask], DATASET_ID);
    const remote = serializeSnapshot([remoteTask], DATASET_ID);

    const adopted = await adoptCanonicalSnapshot(
      db,
      [localTask],
      [],
      CONFLICT_LOCAL_HEAD,
    );
    expect(adopted.revision).toBe(1);

    const repo: FakeRepository = {
      mode: "present",
      localHead: CONFLICT_LOCAL_HEAD,
      localSnapshot: local,
      remoteHead: CONFLICT_REMOTE_HEAD,
      remoteSnapshot: remote,
      remoteRewritten: false,
      lineage: "diverged",
      previouslySynchronized: true,
    };
    const fake = fakeEffects(repo);
    const candidateBuildHook: {
      current: null | (() => Promise<void> | void);
    } = { current: null };
    let writes = 0;
    let deletes = 0;
    const effects: SyncEffects = {
      ...fake.effects,
      readSnapshotAtRef: async (
        _config,
        ref,
        _datasetId,
      ) => {
        if (ref === CONFLICT_ANCESTOR_HEAD) return ancestor;
        if (ref === repo.localHead) return repo.localSnapshot;
        if (
          repo.remoteHead !== null &&
          repo.remoteSnapshot !== null &&
          ref === repo.remoteHead
        ) {
          return repo.remoteSnapshot;
        }
        throw new Error("synthetic conflict snapshot is unavailable");
      },
      uniqueRecoveryMergeBase: async () =>
        CONFLICT_ANCESTOR_HEAD,
      writeRecoveryCandidate: async () => {
        writes += 1;
        await candidateBuildHook.current?.();
        return CONFLICT_CANDIDATE_HEAD;
      },
      deleteRecoveryCandidate: async (
        _config,
        _datasetId,
        expectedHead,
      ) => {
        expect(expectedHead).toBe(CONFLICT_CANDIDATE_HEAD);
        deletes += 1;
      },
    };
    const controller = createSyncController(
      db,
      { repository_path: root },
      effects,
    );

    expect(await controller.trigger()).toMatchObject({
      local_git: "committed",
      remote: { state: "sync-issue" },
    });
    const conflictCase =
      controller.readSynchronizationConflict();
    if (conflictCase === null) {
      throw new Error("expected synthetic synchronization conflict");
    }

    return {
      controller,
      repo,
      conflictCase,
      resolution: localConflictResolution(conflictCase),
      candidateBuildHook,
      candidateWrites: () => writes,
      candidateDeletes: () => deletes,
      observations: () => fake.observes.count,
    };
  }

  it("rejects a resolver draft when SQLite revision changes while it is open", async () => {
    const harness = await semanticConflictHarness();
    const observationsBeforeResolution = harness.observations();
    const state = await readCanonicalState(db);
    await applyTaskCommand(
      db,
      {
        type: "create",
        title: "Concurrent local mutation",
        scheduled_date: "2026-11-19",
      },
      state.revision,
      "2026-11-19T01:03:00.000Z",
      () =>
        "018f47f0-7b5c-7d4d-8e2b-000000000302",
    );

    expect(
      await harness.controller.resolveSynchronizationConflict(
        harness.resolution,
      ),
    ).toMatchObject({
      remote: { state: "sync-issue" },
    });
    expect(harness.candidateWrites()).toBe(0);
    expect(
      (await readCanonicalState(db)).tasks.map(
        (candidate) => candidate.title,
      ),
    ).toContain("Concurrent local mutation");
    expect(harness.observations()).toBeGreaterThan(
      observationsBeforeResolution,
    );
    expect(
      harness.controller.readSynchronizationConflict(),
    ).toBeNull();
  });

  it("rejects a resolver draft when the local portable head changes while it is open", async () => {
    const harness = await semanticConflictHarness();
    const changedLocalHead = "5".repeat(40);
    harness.repo.localHead = changedLocalHead;

    expect(
      await harness.controller.resolveSynchronizationConflict(
        harness.resolution,
      ),
    ).toMatchObject({
      remote: { state: "sync-issue" },
    });
    expect(harness.candidateWrites()).toBe(0);
    const fresh =
      harness.controller.readSynchronizationConflict();
    expect(fresh).not.toBeNull();
    expect(fresh?.local_head).toBe(changedLocalHead);
    expect(fresh?.local_head).not.toBe(
      harness.conflictCase.local_head,
    );
  });

  it("aborts a user-resolved candidate when SQLite revision changes during candidate construction", async () => {
    const harness = await semanticConflictHarness();
    harness.candidateBuildHook.current = async () => {
      const state = await readCanonicalState(db);
      await applyTaskCommand(
        db,
        {
          type: "create",
          title: "Mutation during candidate build",
          scheduled_date: "2026-11-19",
        },
        state.revision,
        "2026-11-19T01:04:00.000Z",
        () =>
          "018f47f0-7b5c-7d4d-8e2b-000000000303",
      );
    };

    expect(
      await harness.controller.resolveSynchronizationConflict(
        harness.resolution,
      ),
    ).toMatchObject({
      remote: { state: "sync-issue" },
    });
    expect(harness.candidateWrites()).toBe(1);
    expect(harness.candidateDeletes()).toBe(1);
    expect(
      (await readCanonicalState(db)).tasks.map(
        (candidate) => candidate.title,
      ),
    ).toContain("Mutation during candidate build");
  });

  it("aborts a user-resolved candidate when the local ref changes during candidate construction", async () => {
    const harness = await semanticConflictHarness();
    const changedLocalHead = "6".repeat(40);
    harness.candidateBuildHook.current = () => {
      harness.repo.localHead = changedLocalHead;
    };

    expect(
      await harness.controller.resolveSynchronizationConflict(
        harness.resolution,
      ),
    ).toMatchObject({
      remote: { state: "sync-issue" },
    });
    expect(harness.candidateWrites()).toBe(1);
    expect(harness.candidateDeletes()).toBe(1);
    expect(
      (await readCanonicalState(db)).tasks[0],
    ).toMatchObject({ title: "Local conflict" });
    expect(
      harness.controller.readSynchronizationConflict()?.local_head,
    ).toBe(changedLocalHead);
  });

  it("pushes an already accepted recovery candidate after restart without creating a duplicate snapshot", async () => {
    const candidateTask = task(
      "304",
      "Accepted recovery before push",
    );
    const candidateSnapshot = serializeSnapshot(
      [candidateTask],
      DATASET_ID,
    );
    const remoteHead = "7".repeat(40);
    const remoteSnapshot = serializeSnapshot([], DATASET_ID);

    const adopted = await adoptCanonicalSnapshot(
      db,
      [candidateTask],
      [],
      CONFLICT_CANDIDATE_HEAD,
    );
    expect(adopted.revision).toBe(1);

    const repo: FakeRepository = {
      mode: "present",
      localHead: CONFLICT_CANDIDATE_HEAD,
      localSnapshot: candidateSnapshot,
      remoteHead,
      remoteSnapshot,
      remoteRewritten: false,
      lineage: "local-ahead",
      previouslySynchronized: true,
    };
    const fake = fakeEffects(repo);
    const controller = createSyncController(
      db,
      { repository_path: root },
      fake.effects,
    );

    expect(await controller.trigger()).toStrictEqual(
      configuredStatus("synchronized"),
    );
    expect(fake.writes.count).toBe(0);
    expect(fake.pushes.count).toBe(1);
    expect(repo.remoteHead).toBe(CONFLICT_CANDIDATE_HEAD);
    expect(await readMetadata(db)).toMatchObject({
      revision: 1,
      last_exported_revision: 1,
      last_exported_head: CONFLICT_CANDIDATE_HEAD,
      last_adopted_head: CONFLICT_CANDIDATE_HEAD,
      pending_sync: false,
    });
  });

  it("discards a private recovery candidate left before SQLite adoption", async () => {
    const base = serializeSnapshot([], DATASET_ID);
    const candidateHead = "c".repeat(40);
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
    const fake = fakeEffects(repo);
    let recoveryCandidate: string | null = candidateHead;
    let deletes = 0;
    const effects: SyncEffects = {
      ...fake.effects,
      readRecoveryCandidateHead: async () => recoveryCandidate,
      deleteRecoveryCandidate: async (
        _config,
        _datasetId,
        expectedHead,
      ) => {
        expect(expectedHead).toBe(candidateHead);
        recoveryCandidate = null;
        deletes += 1;
      },
    };
    const controller = createSyncController(
      db,
      { repository_path: root },
      effects,
    );

    expect(await controller.trigger()).toStrictEqual(
      configuredStatus("synchronized"),
    );
    expect(deletes).toBe(1);
    expect(recoveryCandidate).toBeNull();
    expect(fake.writes.count).toBe(0);
    expect(fake.pushes.count).toBe(0);
    expect(await readMetadata(db)).toMatchObject({
      revision: 0,
      last_exported_revision: 0,
      last_exported_head: BASE_HEAD,
      pending_sync: false,
    });
  });

  it("resumes a recovery candidate after the local ref moved but before markExported", async () => {
    const remoteHead = "b".repeat(40);
    const candidateHead = "c".repeat(40);
    const candidateTask = task("218", "Recovered before restart");
    const candidateSnapshot = serializeSnapshot(
      [candidateTask],
      DATASET_ID,
    );
    const remoteSnapshot = serializeSnapshot([], DATASET_ID);

    await markExported(db, 0, BASE_HEAD);
    const adopted = await adoptCanonicalSnapshot(
      db,
      [candidateTask],
      [],
      candidateHead,
      0,
    );
    expect(adopted.revision).toBe(1);
    expect(await readMetadata(db)).toMatchObject({
      revision: 1,
      last_exported_revision: 0,
      last_exported_head: BASE_HEAD,
      last_adopted_head: candidateHead,
      pending_sync: true,
    });

    const repo: FakeRepository = {
      mode: "present",
      localHead: candidateHead,
      localSnapshot: candidateSnapshot,
      remoteHead,
      remoteSnapshot,
      remoteRewritten: false,
      lineage: "local-ahead",
      previouslySynchronized: true,
    };
    const fake = fakeEffects(repo);
    let recoveryCandidate: string | null = candidateHead;
    let deletes = 0;
    const effects: SyncEffects = {
      ...fake.effects,
      readRecoveryCandidateHead: async () => recoveryCandidate,
      recoveryCandidateParents: async (
        _config,
        expectedCandidate,
      ) => {
        expect(expectedCandidate).toBe(candidateHead);
        return [BASE_HEAD, remoteHead];
      },
      deleteRecoveryCandidate: async (
        _config,
        _datasetId,
        expectedHead,
      ) => {
        expect(expectedHead).toBe(candidateHead);
        recoveryCandidate = null;
        deletes += 1;
      },
    };
    const controller = createSyncController(
      db,
      { repository_path: root },
      effects,
    );

    expect(await controller.trigger()).toStrictEqual(
      configuredStatus("synchronized"),
    );
    expect(deletes).toBe(1);
    expect(recoveryCandidate).toBeNull();
    expect(fake.writes.count).toBe(0);
    expect(fake.pushes.count).toBe(1);
    expect(repo.localHead).toBe(candidateHead);
    expect(repo.remoteHead).toBe(candidateHead);
    expect(await readMetadata(db)).toMatchObject({
      revision: 1,
      last_exported_revision: 1,
      last_exported_head: candidateHead,
      last_adopted_head: candidateHead,
      pending_sync: false,
    });
    expect(controller.diagnostics()).toMatchObject({
      phase: "idle",
      reason: null,
      recovery_attempted: true,
      recovery_outcome: "resumed",
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

  it("SYNC-E5 keeps an incompatible local-ref race in attention without pushing", async () => {
    const base = serializeSnapshot([], DATASET_ID);
    const remoteTask = task("209", "Adopted but not aligned");
    const remote = serializeSnapshot(
      [remoteTask],
      DATASET_ID,
    );
    const remoteHead = "7".repeat(40);
    await markExported(db, 0, BASE_HEAD);
    await adoptCanonicalSnapshot(
      db,
      [remoteTask],
      [],
      remoteHead,
      0,
    );

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
    const fake = fakeEffects(repo, {
      alignFailure: true,
    });
    const controller = createSyncController(
      db,
      { repository_path: root },
      fake.effects,
    );

    expect(await controller.trigger()).toMatchObject({
      remote: { state: "sync-issue" },
    });
    expect(fake.writes.count).toBe(0);
    expect(fake.pushes.count).toBe(0);

    expect(await controller.trigger()).toMatchObject({
      remote: { state: "sync-issue" },
    });
    expect(fake.pushes.count).toBe(0);
    expect(
      (await readCanonicalState(db)).tasks[0]?.title,
    ).toBe("Adopted but not aligned");
    expect(controller.diagnostics()).toMatchObject({
      phase: "adopt-remote",
      reason: "ref-race",
      retryable: false,
      attempt_count: 2,
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

    for (const [mode, expectedReason] of [
      ["ambiguous", "remote-ambiguous"],
      ["unsafe", "invalid-snapshot"],
    ] as const) {
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
      expect(controller.diagnostics()).toMatchObject({
        phase: "classify",
        reason: expectedReason,
        retryable: false,
        attempt_count: 1,
        local_head: "aaaaaaaaaaaa",
      });
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
    expect(controller.diagnostics()).toMatchObject({
      phase: "recover-divergence",
      reason: "ancestry-unknown",
      retryable: false,
      attempt_count: 1,
      local_head: "aaaaaaaaaaaa",
      remote_head: "999999999999",
      lineage: "diverged",
      remote_name: "origin",
      remote_location: REMOTE.location,
      recovery_attempted: true,
      recovery_outcome: "refused",
    });
  });
});
