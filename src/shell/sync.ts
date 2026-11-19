import {
  alignPortableDataRef,
  ensurePortableData,
  EXPORT_DEBOUNCE_MS,
  EXPORT_MAX_FLUSH_MS,
  observePortableRemote,
  pushPortableDataRef,
  readCurrentPortableSnapshot,
  retryDelayMs,
  serializeSnapshot,
  SYNC_HEALTHY_POLL_MS,
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
  adoptCanonicalSnapshot,
  markAdoptedHead,
  markExported,
  readCanonicalState,
  readMetadata,
  type JigSqlConnection,
} from "../persistence/sqlite";
import {
  decideSynchronization,
  type SynchronizationFacts,
} from "../core/synchronization";

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
  observeRemote: observePortableRemote,
  alignLocal: alignPortableDataRef,
  push: pushPortableDataRef,
  networkEnvironment: async () => ({}),
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

function factsForObservation(
  observation: PortableRemoteObservation,
  localPending: boolean,
): SynchronizationFacts {
  switch (observation.state) {
    case "none":
      return {
        kind: "no-remote",
        local_pending: localPending,
      };
    case "ambiguous":
    case "unsafe":
      return { kind: "unsafe-remote" };
    case "absent":
      return {
        kind: "remote-absent",
        local_pending: localPending,
        previously_synchronized:
          observation.previously_synchronized,
      };
    case "present":
      return {
        kind: "remote-present",
        local_pending: localPending,
        remote_rewritten: observation.remote_rewritten,
        lineage: observation.lineage,
      };
  }
}

