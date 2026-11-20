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
  markAdoptedHead,
  markExported,
  readCanonicalState,
  readMetadata,
  type JigSqlConnection,
} from "../persistence/sqlite";
import {
  adoptObservedSynchronizationRemote,
  finishInterruptedSynchronizationAdoption,
  reconcilePersistedPortableSnapshot,
  synchronizationPending,
} from "../persistence/synchronization";
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

interface ObservedPortableRemote {
  readonly revision: number;
  readonly observation: PortableRemoteObservation;
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

const UNRESOLVED_REMOTE: SynchronizationRemote = {
  name: "unresolved",
  location: "Configured Git synchronization is unavailable or ambiguous",
};

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

function observationRemote(
  observation: PortableRemoteObservation,
): SynchronizationRemote | null {
  if (observation.state === "ambiguous") return UNRESOLVED_REMOTE;
  if (
    observation.state === "absent" ||
    observation.state === "unsafe" ||
    observation.state === "present"
  ) {
    return observation.remote;
  }
  return null;
}

function observationFacts(
  observation: PortableRemoteObservation,
  localPending: boolean,
): SynchronizationFacts {
  switch (observation.state) {
    case "none":
      return { kind: "no-remote" };
    case "ambiguous":
    case "unsafe":
      return { kind: "unsafe-remote" };
    case "absent":
      return {
        kind: "remote-absent",
        previously_synchronized: observation.previously_synchronized,
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

export function createSyncController(
  db: JigSqlConnection,
  config: SyncConfiguration,
  effectOverrides: Partial<SyncEffects> = {},
): SyncController {
  const effects: SyncEffects = { ...REAL_EFFECTS, ...effectOverrides };
  const adapter: GitAdapterConfig = {
    repository_path: config.repository_path,
  };

  let remoteIdentity: SynchronizationRemote | null = null;
  let currentStatus: RepositorySynchronizationStatus = {
    local_git: "pending",
    remote: remoteStatus(null, "pending"),
  };
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
    if (stopped) return;
    clearTimer();
    timer = setTimeout(() => {
      void trigger();
    }, delayMs);
  };

  const isPending = (): Promise<boolean> =>
    synchronizationPending(db);

  const setStatus = async (
    remoteState: "pending" | "retrying" | "synchronized" | "sync-issue",
    localOverride?: LocalGitSnapshotState,
  ): Promise<RepositorySynchronizationStatus> => {
    currentStatus = {
      local_git:
        localOverride ??
        ((await isPending()) ? "pending" : "committed"),
      remote: remoteStatus(remoteIdentity, remoteState),
    };
    return currentStatus;
  };

  const localIssue = async (): Promise<RepositorySynchronizationStatus> => {
    localFailureCount += 1;
    const status = await setStatus("pending", "issue");
    schedule(retryDelayMs(localFailureCount));
    return status;
  };

  const remoteIssue = async (
    retryable: boolean,
  ): Promise<RepositorySynchronizationStatus> => {
    if (retryable) {
      remoteFailureCount += 1;
      const status = await setStatus(
        remoteFailureCount >= 7 ? "sync-issue" : "retrying",
      );
      schedule(retryDelayMs(remoteFailureCount));
      return status;
    }
    remoteFailureCount = 7;
    const status = await setStatus("sync-issue");
    schedule(SYNC_HEALTHY_POLL_MS);
    return status;
  };

  const reconcileLocalSnapshot = (): Promise<void> =>
    reconcilePersistedPortableSnapshot(
      db,
      (datasetId) => effects.readCurrentSnapshot(adapter, datasetId),
    );

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

  const observe = async (
    environment: Readonly<Record<string, string>>,
  ): Promise<ObservedPortableRemote> => {
    const metadata = await readMetadata(db);
    return {
      revision: metadata.revision,
      observation: await effects.observeRemote(
        adapter,
        metadata.dataset_id,
        metadata.last_adopted_head,
        environment,
      ),
    };
  };

  const finishInterruptedAdoption = (
    observation: Extract<
      PortableRemoteObservation,
      { readonly state: "present" }
    >,
  ) =>
    finishInterruptedSynchronizationAdoption(
      db,
      observation,
      (expectedHead, targetHead) =>
        effects.alignLocal(adapter, expectedHead, targetHead),
    );

  const adoptRemote = (
    observation: Extract<
      PortableRemoteObservation,
      { readonly state: "present" }
    >,
    expectedRevision: number,
  ) =>
    adoptObservedSynchronizationRemote(
      db,
      observation,
      expectedRevision,
      (expectedHead, targetHead) =>
        effects.alignLocal(adapter, expectedHead, targetHead),
    );

  const processObservation = async (
    observed: ObservedPortableRemote,
    environment: Readonly<Record<string, string>>,
    mayPush: boolean,
  ): Promise<RepositorySynchronizationStatus | null> => {
    const { observation } = observed;
    remoteIdentity = observationRemote(observation);
    const decision = decideSynchronization(
      observationFacts(observation, await isPending()),
    );

    if (decision.kind === "attention") {
      return remoteIssue(false);
    }

    if (decision.kind === "local-only") {
      try {
        if (await isPending()) await exportCurrent();
      } catch {
        return localIssue();
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
      if (observation.state !== "present") return remoteIssue(false);
      await markAdoptedHead(db, observation.remote_head);
      firstDirtyAt = null;
      remoteFailureCount = 0;
      const status = await setStatus("synchronized");
      schedule(SYNC_HEALTHY_POLL_MS);
      return status;
    }

    if (decision.kind === "adopt-remote") {
      if (observation.state !== "present") return remoteIssue(false);
      try {
        await adoptRemote(observation, observed.revision);
      } catch {
        return remoteIssue(false);
      }
      return null;
    }

    if (!mayPush) {
      if (await isPending()) {
        const status = await setStatus("pending");
        schedule(0);
        return status;
      }
      return remoteIssue(true);
    }

    if (remoteIdentity === null) return remoteIssue(false);
    try {
      if (await isPending()) await exportCurrent();
    } catch {
      return localIssue();
    }

    let pushed;
    try {
      pushed = await effects.push(
        adapter,
        remoteIdentity,
        environment,
      );
    } catch {
      pushed = { status: "sync-issue", retryable: true } as const;
    }

    let afterPush: ObservedPortableRemote;
    try {
      afterPush = await observe(environment);
    } catch {
      remoteIdentity ??= UNRESOLVED_REMOTE;
      return remoteIssue(true);
    }

    if (pushed.status === "sync-issue") {
      const afterDecision = decideSynchronization(
        observationFacts(
          afterPush.observation,
          await isPending(),
        ),
      );
      if (afterDecision.kind === "push-local") {
        return remoteIssue(pushed.retryable);
      }
    }

    return processObservation(afterPush, environment, false);
  };

  const runOnce = async (): Promise<RepositorySynchronizationStatus> => {
    try {
      const datasetId = (await readMetadata(db)).dataset_id;
      await effects.ensurePortableData(adapter, datasetId);
      await reconcileLocalSnapshot();
      localFailureCount = 0;
    } catch {
      return localIssue();
    }

    let environment: Readonly<Record<string, string>> | null;
    try {
      environment = await effects.networkEnvironment();
    } catch {
      remoteIdentity ??= UNRESOLVED_REMOTE;
      return remoteIssue(true);
    }
    if (environment === null) {
      remoteIdentity ??= UNRESOLVED_REMOTE;
      return remoteIssue(false);
    }

    let observed: ObservedPortableRemote;
    try {
      observed = await observe(environment);
    } catch {
      remoteIdentity ??= UNRESOLVED_REMOTE;
      try {
        if (await isPending()) {
          await exportCurrent();
        }
        localFailureCount = 0;
      } catch {
        return localIssue();
      }
      return remoteIssue(true);
    }
    remoteIdentity = observationRemote(observed.observation);

    if (observed.observation.state === "present") {
      const interrupted =
        await finishInterruptedAdoption(observed.observation);
      if (interrupted === "unsafe") {
        return remoteIssue(false);
      }
      if (interrupted === "finished") {
        try {
          observed = await observe(environment);
        } catch {
          return remoteIssue(true);
        }
      }
    }

    const result = await processObservation(
      observed,
      environment,
      true,
    );
    if (result !== null) return result;

    try {
      const confirmed = await observe(environment);
      return (
        await processObservation(
          confirmed,
          environment,
          false,
        )
      ) ?? remoteIssue(false);
    } catch {
      return remoteIssue(true);
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
        const datasetId = (await readMetadata(db)).dataset_id;
        await effects.ensurePortableData(adapter, datasetId);
        await reconcileLocalSnapshot();
      } catch {
        await localIssue();
        return;
      }
      currentStatus = {
        local_git: (await isPending()) ? "pending" : "committed",
        remote: remoteStatus(remoteIdentity, "pending"),
      };
      schedule(0);
    },
    stop: () => {
      stopped = true;
      clearTimer();
    },
    notifyMutation: () => {
      currentStatus = {
        local_git: "pending",
        remote: remoteStatus(remoteIdentity, "pending"),
      };
      const now = Date.now();
      firstDirtyAt ??= now;
      schedule(
        Math.max(
          0,
          Math.min(
            now + EXPORT_DEBOUNCE_MS,
            firstDirtyAt + EXPORT_MAX_FLUSH_MS,
          ) - now,
        ),
      );
    },
    trigger,
    status: () => currentStatus,
  };
}
