import {
  adoptCanonicalSnapshot,
  markExported,
  readCanonicalState,
  readMetadata,
  type JigSqlConnection,
} from "../../../src/persistence/sqlite";
import type {
  RepositorySynchronizationStatus,
} from "../../../src/protocol";
import {
  androidSynchronizationRemote,
  commitAndroidCanonicalState,
  synchronizeAndroidPortableRepository,
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

  const clearTimer = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const setRemoteState = async (
    localGit: "pending" | "committed" | "issue",
    state: "pending" | "synchronized" | "sync-issue",
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

  const runOnce = async (): Promise<RepositorySynchronizationStatus> => {
    let metadata = await readMetadata(database);
    let state = await readCanonicalState(database);

    if (
      metadata.revision !== metadata.last_exported_revision ||
      metadata.last_exported_head === null
    ) {
      await setRemoteState("pending", "pending");
      try {
        const head = await commitAndroidCanonicalState(
          effects,
          state,
          metadata.dataset_id,
        );
        await markExported(database, state.revision, head);
      } catch {
        return setRemoteState("issue", "pending");
      }
    }

    metadata = await readMetadata(database);
    try {
      const result = await synchronizeAndroidPortableRepository(
        effects,
        metadata.dataset_id,
        credential,
      );
      if (result.state === "diverged") {
        return setRemoteState("committed", "sync-issue");
      }
      if (
        result.state === "remote-adopted" &&
        result.snapshot !== null
      ) {
        await adoptCanonicalSnapshot(
          database,
          result.snapshot.tasks,
          result.snapshot.recurrences,
          result.head,
        );
      }
    } catch {
      return setRemoteState("committed", "sync-issue");
    }

    metadata = await readMetadata(database);
    state = await readCanonicalState(database);
    if (
      metadata.revision !== state.revision ||
      metadata.last_exported_revision !== state.revision
    ) {
      await setRemoteState("pending", "pending");
      if (!stopped) {
        clearTimer();
        timer = setTimeout(() => {
          void trigger();
        }, 0);
      }
      return current;
    }
    return setRemoteState("committed", "synchronized");
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
      const metadata = await readMetadata(database);
      await setRemoteState(
        metadata.revision === metadata.last_exported_revision &&
          metadata.last_exported_head !== null
          ? "committed"
          : "pending",
        "pending",
      );
    },
    stop: () => {
      stopped = true;
      clearTimer();
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
