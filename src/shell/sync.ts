import type { Database } from "bun:sqlite";
import {
  ensurePortableData,
  EXPORT_DEBOUNCE_MS,
  EXPORT_MAX_FLUSH_MS,
  readCurrentPortableSnapshot,
  repositorySynchronizationAvailability,
  retryDelayMs,
  serializeSnapshot,
  SYNC_HEALTHY_POLL_MS,
  type GitAdapterConfig,
  synchronizePortableData,
  writePortableSnapshot,
} from "./git";
import {
  adoptCanonicalSnapshot,
  markAdoptedHead,
  markExported,
  readCanonicalState,
  readMetadata,
  type RepositoryStatus,
} from "./sqlite";

export interface SyncConfiguration {
  readonly repository_path: string;
}

export interface SyncController {
  readonly start: () => Promise<void>;
  readonly stop: () => void;
  readonly notifyMutation: () => void;
  readonly trigger: () => Promise<RepositoryStatus>;
  readonly status: () => RepositoryStatus;
}

export interface SyncEffects {
  readonly ensurePortableData: typeof ensurePortableData;
  readonly readCurrentSnapshot: typeof readCurrentPortableSnapshot;
  readonly writeSnapshot: typeof writePortableSnapshot;
  readonly synchronize: typeof synchronizePortableData;
  readonly availability: typeof repositorySynchronizationAvailability;
}

const REAL_EFFECTS: SyncEffects = {
  ensurePortableData,
  readCurrentSnapshot: readCurrentPortableSnapshot,
  writeSnapshot: writePortableSnapshot,
  synchronize: synchronizePortableData,
  availability: repositorySynchronizationAvailability,
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

export function createSyncController(
  db: Database,
  config: SyncConfiguration,
  effects: SyncEffects = REAL_EFFECTS,
): SyncController {
  const adapter: GitAdapterConfig = {
    repository_path: config.repository_path,
  };

  let currentStatus: RepositoryStatus = "pending";
  let running: Promise<RepositoryStatus> | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let firstDirtyAt: number | null = null;
  let failureCount = 0;
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
    const metadata = readMetadata(db);
    const state = readCanonicalState(db);
    const current = await effects.readCurrentSnapshot(
      adapter,
      metadata.dataset_id,
    );
    if (current === null) {
      return;
    }

    const { head, snapshot } = current;
    const expected = serializeSnapshot(state.tasks, metadata.dataset_id);
    const contentMatches = snapshotsEqual(snapshot.files, expected.files);

    if (contentMatches) {
      if (
        metadata.last_exported_head !== head ||
        metadata.last_exported_revision !== state.revision
      ) {
        markExported(db, state.revision, head);
      }
      if (metadata.last_adopted_head !== head) {
        markAdoptedHead(db, head);
      }
      return;
    }

    const localMutationPending =
      state.revision !== metadata.last_exported_revision ||
      metadata.pending_sync;
    if (localMutationPending) {
      return;
    }

    adoptCanonicalSnapshot(db, snapshot.tasks, head);
  };

  const runOnce = async (): Promise<RepositoryStatus> => {
    try {
      const datasetId = readMetadata(db).dataset_id;
      await effects.ensurePortableData(adapter, datasetId);
      await reconcileConcreteLocalSnapshot();

      const state = readCanonicalState(db);
      const metadata = readMetadata(db);
      if (state.revision !== metadata.last_exported_revision) {
        currentStatus = "pending";
        const snapshot = serializeSnapshot(
          state.tasks,
          metadata.dataset_id,
        );
        const head = await effects.writeSnapshot(
          adapter,
          snapshot,
          state.revision,
        );
        markExported(db, state.revision, head);
      }

      const pushed = await effects.synchronize(adapter);
      failureCount = pushed === "sync-issue" ? failureCount + 1 : 0;
      firstDirtyAt = null;

      if (pushed === "sync-issue") {
        currentStatus = failureCount >= 7 ? "sync-issue" : "retrying";
        schedule(retryDelayMs(failureCount));
      } else {
        currentStatus = pushed;
        schedule(SYNC_HEALTHY_POLL_MS);
      }
      return pushed;
    } catch {
      failureCount += 1;
      currentStatus = failureCount >= 7 ? "sync-issue" : "retrying";
      schedule(retryDelayMs(failureCount));
      return "sync-issue";
    }
  };

  const trigger = async (): Promise<RepositoryStatus> => {
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
      const datasetId = readMetadata(db).dataset_id;
      await effects.ensurePortableData(adapter, datasetId);
      await reconcileConcreteLocalSnapshot();

      const metadata = readMetadata(db);
      if (metadata.pending_sync) {
        currentStatus = "pending";
        schedule(0);
      } else {
        currentStatus = await effects.availability(adapter);
        schedule(SYNC_HEALTHY_POLL_MS);
      }
    },
    stop: () => {
      stopped = true;
      clearTimer();
    },
    notifyMutation: () => {
      currentStatus = "pending";
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
