import {
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
  planningFromState,
  reconcileCanonicalPlanning,
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
  push: pushPortableDataRef,
  networkEnvironment: async () => ({}),
};

function snapshotsEqual(
  left: ReadonlyMap<string, string>,
  right: ReadonlyMap<string, string>,
): boolean {
  if (left.size !== right.size) {
    return false;
  }
  for (const [path, content] of left) {
    if (right.get(path) !== content) {
      return false;
    }
  }
  return true;
}

function remoteStatus(
  remote: SynchronizationRemote | null,
  state: Exclude<RemoteGitSynchronization["state"], "not-configured">,
): RemoteGitSynchronization {
  if (remote === null) {
    return {
      state: "not-configured",
      remote_name: null,
      remote_location: null,
    };
  }
  return {
    state,
    remote_name: remote.name,
    remote_location: remote.location,
  };
}

function ambiguousRemoteStatus(): RemoteGitSynchronization {
  return {
    state: "sync-issue",
    remote_name: "configured",
    remote_location: "Ambiguous Git synchronization destination",
  };
}

function synchronizationStatus(
  localGit: LocalGitSnapshotState,
  remote: SynchronizationRemote | null,
  remoteState: Exclude<RemoteGitSynchronization["state"], "not-configured">,
): RepositorySynchronizationStatus {
  return {
    local_git: localGit,
    remote: remoteStatus(remote, remoteState),
  };
}

function remoteIdentity(
  observation: PortableRemoteObservation,
): SynchronizationRemote | null {
  return observation.authority.state === "selected"
    ? observation.authority.remote
    : null;
}

