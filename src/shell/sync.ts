import {
  acknowledgePortableRemoteHead,
  alignPortableDataRef,
  ensurePortableData,
  EXPORT_DEBOUNCE_MS,
  EXPORT_MAX_FLUSH_MS,
  inspectSynchronizationRemote,
  observePortableRemote,
  pushPortableDataRef,
  readCurrentPortableSnapshot,
  serializeSnapshot,
  writePortableSnapshot,
  type GitAdapterConfig,
  type PortableRemoteObservation,
  type SynchronizationRemote,
} from "./git";
import type {
  LocalGitSnapshotState,
  RemoteGitSynchronization,
  RepositorySynchronizationStatus,
} from "../protocol";
import {
  adoptEmptyDatasetIdentity,
  applySynchronizedCanonicalState,
  markAdoptedHead,
  markExported,
  readCanonicalState,
  readMetadata,
  type JigSqlConnection,
} from "../persistence/sqlite";
import {
  canonicalPlanningEqual,
  reconcileCanonicalPlanning,
  type CanonicalPlanning,
} from "../core/reconciliation";
import {
  decideSynchronization,
  SYNCHRONIZATION_HEALTHY_POLL_MS,
  synchronizationRetryDelayMs,
} from "../synchronization";

export interface SyncConfiguration {
  readonly repository_path: string;
}

export interface SyncController {
  readonly start: () => Promise<void>;
  readonly stop: () => void;
  readonly notifyMutation: () => void;
  readonly trigger: () => Promise<RepositorySynchronizationStatus>;
  readonly status: () => RepositorySynchronizationStatus;
}

export interface SyncEffects {
  readonly ensurePortableData: typeof ensurePortableData;
  readonly readCurrentSnapshot: typeof readCurrentPortableSnapshot;
  readonly writeSnapshot: typeof writePortableSnapshot;
  readonly inspectRemote: typeof inspectSynchronizationRemote;
  readonly observeRemote: typeof observePortableRemote;
  readonly alignLocal: typeof alignPortableDataRef;
  readonly acknowledgeRemote: typeof acknowledgePortableRemoteHead;
  readonly push: typeof pushPortableDataRef;
  readonly networkEnvironment: () => Promise<
    Readonly<Record<string, string>> | null
  >;
}

const REAL_EFFECTS: SyncEffects = {
  ensurePortableData,
  readCurrentSnapshot: readCurrentPortableSnapshot,
  writeSnapshot: writePortableSnapshot,
  inspectRemote: inspectSynchronizationRemote,
  observeRemote: observePortableRemote,
  alignLocal: alignPortableDataRef,
  acknowledgeRemote: acknowledgePortableRemoteHead,
  push: pushPortableDataRef,
  networkEnvironment: async () => ({}),
};

function sameFiles(
  left: ReadonlyMap<string, string>,
  right: ReadonlyMap<string, string>,
): boolean {
  if (left.size !== right.size) return false;
  for (const [path, value] of left) {
    if (right.get(path) !== value) return false;
  }
  return true;
}

function remoteStatus(
  remote: SynchronizationRemote | null,
  state: Exclude<RemoteGitSynchronization["state"], "not-configured">,
): RemoteGitSynchronization {
  return remote === null
    ? {
        state: "not-configured",
        remote_name: null,
        remote_location: null,
      }
    : {
        state,
        remote_name: remote.name,
        remote_location: remote.location,
      };
}

function status(
  local_git: LocalGitSnapshotState,
  remote: SynchronizationRemote | null,
  remoteState: Exclude<RemoteGitSynchronization["state"], "not-configured">,
): RepositorySynchronizationStatus {
  return {
    local_git,
    remote: remoteStatus(remote, remoteState),
  };
}

function selectedRemote(
  observation: PortableRemoteObservation,
): SynchronizationRemote | null {
  return observation.authority.state === "selected"
    ? observation.authority.remote
    : null;
}

function planning(
  value: {
    readonly tasks: CanonicalPlanning["tasks"];
    readonly recurrences: CanonicalPlanning["recurrences"];
  },
): CanonicalPlanning {
  return {
    tasks: value.tasks,
    recurrences: value.recurrences,
  };
}

