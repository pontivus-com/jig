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
  type CanonicalPlanning,
} from "../../../src/core/reconciliation";
import {
  decideSynchronization,
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
  readonly stop: () => void;
  readonly status: () => RepositorySynchronizationStatus;
  readonly notifyMutation: () => void;
  readonly trigger: () => Promise<RepositorySynchronizationStatus>;
}

function planning(value: CanonicalPlanning): CanonicalPlanning {
  return {
    tasks: value.tasks,
    recurrences: value.recurrences,
  };
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
  let failures = 0;

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
    const metadata = await readMetadata(database);
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
    local:
      | "pending"
      | "committed"
      | "issue" =
      (await pending()) ? "pending" : "committed",
  ): Promise<RepositorySynchronizationStatus> => {
    try {
      const remote = await androidSynchronizationRemote(effects);
      current = {
        local_git: local,
        remote: {
          state: remoteState,
          remote_name: remote.name,
          remote_location: remote.location,
        },
      };
    } catch {
      current = {
        local_git: local,
        remote: {
          state: "sync-issue",
          remote_name: "origin",
          remote_location: "Android managed Git repository",
        },
      };
    }
    return current;
  };

  const repairLocalBoundary = async (): Promise<void> => {
    const metadata = await readMetadata(database);
    const state = await readCanonicalState(database);
    const head = await androidPortableHead(effects);
    const snapshot = await reopenAndroidPortableRepository(
      effects,
      metadata.dataset_id,
    );
    if (
      canonicalPlanningEqual(
        planning(state),
        planning(snapshot),
      )
    ) {
      if (
        metadata.last_exported_revision !== state.revision ||
        metadata.last_exported_head !== head
      ) {
        await markExported(database, state.revision, head);
      }
      if (metadata.last_adopted_head !== head) {
        await markAdoptedHead(database, head);
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

  const applyPlanning = async (
    expectedRevision: number,
    head: string,
    next: CanonicalPlanning,
  ): Promise<number> => {
    const state = await readCanonicalState(database);
    if (state.revision !== expectedRevision) {
      throw new Error("Synchronization revision changed");
    }
    if (canonicalPlanningEqual(planning(state), next)) {
      await markAdoptedHead(database, head);
      return state.revision;
    }
    return (
      await applySynchronizedCanonicalState(
        database,
        expectedRevision,
        next.tasks,
        next.recurrences,
        head,
      )
    ).revision;
  };

  const structuralIssue =
    async (): Promise<RepositorySynchronizationStatus> => {
      const result = await setStatus("sync-issue");
      schedule(SYNCHRONIZATION_HEALTHY_POLL_MS);
      return result;
    };

  const transientIssue =
    async (): Promise<RepositorySynchronizationStatus> => {
      failures += 1;
      const result = await setStatus(
        failures >= 7 ? "sync-issue" : "retrying",
      );
      schedule(synchronizationRetryDelayMs(failures));
      return result;
    };

  const converge = async (): Promise<RepositorySynchronizationStatus> => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const state = await readCanonicalState(database);
      const metadata = await readMetadata(database);

      let observation:
        Awaited<ReturnType<typeof observeAndroidPortableRemote>>;
      try {
        observation = await observeAndroidPortableRemote(
          effects,
          metadata.dataset_id,
          credential,
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
        if (
          state.revision !== 0 ||
          metadata.last_exported_revision !== 0 ||
          state.tasks.length !== 0 ||
          state.recurrences.length !== 0
        ) {
          return structuralIssue();
        }
        await adoptEmptyDatasetIdentity(
          database,
          metadata.dataset_id,
          remoteSnapshot.dataset_id,
        );
        const switched = await readCanonicalState(database);
        const revision = await applyPlanning(
          switched.revision,
          remoteHead,
          planning(remoteSnapshot),
        );
        await normalizeAndroidPortableHead(
          effects,
          observation.local_head,
          remoteHead,
        );
        await acknowledgeAndroidRemoteHead(effects, remoteHead);
        await markExported(database, revision, remoteHead);
        continue;
      }

      const localPlanning = planning(state);
      const remotePlanning = planning(remoteSnapshot);
      const decision = decideSynchronization({
        remote_rewritten: observation.remote_rewritten,
        lineage: observation.lineage,
        local_pending:
          state.revision !== metadata.last_exported_revision ||
          metadata.pending_sync,
        canonical_matches_remote:
          canonicalPlanningEqual(localPlanning, remotePlanning),
        base_available: observation.base !== null,
      });

      if (decision === "attention") return structuralIssue();
      if (decision === "synchronized") {
        failures = 0;
        const result = await setStatus("synchronized", "committed");
        schedule(SYNCHRONIZATION_HEALTHY_POLL_MS);
        return result;
      }
      if (decision === "normalize") {
        if (observation.local_head !== remoteHead) {
          await normalizeAndroidPortableHead(
            effects,
            observation.local_head,
            remoteHead,
          );
        }
        await acknowledgeAndroidRemoteHead(effects, remoteHead);
        await markAdoptedHead(database, remoteHead);
        await markExported(database, state.revision, remoteHead);
        continue;
      }
      if (decision === "adopt") {
        const revision = await applyPlanning(
          state.revision,
          remoteHead,
          remotePlanning,
        );
        await alignAndroidPortableHead(
          effects,
          observation.local_head,
          remoteHead,
        );
        await markExported(database, revision, remoteHead);
        continue;
      }
      if (decision === "reconcile") {
        const base = observation.base;
        if (base === null) return structuralIssue();
        const merged = reconcileCanonicalPlanning(
          planning(base.snapshot),
          localPlanning,
          remotePlanning,
        );
        if (merged.state === "conflict") {
          return structuralIssue();
        }
        await applyPlanning(
          state.revision,
          remoteHead,
          merged.planning,
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
        await exportCurrent();
      } else {
        if (
          (await androidPortableHead(effects)) !==
          observation.local_head
        ) {
          continue;
        }
        if (await pending()) await exportCurrent();
      }

      try {
        await pushAndroidPortableRepository(
          effects,
          credential,
        );
      } catch {
        continue;
      }
    }
    return transientIssue();
  };

  const runOnce = async (): Promise<RepositorySynchronizationStatus> => {
    try {
      await repairLocalBoundary();
    } catch {
      const result = await setStatus("pending", "issue");
      schedule(synchronizationRetryDelayMs(1));
      return result;
    }
    return converge();
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
      await setStatus("pending");
      schedule(0);
    },
    stop: () => {
      stopped = true;
      clearTimer();
    },
    status: () => current,
    notifyMutation: () => {
      void setStatus("pending", "pending");
      schedule(MUTATION_DEBOUNCE_MS);
    },
    trigger,
  };
}
