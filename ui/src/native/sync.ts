import {
  adoptEmptyDatasetIdentity,
  applySynchronizedCanonicalState,
  markAdoptedHead,
  markExported,
  readCanonicalState,
  readMetadata,
  type JigSqlConnection,
} from "../../../src/persistence/sqlite";
import type {
  RepositorySynchronizationStatus,
} from "../../../src/protocol";
import {
  canonicalPlanningEqual,
  reconcileCanonicalPlanning,
} from "../../../src/core/reconciliation";
import {
  decideSynchronization,
  runSynchronizationRemoteOperation,
  SYNCHRONIZATION_HEALTHY_POLL_MS,
  synchronizationRetryDelayMs,
} from "../../../src/synchronization";
import {
  acknowledgeAndroidRemoteHead,
  alignAndroidPortableHead,
  androidPortableHead,
  androidSynchronizationRemote,
  commitAndroidCanonicalState,
  normalizeAndroidPortableHead,
  observeAndroidPortableRemote,
  pushAndroidPortableRepository,
  reopenAndroidPortableRepository,
  type AndroidGitEffects,
  type GitCredentialProvider,
} from "./git";

const MUTATION_DEBOUNCE_MS = 3_000;

export interface AndroidSyncController {
  readonly start: () => Promise<void>;
  readonly stop: () => Promise<void>;
  readonly status: () => RepositorySynchronizationStatus;
  readonly notifyMutation: () => void;
  readonly trigger: () => Promise<RepositorySynchronizationStatus>;
}

function pendingStatus(): RepositorySynchronizationStatus {
  return {
    local_git: "pending",
    remote: {
      state: "pending",
      remote_name: "origin",
      remote_location: "Android managed Git repository",
    },
  };
}