export function createSyncController(
  db: JigSqlConnection,
  config: SyncConfiguration,
  overrides: Partial<SyncEffects> = {},
): SyncController {
  const effects: SyncEffects = { ...REAL_EFFECTS, ...overrides };
  const adapter: GitAdapterConfig = {
    repository_path: config.repository_path,
  };

  let remote: SynchronizationRemote | null = null;
  let current = status("pending", null, "pending");
  let running: Promise<RepositorySynchronizationStatus> | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let firstDirtyAt: number | null = null;
  let localFailures = 0;
  let remoteFailures = 0;
  let stopped = false;

  const clearTimer = (): void => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };

  const schedule = (delayMs: number): void => {
    if (stopped) return;
    clearTimer();
    timer = setTimeout(() => void trigger(), delayMs);
  };

  const pending = async (): Promise<boolean> => {
    const metadata = await readMetadata(db);
    return (
      metadata.revision !== metadata.last_exported_revision ||
      metadata.last_exported_head === null ||
      metadata.pending_sync
    );
  };

  const repairLocalBoundary = async (): Promise<void> => {
    const metadata = await readMetadata(db);
    const state = await readCanonicalState(db);
    const local = await effects.readCurrentSnapshot(
      adapter,
      metadata.dataset_id,
    );
    if (local === null) return;

    const expected = serializeSnapshot(
      state.tasks,
      metadata.dataset_id,
      state.recurrences,
    );
    if (sameFiles(local.snapshot.files, expected.files)) {
      if (
        metadata.last_exported_revision !== state.revision ||
        metadata.last_exported_head !== local.head
      ) {
        await markExported(db, state.revision, local.head);
      }
      if (metadata.last_adopted_head !== local.head) {
        await markAdoptedHead(db, local.head);
      }
      return;
    }

    if (
      state.revision !== metadata.last_exported_revision ||
      metadata.pending_sync
    ) {
      return;
    }

    const applied = await applySynchronizedCanonicalState(
      db,
      state.revision,
      local.snapshot.tasks,
      local.snapshot.recurrences,
      local.head,
    );
    await markExported(db, applied.revision, local.head);
  };

  const exportCurrent = async (): Promise<string> => {
    const state = await readCanonicalState(db);
    const metadata = await readMetadata(db);
    const head = await effects.writeSnapshot(
      adapter,
      serializeSnapshot(
        state.tasks,
        metadata.dataset_id,
        state.recurrences,
      ),
      state.revision,
    );
    await markExported(db, state.revision, head);
    return head;
  };

  const localHeadStill = async (head: string): Promise<boolean> => {
    const metadata = await readMetadata(db);
    return (
      await effects.readCurrentSnapshot(
        adapter,
        metadata.dataset_id,
      )
    )?.head === head;
  };

  const applyPlanning = async (
    expectedRevision: number,
    head: string,
    next: CanonicalPlanning,
  ): Promise<number> => {
    const state = await readCanonicalState(db);
    if (state.revision !== expectedRevision) {
      throw new Error("Synchronization revision changed");
    }
    if (canonicalPlanningEqual(planning(state), next)) {
      await markAdoptedHead(db, head);
      return state.revision;
    }
    return (
      await applySynchronizedCanonicalState(
        db,
        expectedRevision,
        next.tasks,
        next.recurrences,
        head,
      )
    ).revision;
  };

  const structuralIssue =
    async (): Promise<RepositorySynchronizationStatus> => {
      current =
        remote === null
          ? {
              local_git: (await pending()) ? "pending" : "committed",
              remote: {
                state: "sync-issue",
                remote_name: "configured",
                remote_location:
                  "Ambiguous Git synchronization destination",
              },
            }
          : status(
              (await pending()) ? "pending" : "committed",
              remote,
              "sync-issue",
            );
      schedule(SYNCHRONIZATION_HEALTHY_POLL_MS);
      return current;
    };

  const transientIssue =
    async (): Promise<RepositorySynchronizationStatus> => {
      remoteFailures += 1;
      current = status(
        (await pending()) ? "pending" : "committed",
        remote,
        remoteFailures >= 7 ? "sync-issue" : "retrying",
      );
      schedule(synchronizationRetryDelayMs(remoteFailures));
      return current;
    };

  const converge = async (
    environment: Readonly<Record<string, string>>,
  ): Promise<RepositorySynchronizationStatus> => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      let observation: PortableRemoteObservation;
      try {
        const datasetId = (await readMetadata(db)).dataset_id;
        observation = await effects.observeRemote(
          adapter,
          datasetId,
          environment,
        );
      } catch {
        return transientIssue();
      }

      remote = selectedRemote(observation);

      if (observation.remote_state === "none") {
        if (await pending()) await exportCurrent();
        remoteFailures = 0;
        firstDirtyAt = null;
        current = status("committed", null, "pending");
        schedule(SYNCHRONIZATION_HEALTHY_POLL_MS);
        return current;
      }
      if (observation.remote_state === "ambiguous") {
        return structuralIssue();
      }
      if (observation.remote_state === "absent") {
        if (
          remote === null ||
          observation.previous_remote_head !== null
        ) {
          return structuralIssue();
        }
        if (await pending()) await exportCurrent();
        const pushed = await effects.push(
          adapter,
          remote,
          environment,
        );
        if (!pushed.retryable && pushed.status === "sync-issue") {
          return structuralIssue();
        }
        continue;
      }

      const remoteHead = observation.remote_head;
      const remoteSnapshot = observation.remote_snapshot;
      const localHead = observation.local_head;
      if (
        remote === null ||
        remoteHead === null ||
        remoteSnapshot === null ||
        localHead === null
      ) {
        return structuralIssue();
      }

      let state = await readCanonicalState(db);
      let metadata = await readMetadata(db);

      if (remoteSnapshot.dataset_id !== metadata.dataset_id) {
        if (
          state.revision !== 0 ||
          metadata.last_exported_revision !== 0 ||
          state.tasks.length !== 0 ||
          state.recurrences.length !== 0
        ) {
          return structuralIssue();
        }
        await adoptEmptyDatasetIdentity(
          db,
          metadata.dataset_id,
          remoteSnapshot.dataset_id,
        );
        state = await readCanonicalState(db);
        const revision = await applyPlanning(
          state.revision,
          remoteHead,
          planning(remoteSnapshot),
        );
        await effects.alignLocal(adapter, localHead, remoteHead);
        await effects.acknowledgeRemote(adapter, remoteHead);
        await markExported(db, revision, remoteHead);
        continue;
      }

      const currentPlanning = planning(state);
      const remotePlanning = planning(remoteSnapshot);
      const decision = decideSynchronization({
        remote_rewritten: observation.remote_rewritten,
        lineage: observation.lineage,
        local_pending:
          state.revision !== metadata.last_exported_revision ||
          metadata.pending_sync,
        canonical_matches_remote:
          canonicalPlanningEqual(
            currentPlanning,
            remotePlanning,
          ),
        base_available: observation.base !== null,
      });

      if (decision === "attention") return structuralIssue();
      if (decision === "synchronized") {
        remoteFailures = 0;
        firstDirtyAt = null;
        current = status("committed", remote, "synchronized");
        schedule(SYNCHRONIZATION_HEALTHY_POLL_MS);
        return current;
      }
      if (decision === "normalize") {
        if (localHead !== remoteHead) {
          await effects.alignLocal(adapter, localHead, remoteHead);
        }
        await effects.acknowledgeRemote(adapter, remoteHead);
        await markAdoptedHead(db, remoteHead);
        await markExported(db, state.revision, remoteHead);
        continue;
      }
      if (decision === "adopt") {
        const revision = await applyPlanning(
          state.revision,
          remoteHead,
          remotePlanning,
        );
        await effects.alignLocal(adapter, localHead, remoteHead);
        await markExported(db, revision, remoteHead);
        continue;
      }
      if (decision === "reconcile") {
        const base = observation.base;
        if (base === null) return structuralIssue();
        const merged = reconcileCanonicalPlanning(
          planning(base.snapshot),
          currentPlanning,
          remotePlanning,
        );
        if (merged.state === "conflict") {
          return structuralIssue();
        }
        const revision = await applyPlanning(
          state.revision,
          remoteHead,
          merged.planning,
        );
        if (!(await localHeadStill(localHead))) continue;
        if (localHead !== remoteHead) {
          await effects.alignLocal(adapter, localHead, remoteHead);
        }
        if ((await readCanonicalState(db)).revision < revision) {
          continue;
        }
        await exportCurrent();
      } else {
        if (!(await localHeadStill(localHead))) continue;
        if (await pending()) await exportCurrent();
      }

      const pushed = await effects.push(
        adapter,
        remote,
        environment,
      );
      if (!pushed.retryable && pushed.status === "sync-issue") {
        return structuralIssue();
      }
    }
    return transientIssue();
  };

  const runOnce = async (): Promise<RepositorySynchronizationStatus> => {
    try {
      await effects.ensurePortableData(
        adapter,
        (await readMetadata(db)).dataset_id,
      );
      await repairLocalBoundary();
      localFailures = 0;
    } catch {
      localFailures += 1;
      current = status("issue", remote, "pending");
      schedule(synchronizationRetryDelayMs(localFailures));
      return current;
    }

    try {
      remote = await effects.inspectRemote(adapter);
      const environment = await effects.networkEnvironment();
      if (environment === null) return structuralIssue();
      return await converge(environment);
    } catch {
      return transientIssue();
    }
  };

  const trigger = async (): Promise<RepositorySynchronizationStatus> => {
    if (running !== null) return running;
    clearTimer();
    running = runOnce().finally(() => {
      running = null;
    });
    return running;
  };

  return {
    start: async () => {
      stopped = false;
      current = status(
        (await pending()) ? "pending" : "committed",
        remote,
        "pending",
      );
      schedule(0);
    },
    stop: () => {
      stopped = true;
      clearTimer();
    },
    notifyMutation: () => {
      current = status("pending", remote, "pending");
      const now = Date.now();
      firstDirtyAt ??= now;
      schedule(
        Math.max(
          0,
          Math.min(
            now + EXPORT_DEBOUNCE_MS,
            firstDirtyAt + EXPORT_MAX_FLUSH_MS,
          ) - now,
        ),
      );
    },
    trigger,
    status: () => current,
  };
}
