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
  decideSynchronization,
  runSynchronizationRemoteOperation,
  SYNCHRONIZATION_HEALTHY_POLL_MS,
  synchronizationRetryDelayMs,
} from "../synchronization";

export interface SyncConfiguration {
  readonly repository_path: string;
}

export interface SyncController {
  readonly start: () => Promise<void>;
  readonly stop: () => Promise<void>;
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

function filesEqual(
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
  let currentStatus: RepositorySynchronizationStatus = {
    local_git: "pending",
    remote: remoteStatus(null, "pending"),
  };
  let running: Promise<RepositorySynchronizationStatus> | null =
    null;
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

  const isPending = async (): Promise<boolean> => {
    const metadata = await readMetadata(db);
    return (
      metadata.revision !== metadata.last_exported_revision ||
      metadata.last_exported_head === null ||
      metadata.pending_sync
    );
  };

  const setStatus = async (
    remoteState:
      | "pending"
      | "retrying"
      | "synchronized"
      | "sync-issue",
  ): Promise<RepositorySynchronizationStatus> => {
    currentStatus = {
      local_git: (await isPending()) ? "pending" : "committed",
      remote: remoteStatus(remote, remoteState),
    };
    return currentStatus;
  };

  const structuralIssue =
    async (): Promise<RepositorySynchronizationStatus> => {
      const status = await setStatus("sync-issue");
      schedule(SYNCHRONIZATION_HEALTHY_POLL_MS);
      return status;
    };

  const transientIssue =
    async (): Promise<RepositorySynchronizationStatus> => {
      remoteFailureCount += 1;
      const status = await setStatus(
        remoteFailureCount >= 7 ? "sync-issue" : "retrying",
      );
      schedule(synchronizationRetryDelayMs(remoteFailureCount));
      return status;
    };

  const reconcileConcreteLocalSnapshot =
    async (): Promise<void> => {
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
      if (filesEqual(current.snapshot.files, expected.files)) {
        if (
          metadata.last_exported_head !== current.head ||
          metadata.last_exported_revision !== state.revision
        ) {
          await markExported(db, state.revision, current.head);
        }
        return;
      }
      if (
        state.revision !== metadata.last_exported_revision ||
        metadata.pending_sync
      ) {
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

  const localHeadIs = async (
    expectedHead: string,
  ): Promise<boolean> => {
    const metadata = await readMetadata(db);
    return (
      await effects.readCurrentSnapshot(
        adapter,
        metadata.dataset_id,
      )
    )?.head === expectedHead;
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

  const runOnce =
    async (): Promise<RepositorySynchronizationStatus> => {
      try {
        await effects.ensurePortableData(
          adapter,
          (await readMetadata(db)).dataset_id,
        );
        await reconcileConcreteLocalSnapshot();
        localFailureCount = 0;
      } catch {
        localFailureCount += 1;
        currentStatus = {
          local_git: "issue",
          remote: remoteStatus(remote, "pending"),
        };
        schedule(synchronizationRetryDelayMs(localFailureCount));
        return currentStatus;
      }

      try {
        remote = await effects.inspectRemote(adapter);
      } catch {
        return transientIssue();
      }

      if (remote === null) {
        try {
          if (await isPending()) {
            await exportCurrent();
          }
          firstDirtyAt = null;
          remoteFailureCount = 0;
          currentStatus = {
            local_git: "committed",
            remote: {
              state: "not-configured",
              remote_name: null,
              remote_location: null,
            },
          };
          schedule(SYNCHRONIZATION_HEALTHY_POLL_MS);
          return currentStatus;
        } catch {
          localFailureCount += 1;
          currentStatus = {
            local_git: "issue",
            remote: {
              state: "not-configured",
              remote_name: null,
              remote_location: null,
            },
          };
          schedule(synchronizationRetryDelayMs(localFailureCount));
          return currentStatus;
        }
      }

      let networkEnvironment:
        Readonly<Record<string, string>> | null;
      try {
        networkEnvironment =
          await runSynchronizationRemoteOperation(
            effects.networkEnvironment,
          );
      } catch {
        return transientIssue();
      }
      if (networkEnvironment === null) {
        return structuralIssue();
      }

      for (let attempt = 0; attempt < 3; attempt += 1) {
        let observation: PortableRemoteObservation;
        try {
          observation =
            await runSynchronizationRemoteOperation(
              () =>
                effects.observeRemote(
                  adapter,
                  (await readMetadata(db)).dataset_id,
                  networkEnvironment,
                ),
            );
        } catch {
          return transientIssue();
        }

        if (observation.remote_state === "ambiguous") {
          return structuralIssue();
        }
        if (observation.remote_state === "none") {
          remote = null;
          return setStatus("pending");
        }
        if (observation.authority.state === "selected") {
          remote = observation.authority.remote;
        }

        if (observation.remote_state === "absent") {
          if (observation.previous_remote_head !== null) {
            return structuralIssue();
          }
          try {
            if (await isPending()) {
              await exportCurrent();
            }
            await runSynchronizationRemoteOperation(
              () =>
                effects.push(
                  adapter,
                  remote,
                  networkEnvironment,
                ),
            );
            continue;
          } catch {
            continue;
          }
        }

        const remoteHead = observation.remote_head;
        const localHead = observation.local_head;
        const remoteSnapshot = observation.remote_snapshot;
        if (
          remoteHead === null ||
          localHead === null ||
          remoteSnapshot === null
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
            await adoptEmptyDatasetIdentity(
              db,
              metadata.dataset_id,
              remoteSnapshot.dataset_id,
            );
            state = await readCanonicalState(db);
            const applied =
              remoteSnapshot.tasks.length === 0 &&
              remoteSnapshot.recurrences.length === 0
                ? null
                : await applySynchronizedCanonicalState(
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
            await markAdoptedHead(db, remoteHead);
            await markExported(
              db,
              applied?.revision ?? state.revision,
              remoteHead,
            );
            continue;
          } catch {
            return structuralIssue();
          }
        }

        const localSnapshot = serializeSnapshot(
          state.tasks,
          metadata.dataset_id,
          state.recurrences,
        );
        const pending =
          state.revision !== metadata.last_exported_revision ||
          metadata.last_exported_head === null ||
          metadata.pending_sync;
        const decision = decideSynchronization({
          remote_rewritten: observation.remote_rewritten,
          lineage: observation.lineage,
          local_pending: pending,
          canonical_matches_remote: filesEqual(
            localSnapshot.files,
            remoteSnapshot.files,
          ),
        });

        if (decision === "attention") {
          return structuralIssue();
        }
        if (decision === "synchronized") {
          remoteFailureCount = 0;
          firstDirtyAt = null;
          const status = await setStatus("synchronized");
          schedule(SYNCHRONIZATION_HEALTHY_POLL_MS);
          return status;
        }
        if (decision === "adopt") {
          try {
            const representedRevision =
              filesEqual(
                localSnapshot.files,
                remoteSnapshot.files,
              )
                ? state.revision
                : (
                    await applySynchronizedCanonicalState(
                      db,
                      state.revision,
                      remoteSnapshot.tasks,
                      remoteSnapshot.recurrences,
                      remoteHead,
                    )
                  ).revision;
            await effects.alignLocal(
              adapter,
              localHead,
              remoteHead,
            );
            await markAdoptedHead(db, remoteHead);
            await markExported(
              db,
              representedRevision,
              remoteHead,
            );
            continue;
          } catch {
            continue;
          }
        }

        try {
          if (!(await localHeadIs(localHead))) {
            continue;
          }
          if (await isPending()) {
            await exportCurrent();
          }
          const pushed =
            await runSynchronizationRemoteOperation(
              () =>
                effects.push(
                  adapter,
                  remote,
                  networkEnvironment,
                ),
            );
          if (
            pushed.status === "sync-issue" &&
            !pushed.retryable
          ) {
            return structuralIssue();
          }
          continue;
        } catch {
          continue;
        }
      }

      return transientIssue();
    };

  const trigger =
    async (): Promise<RepositorySynchronizationStatus> => {
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
      await setStatus("pending");
      schedule(0);
    },
    stop: async () => {
      stopped = true;
      clearTimer();
      const active = running;
      if (active !== null) {
        await active.catch(() => currentStatus);
      }
    },
    notifyMutation: () => {
      currentStatus = {
        local_git: "pending",
        remote: remoteStatus(remote, "pending"),
      };
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
    status: () => currentStatus,
  };
}
