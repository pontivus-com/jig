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

export interface AndroidSyncController {
  readonly start: () => Promise<void>;
  readonly stop: () => void;
  readonly status: () => RepositorySynchronizationStatus;
  readonly notifyMutation: () => void;
  readonly trigger: () => Promise<RepositorySynchronizationStatus>;
}

function factsForObservation(
  observation: AndroidPortableRemoteObservation,
  localPending: boolean,
): SynchronizationFacts {
  switch (observation.state) {
    case "absent":
      return {
        kind: "remote-absent",
        local_pending: localPending,
        previously_synchronized:
          observation.previously_synchronized,
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

  const clearTimer = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const localPending = async (): Promise<boolean> => {
    const metadata = await readMetadata(database);
    return (
      metadata.revision !== metadata.last_exported_revision ||
      metadata.last_exported_head === null ||
      metadata.pending_sync
    );
  };

  const setRemoteState = async (
    state: "pending" | "synchronized" | "sync-issue",
  ): Promise<RepositorySynchronizationStatus> => {
    const localGit = (await localPending())
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

  const reconcileConcreteLocalSnapshot =
    async (): Promise<void> => {
      const metadata = await readMetadata(database);
      const state = await readCanonicalState(database);
      const head = await androidPortableHead(effects);
      const snapshot = await reopenAndroidPortableRepository(
        effects,
        metadata.dataset_id,
      );
      const canonical = JSON.stringify({
        tasks: state.tasks,
        recurrences: state.recurrences,
      });
      const portable = JSON.stringify({
        tasks: snapshot.tasks,
        recurrences: snapshot.recurrences,
      });

      if (canonical === portable) {
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

  const observe =
    async (): Promise<AndroidPortableRemoteObservation> => {
      const metadata = await readMetadata(database);
      return observeAndroidPortableRemote(
        effects,
        metadata.dataset_id,
        metadata.last_adopted_head,
        credential,
      );
    };

  const finishInterruptedAdoption =
    async (
      observation: Extract<
        AndroidPortableRemoteObservation,
        { readonly state: "present" }
      >,
    ): Promise<boolean> => {
      const state = await readCanonicalState(database);
      const metadata = await readMetadata(database);
      if (metadata.last_adopted_head !== observation.remote_head) {
        return false;
      }

      const snapshot = await reopenAndroidPortableRepository(
        effects,
        metadata.dataset_id,
      );
      const canonicalMatchesRemote =
        JSON.stringify({
          tasks: state.tasks,
          recurrences: state.recurrences,
        }) ===
        JSON.stringify({
          tasks: observation.remote_snapshot.tasks,
          recurrences: observation.remote_snapshot.recurrences,
        });
      if (!canonicalMatchesRemote) {
        return false;
      }

      if (
        observation.lineage !== "equal" &&
        observation.lineage !== "remote-ahead"
      ) {
        return false;
      }

      const localSnapshotMatchesCanonical =
        JSON.stringify({
          tasks: snapshot.tasks,
          recurrences: snapshot.recurrences,
        }) ===
        JSON.stringify({
          tasks: state.tasks,
          recurrences: state.recurrences,
        });
      if (
        !localSnapshotMatchesCanonical &&
        observation.local_head !== observation.remote_head
      ) {
        await alignAndroidPortableHead(
          effects,
          observation.local_head,
          observation.remote_head,
        );
      }
      await markExported(
        database,
        state.revision,
        observation.remote_head,
      );
      return true;
    };

  const adoptRemote =
    async (
      observation: Extract<
        AndroidPortableRemoteObservation,
        { readonly state: "present" }
      >,
    ): Promise<void> => {
      const state = await readCanonicalState(database);
      const adopted = await adoptCanonicalSnapshot(
        database,
        observation.remote_snapshot.tasks,
        observation.remote_snapshot.recurrences,
        observation.remote_head,
        state.revision,
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

  const afterObservation =
    async (
      observation: AndroidPortableRemoteObservation,
      allowPush: boolean,
    ): Promise<RepositorySynchronizationStatus | null> => {
      const decision = decideSynchronization(
        factsForObservation(
          observation,
          await localPending(),
        ),
      );

      if (decision.kind === "attention") {
        return setRemoteState("sync-issue");
      }

      if (decision.kind === "synchronized") {
        if (observation.state !== "present") {
          return setRemoteState("sync-issue");
        }
        await markAdoptedHead(
          database,
          observation.remote_head,
        );
        return setRemoteState("synchronized");
      }

      if (decision.kind === "adopt-remote") {
        if (observation.state !== "present") {
          return setRemoteState("sync-issue");
        }
        try {
          await adoptRemote(observation);
        } catch {
          return setRemoteState("sync-issue");
        }
        return null;
      }

      if (decision.kind === "local-only") {
        return setRemoteState("sync-issue");
      }

      if (!allowPush) {
        return setRemoteState(
          (await localPending()) ? "pending" : "sync-issue",
        );
      }

      if (await localPending()) {
        await exportCurrent();
      }

      try {
        await pushAndroidPortableRepository(
          effects,
          credential,
        );
      } catch {
        let afterFailure: AndroidPortableRemoteObservation;
        try {
          afterFailure = await observe();
        } catch {
          return setRemoteState("sync-issue");
        }
        const failureDecision = decideSynchronization(
          factsForObservation(
            afterFailure,
            await localPending(),
          ),
        );
        if (failureDecision.kind === "push-local") {
          return setRemoteState("sync-issue");
        }
        return afterObservation(afterFailure, false);
      }

      let confirmed: AndroidPortableRemoteObservation;
      try {
        confirmed = await observe();
      } catch {
        return setRemoteState("sync-issue");
      }
      return afterObservation(confirmed, false);
    };

  const runOnce =
    async (): Promise<RepositorySynchronizationStatus> => {
      try {
        await reconcileConcreteLocalSnapshot();
      } catch {
        current = {
          ...current,
          local_git: "issue",
        };
        return current;
      }

      let observation: AndroidPortableRemoteObservation;
      try {
        observation = await observe();
      } catch {
        return setRemoteState("sync-issue");
      }

      if (
        observation.state === "present" &&
        await finishInterruptedAdoption(observation)
      ) {
        try {
          observation = await observe();
        } catch {
          return setRemoteState("sync-issue");
        }
      }

      try {
        const result = await afterObservation(
          observation,
          true,
        );
        if (result !== null) {
          return result;
        }

        const confirmed = await observe();
        return (
          await afterObservation(confirmed, false)
        ) ?? setRemoteState("sync-issue");
      } catch {
        return setRemoteState("sync-issue");
      }
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
      await reconcileConcreteLocalSnapshot();
      await setRemoteState("pending");
    },
    stop: () => {
      stopped = true;
      clearTimer();
    },
    status: () => current,
    notifyMutation: () => {
      void setRemoteState("pending");
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