function remoteFromObservation(
  observation: PortableRemoteObservation,
): SynchronizationRemote | null {
  return observation.state === "absent" ||
    observation.state === "present" ||
    observation.state === "unsafe"
    ? observation.remote
    : null;
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

  const localPending = async (): Promise<boolean> => {
    const metadata = await readMetadata(db);
    return (
      metadata.revision !== metadata.last_exported_revision ||
      metadata.last_exported_head === null ||
      metadata.pending_sync
    );
  };

  const setStatus = async (
    remoteState: "pending" | "retrying" | "synchronized" | "sync-issue",
  ): Promise<RepositorySynchronizationStatus> => {
    currentStatus = synchronizationStatus(
      (await localPending()) ? "pending" : "committed",
      remoteIdentity,
      remoteState,
    );
    return currentStatus;
  };

  const structuralIssue =
    async (): Promise<RepositorySynchronizationStatus> => {
      const status = await setStatus("sync-issue");
      schedule(SYNC_HEALTHY_POLL_MS);
      return status;
    };

  const transientIssue =
    async (): Promise<RepositorySynchronizationStatus> => {
      remoteFailureCount += 1;
      const status = await setStatus(
        remoteFailureCount >= 7 ? "sync-issue" : "retrying",
      );
      schedule(retryDelayMs(remoteFailureCount));
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
      if (snapshotsEqual(current.snapshot.files, expected.files)) {
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

      const adopted = await adoptCanonicalSnapshot(
        db,
        current.snapshot.tasks,
        current.snapshot.recurrences,
        null,
        state.revision,
      );
      await markExported(db, adopted.revision, current.head);
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

  const observe =
    async (
      environment: Readonly<Record<string, string>>,
    ): Promise<PortableRemoteObservation> => {
      const metadata = await readMetadata(db);
      return effects.observeRemote(
        adapter,
        metadata.dataset_id,
        metadata.last_adopted_head,
        environment,
      );
    };

  const finishInterruptedAdoption =
    async (
      observation: Extract<
        PortableRemoteObservation,
        { readonly state: "present" }
      >,
    ): Promise<boolean> => {
      const state = await readCanonicalState(db);
      const metadata = await readMetadata(db);
      if (metadata.last_adopted_head !== observation.remote_head) {
        return false;
      }

      const canonical = serializeSnapshot(
        state.tasks,
        metadata.dataset_id,
        state.recurrences,
      );
      if (
        !snapshotsEqual(
          canonical.files,
          observation.remote_snapshot.files,
        )
      ) {
        return false;
      }
      if (
        observation.lineage !== "equal" &&
        observation.lineage !== "remote-ahead"
      ) {
        return false;
      }
      if (
        observation.local_head !== null &&
        observation.local_head !== observation.remote_head
      ) {
        await effects.alignLocal(
          adapter,
          observation.local_head,
          observation.remote_head,
        );
      }
      await markExported(
        db,
        state.revision,
        observation.remote_head,
      );
      return true;
    };

  const adoptRemote =
    async (
      observation: Extract<
        PortableRemoteObservation,
        { readonly state: "present" }
      >,
    ): Promise<void> => {
      if (observation.local_head === null) {
        throw new Error("Local jig-data head is unavailable");
      }
      const state = await readCanonicalState(db);
      const adopted = await adoptCanonicalSnapshot(
        db,
        observation.remote_snapshot.tasks,
        observation.remote_snapshot.recurrences,
        observation.remote_head,
        state.revision,
      );
      await effects.alignLocal(
        adapter,
        observation.local_head,
        observation.remote_head,
      );
      await markExported(
        db,
        adopted.revision,
        observation.remote_head,
      );
    };

  const synchronizeAfterObservation =
    async (
      observation: PortableRemoteObservation,
      environment: Readonly<Record<string, string>>,
      allowPush: boolean,
    ): Promise<RepositorySynchronizationStatus | null> => {
      remoteIdentity = remoteFromObservation(observation);
      const pending = await localPending();
      const decision = decideSynchronization(
        factsForObservation(observation, pending),
      );

      if (decision.kind === "attention") {
        return structuralIssue();
      }

      if (decision.kind === "local-only") {
        if (pending) {
          await exportCurrent();
        }
        firstDirtyAt = null;
        remoteFailureCount = 0;
        remoteIdentity = null;
        currentStatus = {
          local_git: "committed",
          remote: {
            state: "not-configured",
            remote_name: null,
            remote_location: null,
          },
        };
        schedule(SYNC_HEALTHY_POLL_MS);
        return currentStatus;
      }

      if (decision.kind === "synchronized") {
        if (observation.state !== "present") {
          return structuralIssue();
        }
        await markAdoptedHead(db, observation.remote_head);
        firstDirtyAt = null;
        remoteFailureCount = 0;
        const status = await setStatus("synchronized");
        schedule(SYNC_HEALTHY_POLL_MS);
        return status;
      }

      if (decision.kind === "adopt-remote") {
        if (observation.state !== "present") {
          return structuralIssue();
        }
        try {
          await adoptRemote(observation);
        } catch {
          return structuralIssue();
        }
        return null;
      }

      if (!allowPush) {
        currentStatus = synchronizationStatus(
          (await localPending()) ? "pending" : "committed",
          remoteIdentity,
          "pending",
        );
        schedule(0);
        return currentStatus;
      }

      if (remoteIdentity === null) {
        return structuralIssue();
      }

      if (await localPending()) {
        await exportCurrent();
      }

      const pushResult = await effects.push(
        adapter,
        remoteIdentity,
        environment,
      );

      let afterPush: PortableRemoteObservation;
      try {
        afterPush = await observe(environment);
      } catch {
        return transientIssue();
      }
      remoteIdentity = remoteFromObservation(afterPush);

      if (pushResult.status === "sync-issue") {
        const afterDecision = decideSynchronization(
          factsForObservation(
            afterPush,
            await localPending(),
          ),
        );
        if (afterDecision.kind === "push-local") {
          return pushResult.retryable
            ? transientIssue()
            : structuralIssue();
        }
      }

      return synchronizeAfterObservation(
        afterPush,
        environment,
        false,
      );
    };

  const runOnce =
    async (): Promise<RepositorySynchronizationStatus> => {
      try {
        const datasetId = (await readMetadata(db)).dataset_id;
        await effects.ensurePortableData(adapter, datasetId);
        await reconcileConcreteLocalSnapshot();
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

      let environment: Readonly<Record<string, string>> | null;
      try {
        environment = await effects.networkEnvironment();
      } catch {
        return transientIssue();
      }
      if (environment === null) {
        return structuralIssue();
      }

      let observation: PortableRemoteObservation;
      try {
        observation = await observe(environment);
      } catch {
        return transientIssue();
      }

      remoteIdentity = remoteFromObservation(observation);

      if (
        observation.state === "present" &&
        await finishInterruptedAdoption(observation)
      ) {
        observation = await observe(environment);
        remoteIdentity = remoteFromObservation(observation);
      }

      try {
        const result = await synchronizeAfterObservation(
          observation,
          environment,
          true,
        );
        if (result !== null) {
          return result;
        }

        const confirmed = await observe(environment);
        remoteIdentity = remoteFromObservation(confirmed);
        return (
          await synchronizeAfterObservation(
            confirmed,
            environment,
            false,
          )
        ) ?? structuralIssue();
      } catch {
        return transientIssue();
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
      const datasetId = (await readMetadata(db)).dataset_id;
      await effects.ensurePortableData(adapter, datasetId);
      await reconcileConcreteLocalSnapshot();
      currentStatus = synchronizationStatus(
        (await localPending()) ? "pending" : "committed",
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
      schedule(
        Math.max(
          0,
          Math.min(latestTarget, maximumTarget) - now,
        ),
      );
    },
    trigger,
    status: () => currentStatus,
  };
}
