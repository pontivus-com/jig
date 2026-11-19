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
  decideSynchronization,
  runSynchronizationRemoteOperation,
  SYNCHRONIZATION_HEALTHY_POLL_MS,
  synchronizationRetryDelayMs,
} from "../../../src/synchronization";
import {
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

export function createAndroidSyncController(
  database: JigSqlConnection,
  effects: AndroidGitEffects,
  credential: GitCredentialProvider,
): AndroidSyncController {
  let current: RepositorySynchronizationStatus = {
    local_git: "pending",
    remote: {
      state: "pending",
      remote_name: "origin",
      remote_location: "Android managed Git repository",
    },
  };
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

  const isPending = async (): Promise<boolean> => {
    const metadata = await readMetadata(database);
    return (
      metadata.revision !== metadata.last_exported_revision ||
      metadata.last_exported_head === null ||
      metadata.pending_sync
    );
  };

  const setStatus = async (
    state:
      | "pending"
      | "retrying"
      | "synchronized"
      | "sync-issue",
  ): Promise<RepositorySynchronizationStatus> => {
    const localGit = (await isPending())
      ? "pending"
      : "committed";
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
      const metadata = await readMetadata(database);
      const state = await readCanonicalState(database);
      const head = await androidPortableHead(effects);
      const snapshot = await reopenAndroidPortableRepository(
        effects,
        metadata.dataset_id,
      );
      const currentJson = JSON.stringify({
        tasks: state.tasks,
        recurrences: state.recurrences,
      });
      const snapshotJson = JSON.stringify({
        tasks: snapshot.tasks,
        recurrences: snapshot.recurrences,
      });
      if (currentJson === snapshotJson) {
        if (
          metadata.last_exported_head !== head ||
          metadata.last_exported_revision !== state.revision
        ) {
          await markExported(database, state.revision, head);
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
        database,
        state.revision,
        snapshot.tasks,
        snapshot.recurrences,
        head,
      );
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

  const runOnce =
    async (): Promise<RepositorySynchronizationStatus> => {
      try {
        await reconcileConcreteLocalSnapshot();
      } catch {
        current = {
          local_git: "issue",
          remote: current.remote,
        };
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
            const applied =
              remoteSnapshot.tasks.length === 0 &&
              remoteSnapshot.recurrences.length === 0
                ? null
                : await applySynchronizedCanonicalState(
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
            await markAdoptedHead(database, remoteHead);
            await markExported(
              database,
              applied?.revision ?? switched.revision,
              remoteHead,
            );
            continue;
          } catch {
            return structuralIssue();
          }
        }

        const localMatchesRemote =
          JSON.stringify({
            tasks: state.tasks,
            recurrences: state.recurrences,
          }) ===
          JSON.stringify({
            tasks: remoteSnapshot.tasks,
            recurrences: remoteSnapshot.recurrences,
          });
        const pending =
          state.revision !== metadata.last_exported_revision ||
          metadata.last_exported_head === null ||
          metadata.pending_sync;
        const decision = decideSynchronization({
          remote_rewritten: observation.remote_rewritten,
          lineage: observation.lineage,
          local_pending: pending,
          canonical_matches_remote: localMatchesRemote,
        });

        if (decision === "attention") {
          return structuralIssue();
        }
        if (decision === "synchronized") {
          remoteFailureCount = 0;
          const status = await setStatus("synchronized");
          schedule(SYNCHRONIZATION_HEALTHY_POLL_MS);
          return status;
        }
        if (decision === "adopt") {
          try {
            const representedRevision =
              localMatchesRemote
                ? state.revision
                : (
                    await applySynchronizedCanonicalState(
                      database,
                      state.revision,
                      remoteSnapshot.tasks,
                      remoteSnapshot.recurrences,
                      remoteHead,
                    )
                  ).revision;
            await alignAndroidPortableHead(
              effects,
              observation.local_head,
              remoteHead,
            );
            await markAdoptedHead(database, remoteHead);
            await markExported(
              database,
              representedRevision,
              remoteHead,
            );
            continue;
          } catch {
            continue;
          }
        }

        try {
          if (
            (await androidPortableHead(effects)) !==
            observation.local_head
          ) {
            continue;
          }
          if (await isPending()) {
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
        await active.catch(() => current);
      }
    },
    status: () => current,
    notifyMutation: () => {
      current = {
        local_git: "pending",
        remote: {
          ...current.remote,
          state:
            current.remote.state === "not-configured"
              ? "not-configured"
              : "pending",
        },
      };
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
