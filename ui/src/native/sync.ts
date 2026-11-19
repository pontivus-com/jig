import {
  adoptCanonicalSnapshot,
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
  portableSnapshotsEqual,
  serializeSnapshot,
} from "../../../src/portable";
import {
  decideSynchronization,
  type SynchronizationFacts,
} from "../../../src/core/synchronization";
import {
  alignAndroidPortableHead,
  androidPortableHead,
  androidSynchronizationRemote,
  commitAndroidCanonicalState,
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

type InterruptedAdoptionResult =
  | "not-applicable"
  | "finished"
  | "unsafe";

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

  const isPending = async (): Promise<boolean> => {
    const metadata = await readMetadata(database);
    return (
      metadata.revision !== metadata.last_exported_revision ||
      metadata.last_exported_head === null ||
      metadata.pending_sync
    );
  };

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

  const reconcileLocalSnapshot = async (): Promise<void> => {
    const metadata = await readMetadata(database);
    const state = await readCanonicalState(database);
    const head = await androidPortableHead(effects);
    const snapshot = await reopenAndroidPortableRepository(
      effects,
      metadata.dataset_id,
    );
    const canonical = serializeSnapshot(
      state.tasks,
      metadata.dataset_id,
      state.recurrences,
    );

    if (portableSnapshotsEqual(canonical, snapshot)) {
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

    const adopted = await adoptCanonicalSnapshot(
      database,
      snapshot.tasks,
      snapshot.recurrences,
      null,
      state.revision,
    );
    await markExported(database, adopted.revision, head);
  };

  const exportCurrent = async (): Promise<void> => {
    const state = await readCanonicalState(database);
    const metadata = await readMetadata(database);
    const head = await commitAndroidCanonicalState(
      effects,
      state,
      metadata.dataset_id,
    );
    await markExported(database, state.revision, head);
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

  const finishInterruptedAdoption = async (
    observation: Extract<
      AndroidPortableRemoteObservation,
      { readonly state: "present" }
    >,
  ): Promise<InterruptedAdoptionResult> => {
    const state = await readCanonicalState(database);
    const metadata = await readMetadata(database);
    if (metadata.last_adopted_head !== observation.remote_head) {
      return "not-applicable";
    }

    const canonical = serializeSnapshot(
      state.tasks,
      metadata.dataset_id,
      state.recurrences,
    );
    if (
      !portableSnapshotsEqual(
        canonical,
        observation.remote_snapshot,
      )
    ) {
      return "not-applicable";
    }

    if (
      observation.lineage !== "equal" &&
      observation.lineage !== "remote-ahead"
    ) {
      return "unsafe";
    }

    if (observation.local_head !== observation.remote_head) {
      try {
        await alignAndroidPortableHead(
          effects,
          observation.local_head,
          observation.remote_head,
        );
      } catch {
        return "unsafe";
      }
    }
    await markExported(
      database,
      state.revision,
      observation.remote_head,
    );
    return "finished";
  };

  const adoptRemote = async (
    observation: Extract<
      AndroidPortableRemoteObservation,
      { readonly state: "present" }
    >,
    expectedRevision: number,
  ): Promise<void> => {
    const adopted = await adoptCanonicalSnapshot(
      database,
      observation.remote_snapshot.tasks,
      observation.remote_snapshot.recurrences,
      observation.remote_head,
      expectedRevision,
    );
    await alignAndroidPortableHead(
      effects,
      observation.local_head,
      observation.remote_head,
    );
    await markExported(
      database,
      adopted.revision,
      observation.remote_head,
    );
  };

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