export function createAndroidSyncController(
  database: JigSqlConnection,
  effects: AndroidGitEffects,
  credential: GitCredentialProvider,
): AndroidSyncController {
  let current = pendingStatus();
  let running:
    Promise<RepositorySynchronizationStatus> | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;
  let remoteFailureCount = 0;

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

  const setRemoteState = async (
    localGit: "pending" | "committed" | "issue",
    state:
      | "pending"
      | "retrying"
      | "synchronized"
      | "sync-issue",
  ): Promise<RepositorySynchronizationStatus> => {
    try {
      const remote = await androidSynchronizationRemote(effects);
      current = {
        local_git: localGit,
        remote: {
          state,
          remote_name: remote.name,
          remote_location: remote.location,
        },
      };
    } catch {
      current = {
        local_git: localGit,
        remote: {
          state: "sync-issue",
          remote_name: "origin",
          remote_location: "Android managed Git repository",
        },
      };
    }
    return current;
  };

  const localPending = async (): Promise<boolean> => {
    const metadata = await readMetadata(database);
    return (
      metadata.revision !== metadata.last_exported_revision ||
      metadata.last_exported_head === null ||
      metadata.pending_sync
    );
  };

  const reconcileConcreteLocalSnapshot =
    async (): Promise<void> => {
      const metadata = await readMetadata(database);
      const state = await readCanonicalState(database);
      const head = await androidPortableHead(effects);
      const snapshot = await reopenAndroidPortableRepository(
        effects,
        metadata.dataset_id,
      );
      if (
        canonicalPlanningEqual(
          { tasks: state.tasks, recurrences: state.recurrences },
          {
            tasks: snapshot.tasks,
            recurrences: snapshot.recurrences,
          },
        )
      ) {
        if (
          metadata.last_exported_head !== head ||
          metadata.last_exported_revision !== state.revision
        ) {
          await markExported(database, state.revision, head);
        }
        if (metadata.last_adopted_head !== head) {
          await markAdoptedHead(database, head);
        }
        return;
      }

      const mutationPending =
        state.revision !== metadata.last_exported_revision ||
        metadata.pending_sync;
      if (mutationPending) {
        return;
      }
      const applied = await applySynchronizedCanonicalState(
        database,
        state.revision,
        snapshot.tasks,
        snapshot.recurrences,
        head,
      );
      await markExported(database, applied.revision, head);
    };

  const exportCurrent = async (): Promise<string> => {
    const state = await readCanonicalState(database);
    const metadata = await readMetadata(database);
    const head = await commitAndroidCanonicalState(
      effects,
      state,
      metadata.dataset_id,
    );
    await markExported(database, state.revision, head);
    return head;
  };

  const structuralIssue =
    async (): Promise<RepositorySynchronizationStatus> => {
      const result = await setRemoteState(
        (await localPending()) ? "pending" : "committed",
        "sync-issue",
      );
      schedule(SYNCHRONIZATION_HEALTHY_POLL_MS);
      return result;
    };

  const transientIssue =
    async (): Promise<RepositorySynchronizationStatus> => {
      remoteFailureCount += 1;
      const result = await setRemoteState(
        (await localPending()) ? "pending" : "committed",
        remoteFailureCount >= 7 ? "sync-issue" : "retrying",
      );
      schedule(
        synchronizationRetryDelayMs(remoteFailureCount),
      );
      return result;
    };

  const runOnce = async (): Promise<RepositorySynchronizationStatus> => {
    try {
      await reconcileConcreteLocalSnapshot();
    } catch {
      await setRemoteState("issue", "pending");
      schedule(synchronizationRetryDelayMs(1));
      return current;
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const state = await readCanonicalState(database);
      const metadata = await readMetadata(database);
      let observation:
        Awaited<ReturnType<typeof observeAndroidPortableRemote>>;
      try {
        observation =
          await runSynchronizationRemoteOperation(
            () =>
              observeAndroidPortableRemote(
                effects,
                metadata.dataset_id,
                credential,
              ),
          );
      } catch {
        return transientIssue();
      }

      if (
        observation.remote_state !== "present" ||
        observation.remote_head === null ||
        observation.remote_snapshot === null
      ) {
        return structuralIssue();
      }

      const remoteHead = observation.remote_head;
      const remoteSnapshot = observation.remote_snapshot;

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
            database,
            metadata.dataset_id,
            remoteSnapshot.dataset_id,
          );
          const switched = await readCanonicalState(database);
          if (
            remoteSnapshot.tasks.length > 0 ||
            remoteSnapshot.recurrences.length > 0
          ) {
            const applied =
              await applySynchronizedCanonicalState(
                database,
                switched.revision,
                remoteSnapshot.tasks,
                remoteSnapshot.recurrences,
                remoteHead,
              );
            await normalizeAndroidPortableHead(
              effects,
              observation.local_head,
              remoteHead,
            );
            await acknowledgeAndroidRemoteHead(
              effects,
              remoteHead,
            );
            await markExported(
              database,
              applied.revision,
              remoteHead,
            );
          } else {
            await normalizeAndroidPortableHead(
              effects,
              observation.local_head,
              remoteHead,
            );
            await acknowledgeAndroidRemoteHead(
              effects,
              remoteHead,
            );
            await markAdoptedHead(database, remoteHead);
            await markExported(
              database,
              switched.revision,
              remoteHead,
            );
          }
          continue;
        } catch {
          return structuralIssue();
        }
      }

      const currentPlanning = { tasks: state.tasks, recurrences: state.recurrences };
      const remotePlanning = {
        tasks: remoteSnapshot.tasks,
        recurrences: remoteSnapshot.recurrences,
      };
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
        canonical_matches_remote:
          canonicalPlanningEqual(
            currentPlanning,
            remotePlanning,
          ),
        base_available: observation.base !== null,
      });

      if (decision === "needs-attention") {
        return structuralIssue();
      }

      if (decision === "synchronized") {
        remoteFailureCount = 0;
        const result = await setRemoteState(
          "committed",
          "synchronized",
        );
        schedule(SYNCHRONIZATION_HEALTHY_POLL_MS);
        return result;
      }

      if (decision === "normalize-to-remote") {
        try {
          if (observation.local_head !== remoteHead) {
            await normalizeAndroidPortableHead(
              effects,
              observation.local_head,
              remoteHead,
            );
          }
          await acknowledgeAndroidRemoteHead(
            effects,
            remoteHead,
          );
          await markAdoptedHead(database, remoteHead);
          await markExported(
            database,
            state.revision,
            remoteHead,
          );
          continue;
        } catch {
          continue;
        }
      }

      if (decision === "adopt-remote") {
        try {
          const applied = await applySynchronizedCanonicalState(
            database,
            state.revision,
            remoteSnapshot.tasks,
            remoteSnapshot.recurrences,
            remoteHead,
          );
          await alignAndroidPortableHead(
            effects,
            observation.local_head,
            remoteHead,
          );
          await markExported(
            database,
            applied.revision,
            remoteHead,
          );
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
          currentPlanning,
          remotePlanning,
        );
        if (reconciled.state === "conflict") {
          return structuralIssue();
        }

        try {
          const applied = await applySynchronizedCanonicalState(
            database,
            state.revision,
            reconciled.planning.tasks,
            reconciled.planning.recurrences,
            remoteHead,
          );
          if (
            (await androidPortableHead(effects)) !==
            observation.local_head
          ) {
            continue;
          }
          if (observation.local_head !== remoteHead) {
            await alignAndroidPortableHead(
              effects,
              observation.local_head,
              remoteHead,
            );
          }
          const merged = await readCanonicalState(database);
          const committed = await commitAndroidCanonicalState(
            effects,
            merged,
            metadata.dataset_id,
          );
          await markExported(
            database,
            merged.revision,
            committed,
          );
          await runSynchronizationRemoteOperation(
            () =>
              pushAndroidPortableRepository(
                effects,
                credential,
              ),
          );
          if (merged.revision < applied.revision) {
            continue;
          }
          continue;
        } catch {
          continue;
        }
      }

      if (decision === "export-and-push") {
        try {
          if (
            (await androidPortableHead(effects)) !==
            observation.local_head
          ) {
            continue;
          }
          if (await localPending()) {
            await exportCurrent();
          }
          await runSynchronizationRemoteOperation(
            () =>
              pushAndroidPortableRepository(
                effects,
                credential,
              ),
          );
          continue;
        } catch {
          continue;
        }
      }

      return structuralIssue();
    }

    return transientIssue();
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
      await setRemoteState(
        (await localPending()) ? "pending" : "committed",
        "pending",
      );
      schedule(0);
    },
    stop: async () => {
      stopped = true;
      clearTimer();
      const active = running;
      if (active !== null) {
        await active.catch(() => current);
      }
    },
    status: () => current,
    notifyMutation: () => {
      void setRemoteState("pending", "pending");
      if (stopped) {
        return;
      }
      clearTimer();
      timer = setTimeout(() => {
        void trigger();
      }, MUTATION_DEBOUNCE_MS);
    },
    trigger,
  };
}
