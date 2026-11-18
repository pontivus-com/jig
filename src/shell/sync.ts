import {
  ensurePortableData,
  EXPORT_DEBOUNCE_MS,
  EXPORT_MAX_FLUSH_MS,
  inspectSynchronizationRemote,
  readCurrentPortableSnapshot,
  retryDelayMs,
  serializeSnapshot,
  SYNC_HEALTHY_POLL_MS,
  type GitAdapterConfig,
  type RepositorySynchronizationResult,
  type SynchronizationRemote,
  synchronizePortableData,
  writePortableSnapshot,
} from "./git";
import type {
  LocalGitSnapshotState,
  RemoteGitSynchronization,
  RepositorySynchronizationStatus,
} from "../protocol";
import {
  adoptCanonicalSnapshot,
  markAdoptedHead,
  markExported,
  readCanonicalState,
  readMetadata,
  type JigSqlConnection,
} from "../persistence/sqlite";

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
  readonly synchronize: (
    config: GitAdapterConfig,
  ) => Promise<RepositorySynchronizationResult>;
  readonly inspectRemote: typeof inspectSynchronizationRemote;
}

const REAL_EFFECTS: SyncEffects = {
  ensurePortableData,
  readCurrentSnapshot: readCurrentPortableSnapshot,
  writeSnapshot: writePortableSnapshot,
  synchronize: synchronizePortableData,
  inspectRemote: inspectSynchronizationRemote,
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

  let remoteIdentity: SynchronizationRemote | null = null;
  let currentStatus = synchronizationStatus(
    "pending",
    remoteIdentity,
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

    const { head, snapshot } = current;
    const expected = serializeSnapshot(
      state.tasks,
      metadata.dataset_id,
      state.recurrences,
    );
    const contentMatches = snapshotsEqual(snapshot.files, expected.files);

    if (contentMatches) {
      if (
        metadata.last_exported_head !== head ||
        metadata.last_exported_revision !== state.revision
      ) {
        await markExported(db, state.revision, head);
      }
      if (metadata.last_adopted_head !== head) {
        await markAdoptedHead(db, head);
      }
      return;
    }

    const localMutationPending =
      state.revision !== metadata.last_exported_revision ||
      metadata.pending_sync;
    if (localMutationPending) {
      return;
    }

    await adoptCanonicalSnapshot(
      db,
      snapshot.tasks,
      snapshot.recurrences,
      head,
    );
  };

  const currentRevisionCommitted = async (): Promise<boolean> => {
    const metadata = await readMetadata(db);
    return (
      metadata.revision === metadata.last_exported_revision &&
      metadata.last_exported_head !== null
    );
  };

  const runOnce = async (): Promise<RepositorySynchronizationStatus> => {
    try {
      const datasetId = (await readMetadata(db)).dataset_id;
      await effects.ensurePortableData(adapter, datasetId);
      await reconcileConcreteLocalSnapshot();

      const state = await readCanonicalState(db);
      const metadata = await readMetadata(db);
      if (
        state.revision !== metadata.last_exported_revision ||
        metadata.last_exported_head === null
      ) {
        currentStatus = synchronizationStatus(
          "pending",
          remoteIdentity,
          "pending",
        );
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
      }
      localFailureCount = 0;
    } catch {
      localFailureCount += 1;
      currentStatus = synchronizationStatus(
        "issue",
        remoteIdentity,
        "pending",
      );
      schedule(retryDelayMs(localFailureCount));
      return currentStatus;
    }

    try {
      remoteIdentity = await effects.inspectRemote(adapter);
    } catch {
      remoteFailureCount += 1;
      currentStatus = synchronizationStatus(
        "committed",
        remoteIdentity,
        remoteFailureCount >= 7 ? "sync-issue" : "retrying",
      );
      schedule(retryDelayMs(remoteFailureCount));
      return currentStatus;
    }

    if (remoteIdentity === null) {
      firstDirtyAt = null;
      remoteFailureCount = 0;
      currentStatus = synchronizationStatus(
        "committed",
        null,
        "pending",
      );
      schedule(SYNC_HEALTHY_POLL_MS);
      return currentStatus;
    }

    currentStatus = synchronizationStatus(
      "committed",
      remoteIdentity,
      "pending",
    );

    let pushed: RepositorySynchronizationResult;
    try {
      pushed = await effects.synchronize(adapter);
    } catch {
      pushed = { status: "sync-issue", retryable: true };
    }
    firstDirtyAt = null;

    if (pushed.status === "not-configured") {
      remoteIdentity = null;
      remoteFailureCount = 0;
      currentStatus = synchronizationStatus(
        "committed",
        null,
        "pending",
      );
      schedule(SYNC_HEALTHY_POLL_MS);
      return currentStatus;
    }

    if (pushed.status === "sync-issue") {
      if (!pushed.retryable) {
        remoteFailureCount = 7;
        currentStatus = synchronizationStatus(
          "committed",
          remoteIdentity,
          "sync-issue",
        );
        schedule(SYNC_HEALTHY_POLL_MS);
        return currentStatus;
      }

      remoteFailureCount += 1;
      currentStatus = synchronizationStatus(
        "committed",
        remoteIdentity,
        remoteFailureCount >= 7 ? "sync-issue" : "retrying",
      );
      schedule(retryDelayMs(remoteFailureCount));
      return currentStatus;
    }

    remoteFailureCount = 0;
    if (!(await currentRevisionCommitted())) {
      currentStatus = synchronizationStatus(
        "pending",
        remoteIdentity,
        "pending",
      );
      schedule(0);
      return currentStatus;
    }

    currentStatus = synchronizationStatus(
      "committed",
      remoteIdentity,
      "synchronized",
    );
    schedule(SYNC_HEALTHY_POLL_MS);
    return currentStatus;
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
      const datasetId = (await readMetadata(db)).dataset_id;
      await effects.ensurePortableData(adapter, datasetId);
      await reconcileConcreteLocalSnapshot();
      remoteIdentity = await effects.inspectRemote(adapter);

      if (!(await currentRevisionCommitted())) {
        currentStatus = synchronizationStatus(
          "pending",
          remoteIdentity,
          "pending",
        );
        schedule(0);
        return;
      }

      if (remoteIdentity === null) {
        currentStatus = synchronizationStatus(
          "committed",
          null,
          "pending",
        );
        schedule(SYNC_HEALTHY_POLL_MS);
        return;
      }

      currentStatus = synchronizationStatus(
        "committed",
        remoteIdentity,
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
        remoteIdentity,
        "pending",
      );
      const now = Date.now();
      firstDirtyAt ??= now;
      const latestTarget = now + EXPORT_DEBOUNCE_MS;
      const maximumTarget = firstDirtyAt + EXPORT_MAX_FLUSH_MS;
      schedule(Math.max(0, Math.min(latestTarget, maximumTarget) - now));
    },
    trigger,
    status: () => currentStatus,
  };
}
