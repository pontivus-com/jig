import {
  markAdoptedHead,
  readMetadata,
  type JigSqlConnection,
} from "../../../src/persistence/sqlite";
import {
  adoptObservedSynchronizationRemote,
  exportCanonicalPortableSnapshot,
  finishInterruptedSynchronizationAdoption,
  reconcilePersistedPortableSnapshot,
  synchronizationPending,
} from "../../../src/persistence/synchronization";
import type {
  RepositorySynchronizationStatus,
} from "../../../src/protocol";
import {
  decideSynchronization,
  type SynchronizationFacts,
} from "../../../src/core/synchronization";
import {
  alignAndroidPortableHead,
  androidPortableHead,
  androidSynchronizationRemote,
  commitAndroidPortableSnapshot,
  observeAndroidPortableRemote,
  pushAndroidPortableRepository,
  reopenAndroidPortableRepository,
  type AndroidGitEffects,
  type AndroidPortableRemoteObservation,
  type GitCredentialProvider,
} from "./git";

const MUTATION_DEBOUNCE_MS = 3_000;

interface ObservedAndroidRemote {
  readonly revision: number;
  readonly observation: AndroidPortableRemoteObservation;
}

export interface AndroidSyncController {
  readonly start: () => Promise<void>;
  readonly stop: () => void;
  readonly status: () => RepositorySynchronizationStatus;
  readonly notifyMutation: () => void;
  readonly trigger: () => Promise<RepositorySynchronizationStatus>;
}

function observationFacts(
  observation: AndroidPortableRemoteObservation,
  localPending: boolean,
): SynchronizationFacts {
  switch (observation.state) {
    case "absent":
      return {
        kind: "remote-absent",
        previously_synchronized: observation.previously_synchronized,
      };
    case "unsafe":
      return { kind: "unsafe-remote" };
    case "present":
      return {
        kind: "remote-present",
        local_pending: localPending,
        remote_rewritten: observation.remote_rewritten,
        lineage: observation.lineage,
      };
  }
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
  let running: Promise<RepositorySynchronizationStatus> | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  const clearTimer = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const isPending = (): Promise<boolean> =>
    synchronizationPending(database);

  const setRemoteState = async (
    state: "pending" | "synchronized" | "sync-issue",
    localOverride?: "pending" | "committed" | "issue",
  ): Promise<RepositorySynchronizationStatus> => {
    const localGit =
      localOverride ??
      ((await isPending()) ? "pending" : "committed");
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

  const reconcileLocalSnapshot = (): Promise<void> =>
    reconcilePersistedPortableSnapshot(
      database,
      async (datasetId) => ({
        head: await androidPortableHead(effects),
        snapshot: await reopenAndroidPortableRepository(
          effects,
          datasetId,
        ),
      }),
    );

  const exportCurrent = async (): Promise<void> => {
    await exportCanonicalPortableSnapshot(
      database,
      (snapshot, revision) =>
        commitAndroidPortableSnapshot(
          effects,
          snapshot,
          revision,
        ),
    );
  };

  const observe = async (): Promise<ObservedAndroidRemote> => {
    const metadata = await readMetadata(database);
    return {
      revision: metadata.revision,
      observation: await observeAndroidPortableRemote(
        effects,
        metadata.dataset_id,
        metadata.last_adopted_head,
        credential,
      ),
    };
  };

  const finishInterruptedAdoption = (
    observation: Extract<
      AndroidPortableRemoteObservation,
      { readonly state: "present" }
    >,
  ) =>
    finishInterruptedSynchronizationAdoption(
      database,
      observation,
      (expectedHead, targetHead) =>
        alignAndroidPortableHead(effects, expectedHead, targetHead),
    );

  const adoptRemote = (
    observation: Extract<
      AndroidPortableRemoteObservation,
      { readonly state: "present" }
    >,
    expectedRevision: number,
  ) =>
    adoptObservedSynchronizationRemote(
      database,
      observation,
      expectedRevision,
      (expectedHead, targetHead) =>
        alignAndroidPortableHead(effects, expectedHead, targetHead),
    );

  const processObservation = async (
    observed: ObservedAndroidRemote,
    mayPush: boolean,
  ): Promise<RepositorySynchronizationStatus | null> => {
    const { observation } = observed;
    const decision = decideSynchronization(
      observationFacts(observation, await isPending()),
    );

    if (decision.kind === "attention") {
      return setRemoteState("sync-issue");
    }
    if (decision.kind === "synchronized") {
      if (observation.state !== "present") {
        return setRemoteState("sync-issue");
      }
      await markAdoptedHead(database, observation.remote_head);
      return setRemoteState("synchronized");
    }
    if (decision.kind === "adopt-remote") {
      if (observation.state !== "present") {
        return setRemoteState("sync-issue");
      }
      try {
        await adoptRemote(observation, observed.revision);
      } catch {
        return setRemoteState("sync-issue");
      }
      return null;
    }
    if (decision.kind === "local-only") {
      return setRemoteState("sync-issue");
    }
    if (!mayPush) {
      return setRemoteState("sync-issue");
    }

    try {
      if (await isPending()) await exportCurrent();
    } catch {
      return setRemoteState("pending", "issue");
    }

    try {
      await pushAndroidPortableRepository(effects, credential);
    } catch {
      let afterFailure: ObservedAndroidRemote;
      try {
        afterFailure = await observe();
      } catch {
        return setRemoteState("sync-issue");
      }
      const afterDecision = decideSynchronization(
        observationFacts(
          afterFailure.observation,
          await isPending(),
        ),
      );
      if (afterDecision.kind === "push-local") {
        return setRemoteState("sync-issue");
      }
      return processObservation(afterFailure, false);
    }

    try {
      return processObservation(await observe(), false);
    } catch {
      return setRemoteState("sync-issue");
    }
  };

  const runOnce = async (): Promise<RepositorySynchronizationStatus> => {
    try {
      await reconcileLocalSnapshot();
    } catch {
      return setRemoteState("pending", "issue");
    }

    let observed: ObservedAndroidRemote;
    try {
      observed = await observe();
    } catch {
      return setRemoteState("sync-issue");
    }

    if (observed.observation.state === "present") {
      const interrupted =
        await finishInterruptedAdoption(observed.observation);
      if (interrupted === "unsafe") {
        return setRemoteState("sync-issue");
      }
      if (interrupted === "finished") {
        try {
          observed = await observe();
        } catch {
          return setRemoteState("sync-issue");
        }
      }
    }

    const result = await processObservation(observed, true);
    if (result !== null) return result;

    try {
      return (
        await processObservation(
          await observe(),
          false,
        )
      ) ?? setRemoteState("sync-issue");
    } catch {
      return setRemoteState("sync-issue");
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
      try {
        await reconcileLocalSnapshot();
      } catch {
        await setRemoteState("pending", "issue");
        return;
      }
      await setRemoteState("pending");
    },
    stop: () => {
      stopped = true;
      clearTimer();
    },
    status: () => current,
    notifyMutation: () => {
      void setRemoteState("pending");
      if (stopped) return;
      clearTimer();
      timer = setTimeout(() => {
        void trigger();
      }, MUTATION_DEBOUNCE_MS);
    },
    trigger,
  };
}