export function createSyncController(
  db: JigSqlConnection,
  config: SyncConfiguration,
  effectOverrides: Partial<SyncEffects> = {},
): SyncController {
  const effects: SyncEffects = {
    ...REAL_EFFECTS,
    ...effectOverrides,
  };
  const adapter: GitAdapterConfig = {
    repository_path: config.repository_path,
  };

  let remote: SynchronizationRemote | null = null;
  let currentStatus = synchronizationStatus(
    "pending",
    remote,
    "pending",
  );
  let running: Promise<RepositorySynchronizationStatus> | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let firstDirtyAt: number | null = null;
  let localFailureCount = 0;
  let remoteFailureCount = 0;
  let stopped = false;

  const clearTimer = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const schedule = (delayMs: number): void => {
    if (stopped) {
      return;
    }
    clearTimer();
    timer = setTimeout(() => {
      void trigger();
    }, delayMs);
  };

  const localPending = async (): Promise<boolean> => {
    const metadata = await readMetadata(db);
    return (
      metadata.revision !== metadata.last_exported_revision ||
      metadata.last_exported_head === null ||
      metadata.pending_sync
    );
  };

  const reconcileConcreteLocalSnapshot = async (): Promise<void> => {
    const metadata = await readMetadata(db);
    const state = await readCanonicalState(db);
    const current = await effects.readCurrentSnapshot(
      adapter,
      metadata.dataset_id,
    );
    if (current === null) {
      return;
    }

    const expected = serializeSnapshot(
      state.tasks,
      metadata.dataset_id,
      state.recurrences,
    );
    const contentMatches = snapshotsEqual(
      current.snapshot.files,
      expected.files,
    );

    if (contentMatches) {
      if (
        metadata.last_exported_head !== current.head ||
        metadata.last_exported_revision !== state.revision
      ) {
        await markExported(db, state.revision, current.head);
      }
      if (metadata.last_adopted_head !== current.head) {
        await markAdoptedHead(db, current.head);
      }
      return;
    }

    const mutationPending =
      state.revision !== metadata.last_exported_revision ||
      metadata.pending_sync;
    if (mutationPending) {
      return;
    }

    await applySynchronizedCanonicalState(
      db,
      state.revision,
      current.snapshot.tasks,
      current.snapshot.recurrences,
      current.head,
    );
  };

  const currentLocalHeadIs = async (
    expectedHead: string | null,
  ): Promise<boolean> => {
    const metadata = await readMetadata(db);
    const current = await effects.readCurrentSnapshot(
      adapter,
      metadata.dataset_id,
    );
    return current?.head === expectedHead;
  };

  const exportCurrentState = async (): Promise<string> => {
    const state = await readCanonicalState(db);
    const metadata = await readMetadata(db);
    const snapshot = serializeSnapshot(
      state.tasks,
      metadata.dataset_id,
      state.recurrences,
    );
    const head = await effects.writeSnapshot(
      adapter,
      snapshot,
      state.revision,
    );
    await markExported(db, state.revision, head);
    return head;
  };

  const applyRemotePlanning = async (
    observation: PortableRemoteObservation,
    tasks: ReturnType<typeof planningFromState>["tasks"],
    recurrences: ReturnType<typeof planningFromState>["recurrences"],
  ): Promise<number> => {
    const state = await readCanonicalState(db);
    if (
      canonicalPlanningEqual(
        planningFromState(state),
        { tasks, recurrences },
      )
    ) {
      if (observation.remote_head !== null) {
        await markAdoptedHead(db, observation.remote_head);
      }
      return state.revision;
    }
    if (observation.remote_head === null) {
      throw new Error("Remote head is required to apply synchronized state");
    }
    return (
      await applySynchronizedCanonicalState(
        db,
        state.revision,
        tasks,
        recurrences,
        observation.remote_head,
      )
    ).revision;
  };

  const transientRemoteFailure = (): RepositorySynchronizationStatus => {
    remoteFailureCount += 1;
    currentStatus = synchronizationStatus(
      (currentStatus.local_git === "issue"
        ? "issue"
        : "committed"),
      remote,
      remoteFailureCount >= 7 ? "sync-issue" : "retrying",
    );
    schedule(synchronizationRetryDelayMs(remoteFailureCount));
    return currentStatus;
  };

  const structuralIssue = async (): Promise<RepositorySynchronizationStatus> => {
    const committed = !(await localPending());
    currentStatus = remote === null
      ? {
          local_git: committed ? "committed" : "pending",
          remote: ambiguousRemoteStatus(),
        }
      : synchronizationStatus(
          committed ? "committed" : "pending",
          remote,
          "sync-issue",
        );
    schedule(SYNCHRONIZATION_HEALTHY_POLL_MS);
    return currentStatus;
  };

  const runOnce = async (): Promise<RepositorySynchronizationStatus> => {
    try {
      const datasetId = (await readMetadata(db)).dataset_id;
      await effects.ensurePortableData(adapter, datasetId);
      await reconcileConcreteLocalSnapshot();
      localFailureCount = 0;
    } catch {
      localFailureCount += 1;
      currentStatus = synchronizationStatus(
        "issue",
        remote,
        "pending",
      );
      schedule(synchronizationRetryDelayMs(localFailureCount));
      return currentStatus;
    }

    try {
      remote = await effects.inspectRemote(adapter);
    } catch {
      return transientRemoteFailure();
    }

    const networkEnvironment = await effects.networkEnvironment();
    if (networkEnvironment === null) {
      return structuralIssue();
    }

    for (let raceAttempt = 0; raceAttempt < 3; raceAttempt += 1) {
      let observation: PortableRemoteObservation;
      try {
        const datasetId = (await readMetadata(db)).dataset_id;
        observation = await effects.observeRemote(
          adapter,
          datasetId,
          networkEnvironment,
        );
      } catch {
        return transientRemoteFailure();
      }

      remote = remoteIdentity(observation);

      if (observation.remote_state === "none") {
        try {
          if (await localPending()) {
            await exportCurrentState();
          }
          firstDirtyAt = null;
          remoteFailureCount = 0;
          currentStatus = synchronizationStatus(
            "committed",
            null,
            "pending",
          );
          schedule(SYNCHRONIZATION_HEALTHY_POLL_MS);
          return currentStatus;
        } catch {
          localFailureCount += 1;
          currentStatus = synchronizationStatus(
            "issue",
            null,
            "pending",
          );
          schedule(synchronizationRetryDelayMs(localFailureCount));
          return currentStatus;
        }
      }

      if (observation.remote_state === "ambiguous") {
        remote = null;
        return structuralIssue();
      }

      if (observation.remote_state === "absent") {
        if (observation.previous_remote_head !== null || remote === null) {
          return structuralIssue();
        }
        try {
          if (await localPending()) {
            await exportCurrentState();
          }
          const pushed = await effects.push(
            adapter,
            remote,
            networkEnvironment,
          );
          if (!pushed.retryable && pushed.status === "sync-issue") {
            return structuralIssue();
          }
          continue;
        } catch {
          continue;
        }
      }

      const remoteSnapshot = observation.remote_snapshot;
      const remoteHead = observation.remote_head;
      const localHead = observation.local_head;
      if (
        remoteSnapshot === null ||
        remoteHead === null ||
        localHead === null ||
        remote === null
      ) {
        return structuralIssue();
      }

      let state = await readCanonicalState(db);
      let metadata = await readMetadata(db);

      if (remoteSnapshot.dataset_id !== metadata.dataset_id) {
        const emptyBootstrap =
          state.revision === 0 &&
          metadata.last_exported_revision === 0 &&
          state.tasks.length === 0 &&
          state.recurrences.length === 0;
        if (!emptyBootstrap) {
          return structuralIssue();
        }
        try {
          const previousDatasetId = metadata.dataset_id;
          await adoptEmptyDatasetIdentity(
            db,
            previousDatasetId,
            remoteSnapshot.dataset_id,
          );
          state = await readCanonicalState(db);
          metadata = await readMetadata(db);
          if (
            remoteSnapshot.tasks.length > 0 ||
            remoteSnapshot.recurrences.length > 0
          ) {
            const applied =
              await applySynchronizedCanonicalState(
                db,
                state.revision,
                remoteSnapshot.tasks,
                remoteSnapshot.recurrences,
                remoteHead,
              );
            await effects.alignLocal(
              adapter,
              localHead,
              remoteHead,
            );
            await markExported(
              db,
              applied.revision,
              remoteHead,
            );
          } else {
            await effects.alignLocal(
              adapter,
              localHead,
              remoteHead,
            );
            await markAdoptedHead(db, remoteHead);
            await markExported(
              db,
              state.revision,
              remoteHead,
            );
          }
          continue;
        } catch {
          return structuralIssue();
        }
      }

      const currentSnapshot = serializeSnapshot(
        state.tasks,
        metadata.dataset_id,
        state.recurrences,
      );
      const matchesRemote = snapshotsEqual(
        currentSnapshot.files,
        remoteSnapshot.files,
      );
      const pending =
        state.revision !== metadata.last_exported_revision ||
        metadata.last_exported_head === null ||
        metadata.pending_sync;
      const decision = decideSynchronization({
        remote: "present",
        previously_observed_remote:
          observation.previous_remote_head !== null,
        remote_rewritten: observation.remote_rewritten,
        lineage: observation.lineage,
        local_pending: pending,
        canonical_matches_remote: matchesRemote,
        base_available: observation.base !== null,
      });

      if (decision === "needs-attention") {
        return structuralIssue();
      }

      if (decision === "synchronized") {
        remoteFailureCount = 0;
        firstDirtyAt = null;
        currentStatus = synchronizationStatus(
          "committed",
          remote,
          "synchronized",
        );
        schedule(SYNCHRONIZATION_HEALTHY_POLL_MS);
        return currentStatus;
      }

      if (decision === "normalize-to-remote") {
        try {
          if (localHead !== remoteHead) {
            await effects.alignLocal(
              adapter,
              localHead,
              remoteHead,
            );
          }
          const current = await readCanonicalState(db);
          await markAdoptedHead(db, remoteHead);
          await markExported(db, current.revision, remoteHead);
          continue;
        } catch {
          continue;
        }
      }

      if (decision === "adopt-remote") {
        try {
          const expectedRevision = state.revision;
          await applySynchronizedCanonicalState(
            db,
            expectedRevision,
            remoteSnapshot.tasks,
            remoteSnapshot.recurrences,
            remoteHead,
          );
          await effects.alignLocal(
            adapter,
            localHead,
            remoteHead,
          );
          const adopted = await readCanonicalState(db);
          await markExported(db, adopted.revision, remoteHead);
          continue;
        } catch {
          continue;
        }
      }

      if (decision === "reconcile") {
        const base = observation.base;
        if (base === null) {
          return structuralIssue();
        }
        const reconciled = reconcileCanonicalPlanning(
          {
            tasks: base.snapshot.tasks,
            recurrences: base.snapshot.recurrences,
          },
          planningFromState(state),
          {
            tasks: remoteSnapshot.tasks,
            recurrences: remoteSnapshot.recurrences,
          },
        );
        if (reconciled.state === "conflict") {
          return structuralIssue();
        }

        try {
          const appliedRevision = await applyRemotePlanning(
            observation,
            reconciled.planning.tasks,
            reconciled.planning.recurrences,
          );
          if (!(await currentLocalHeadIs(localHead))) {
            continue;
          }
          if (localHead !== remoteHead) {
            await effects.alignLocal(
              adapter,
              localHead,
              remoteHead,
            );
          }
          const merged = await readCanonicalState(db);
          if (merged.revision < appliedRevision) {
            continue;
          }
          await exportCurrentState();
          const pushed = await effects.push(
            adapter,
            remote,
            networkEnvironment,
          );
          if (!pushed.retryable && pushed.status === "sync-issue") {
            return structuralIssue();
          }
          continue;
        } catch {
          continue;
        }
      }

      if (decision === "export-and-push") {
        try {
          if (!(await currentLocalHeadIs(localHead))) {
            continue;
          }
          if (await localPending()) {
            await exportCurrentState();
          }
          const pushed = await effects.push(
            adapter,
            remote,
            networkEnvironment,
          );
          if (!pushed.retryable && pushed.status === "sync-issue") {
            return structuralIssue();
          }
          continue;
        } catch {
          continue;
        }
      }

      return structuralIssue();
    }

    return transientRemoteFailure();
  };

  const trigger = async (): Promise<RepositorySynchronizationStatus> => {
    if (running !== null) {
      return running;
    }
    clearTimer();
    running = runOnce().finally(() => {
      running = null;
    });
    return running;
  };

  return {
    start: async () => {
      stopped = false;
      currentStatus = synchronizationStatus(
        (await localPending()) ? "pending" : "committed",
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
      currentStatus = synchronizationStatus(
        "pending",
        remote,
        "pending",
      );
      const now = Date.now();
      firstDirtyAt ??= now;
      const latestTarget = now + EXPORT_DEBOUNCE_MS;
      const maximumTarget = firstDirtyAt + EXPORT_MAX_FLUSH_MS;
      schedule(
        Math.max(
          0,
          Math.min(latestTarget, maximumTarget) - now,
        ),
      );
    },
    trigger,
    status: () => currentStatus,
  };
}
