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
import { portableSnapshotsEqual } from "../portable";
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

interface ObservedPortableRemote {
  readonly revision: number;
  readonly observation: PortableRemoteObservation;
}

type InterruptedAdoptionResult =
  | "not-applicable"
  | "finished"
  | "unsafe";

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
      return { kind: "no-remote", local_pending: localPending };
    case "ambiguous":
    case "unsafe":
      return { kind: "unsafe-remote" };
    case "absent":
      return {
        kind: "remote-absent",
        local_pending: localPending,
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

  const isPending = async (): Promise<boolean> => {
    const metadata = await readMetadata(db);
    return (
      metadata.revision !== metadata.last_exported_revision ||
      metadata.last_exported_head === null ||
      metadata.pending_sync
    );
  };

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

  const reconcileLocalSnapshot = async (): Promise<void> => {
    const metadata = await readMetadata(db);
    const state = await readCanonicalState(db);
    const current = await effects.readCurrentSnapshot(
      adapter,
      metadata.dataset_id,
    );
    if (current === null) return;

    const canonical = serializeSnapshot(
      state.tasks,
      metadata.dataset_id,
      state.recurrences,
    );
    if (portableSnapshotsEqual(current.snapshot, canonical)) {
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

  const finishInterruptedAdoption = async (
    observation: Extract<
      PortableRemoteObservation,
      { readonly state: "present" }
    >,
  ): Promise<InterruptedAdoptionResult> => {
    const state = await readCanonicalState(db);
    const metadata = await readMetadata(db);
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
      observation.local_head === null ||
      (
        observation.lineage !== "equal" &&
        observation.lineage !== "remote-ahead"
      )
    ) {
      return "unsafe";
    }

    if (observation.local_head !== observation.remote_head) {
      try {
        await effects.alignLocal(
          adapter,
          observation.local_head,
          observation.remote_head,
        );
      } catch {
        return "unsafe";
      }
    }
    await markExported(db, state.revision, observation.remote_head);
    return "finished";
  };

  const adoptRemote = async (
    observation: Extract<
      PortableRemoteObservation,
      { readonly state: "present" }
    >,
    expectedRevision: number,
  ): Promise<void> => {
    if (observation.local_head === null) {
      throw new Error("Local jig-data head is unavailable");
    }
    const adopted = await adoptCanonicalSnapshot(
      db,
      observation.remote_snapshot.tasks,
      observation.remote_snapshot.recurrences,
      observation.remote_head,
      expectedRevision,
    );
    await effects.alignLocal(
      adapter,
      observation.local_head,
      observation.remote_head,
    );
    await markExported(db, adopted.revision, observation.remote_head);
  };

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
