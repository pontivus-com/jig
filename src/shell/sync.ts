import {
  alignPortableDataRef,
  ensurePortableData,
  readCurrentPortableSnapshot,
  readSnapshotAtRef,
  writePortableSnapshot,
} from "./git/portable-store";
import {
  observePortableRemote,
  pushPortableDataRef,
  type PortableRemoteObservation,
  type SynchronizationRemote,
} from "./git/remote";
import type { GitAdapterConfig } from "./git/repository";
import {
  compareAndSetPortableHead,
  deleteRecoveryCandidate,
  readRecoveryCandidateHead,
  recoveryCandidateParents,
  recoveryCommitterTimestampSeconds,
  uniqueRecoveryMergeBase,
  writeRecoveryCandidate,
} from "./git/recovery";
import {
  sanitizeSynchronizationErrorSummary,
  synchronizationHeadPrefix,
  type LocalGitSnapshotState,
  type RemoteGitSynchronization,
  type RepositorySynchronizationStatus,
  type SynchronizationDiagnosticPhase,
  type SynchronizationDiagnostics,
} from "../protocol/runtime";
import {
  markAdoptedHead,
  readMetadata,
  type JigSqlConnection,
} from "../persistence/sqlite";
import {
  adoptObservedSynchronizationRemote,
  exportCanonicalPortableSnapshot,
  finishInterruptedSynchronizationAdoption,
  reconcilePersistedPortableSnapshot,
  synchronizationPending,
} from "../persistence/synchronization";
import {
  decideSynchronization,
  synchronizationFailureSummary,
  SYNCHRONIZATION_MUTATION_DEBOUNCE_MS,
  type SynchronizationFailureReason,
  type SynchronizationFacts,
} from "../core/synchronization";
import {
  buildJigDataConflictCase,
  reconcileRelatedPortableSnapshots,
  recoveryCommitSpec,
  type JigDataConflictCase,
} from "../core/synchronization-recovery";
import {
  SnapshotDatasetMismatchError,
  SnapshotValidationError,
  type PortableSnapshot,
} from "../core/portable";

export const SYNC_HEALTHY_POLL_MS = 60_000;
export const EXPORT_MAX_FLUSH_MS = 15_000;
export const SYNC_RETRY_SECONDS = [5, 10, 20, 40, 80, 160, 300] as const;

export function retryDelayMs(failureCount: number): number {
  if (!Number.isInteger(failureCount) || failureCount < 1) {
    throw new RangeError("failureCount must be a positive integer");
  }
  const index = Math.min(failureCount - 1, SYNC_RETRY_SECONDS.length - 1);
  return (SYNC_RETRY_SECONDS[index] ?? 300) * 1000;
}

export interface SyncConfiguration {
  readonly repository_path: string;
}

export interface SyncController {
  readonly start: () => Promise<void>;
  readonly stop: () => void;
  readonly notifyMutation: () => void;
  readonly trigger: () => Promise<RepositorySynchronizationStatus>;
  readonly status: () => RepositorySynchronizationStatus;
  readonly diagnostics: () => SynchronizationDiagnostics;
  readonly readSynchronizationConflict: () => JigDataConflictCase | null;
}

interface ObservedPortableRemote {
  readonly revision: number;
  readonly last_adopted_head: string | null;
  readonly observation: PortableRemoteObservation;
}

export interface SyncEffects {
  readonly ensurePortableData: typeof ensurePortableData;
  readonly readCurrentSnapshot: typeof readCurrentPortableSnapshot;
  readonly readSnapshotAtRef: (
    config: GitAdapterConfig,
    ref: string,
    datasetId: string,
  ) => Promise<PortableSnapshot>;
  readonly writeSnapshot: typeof writePortableSnapshot;
  readonly observeRemote: typeof observePortableRemote;
  readonly alignLocal: typeof alignPortableDataRef;
  readonly push: typeof pushPortableDataRef;
  readonly readRecoveryCandidateHead: typeof readRecoveryCandidateHead;
  readonly recoveryCandidateParents: typeof recoveryCandidateParents;
  readonly recoveryCommitterTimestampSeconds:
    typeof recoveryCommitterTimestampSeconds;
  readonly uniqueRecoveryMergeBase: typeof uniqueRecoveryMergeBase;
  readonly writeRecoveryCandidate: typeof writeRecoveryCandidate;
  readonly deleteRecoveryCandidate: typeof deleteRecoveryCandidate;
  readonly compareAndSetPortableHead: typeof compareAndSetPortableHead;
  readonly networkEnvironment: () => Promise<
    Readonly<Record<string, string>> | null
  >;
}

const REAL_EFFECTS: SyncEffects = {
  ensurePortableData,
  readCurrentSnapshot: readCurrentPortableSnapshot,
  readSnapshotAtRef: (config, ref, datasetId) =>
    readSnapshotAtRef(config.repository_path, ref, datasetId),
  writeSnapshot: writePortableSnapshot,
  observeRemote: observePortableRemote,
  alignLocal: alignPortableDataRef,
  push: pushPortableDataRef,
  readRecoveryCandidateHead,
  recoveryCandidateParents,
  recoveryCommitterTimestampSeconds,
  uniqueRecoveryMergeBase,
  writeRecoveryCandidate,
  deleteRecoveryCandidate,
  compareAndSetPortableHead,
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
      return { kind: "remote-ambiguous" };
    case "unsafe":
      return {
        kind: "unsafe-remote",
        reason: observation.unsafe_reason,
      };
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

function initialSynchronizationDiagnostics(): SynchronizationDiagnostics {
  return {
    phase: "idle",
    reason: null,
    retryable: null,
    attempt_count: 0,
    last_attempt_at: null,
    next_retry_at: null,
    local_head: null,
    remote_head: null,
    last_adopted_head: null,
    lineage: null,
    remote_name: null,
    remote_location: null,
    recovery_attempted: false,
    recovery_outcome: null,
    error_summary: null,
  };
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
  let currentDiagnostics = initialSynchronizationDiagnostics();
  let currentConflictCase: JigDataConflictCase | null = null;
  let recoveryVerificationKind: "accepted" | "resumed" | null = null;
  let attemptStartedAt: string | null = null;
  let diagnosticFailureReason: SynchronizationFailureReason | null = null;
  let diagnosticFailureCount = 0;
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

  const beginPhase = (
    phase: SynchronizationDiagnosticPhase,
  ): void => {
    currentDiagnostics = {
      ...currentDiagnostics,
      phase,
      reason: null,
      retryable: null,
      attempt_count: diagnosticFailureCount,
      last_attempt_at: attemptStartedAt,
      next_retry_at: null,
      error_summary: null,
    };
  };

  const beginAttempt = (): void => {
    attemptStartedAt = new Date().toISOString();
    currentDiagnostics = {
      ...currentDiagnostics,
      recovery_attempted: recoveryVerificationKind !== null,
      recovery_outcome: null,
    };
    beginPhase("local-reconcile");
  };

  const completeDiagnostics = (): void => {
    diagnosticFailureReason = null;
    currentConflictCase = null;
    diagnosticFailureCount = 0;
    const recoveryOutcome = recoveryVerificationKind;
    currentDiagnostics = {
      ...currentDiagnostics,
      phase: "idle",
      reason: null,
      retryable: null,
      attempt_count: 0,
      last_attempt_at: attemptStartedAt,
      next_retry_at: null,
      recovery_attempted: recoveryOutcome !== null,
      recovery_outcome: recoveryOutcome,
      error_summary: null,
    };
    recoveryVerificationKind = null;
  };

  const recordFailure = (
    phase: SynchronizationDiagnosticPhase,
    reason: SynchronizationFailureReason,
    retryable: boolean,
    retryDelay: number | null,
    error?: unknown,
  ): void => {
    if (diagnosticFailureReason === reason) {
      diagnosticFailureCount += 1;
    } else {
      diagnosticFailureReason = reason;
      diagnosticFailureCount = 1;
    }
    const now = attemptStartedAt ?? new Date().toISOString();
    currentDiagnostics = {
      ...currentDiagnostics,
      phase,
      reason,
      retryable,
      attempt_count: diagnosticFailureCount,
      last_attempt_at: now,
      next_retry_at:
        retryDelay === null
          ? null
          : new Date(Date.parse(now) + retryDelay).toISOString(),
      recovery_attempted: recoveryVerificationKind !== null,
      recovery_outcome: null,
      error_summary:
        error === undefined
          ? synchronizationFailureSummary(reason)
          : sanitizeSynchronizationErrorSummary(error),
    };
  };

  const applyObservationDiagnostics = (
    observed: ObservedPortableRemote,
  ): void => {
    const observation = observed.observation;
    const remote =
      observation.state === "absent" ||
      observation.state === "unsafe" ||
      observation.state === "present"
        ? observation.remote
        : null;
    currentDiagnostics = {
      ...currentDiagnostics,
      local_head: synchronizationHeadPrefix(observation.local_head),
      remote_head:
        observation.state === "present"
          ? synchronizationHeadPrefix(observation.remote_head)
          : null,
      last_adopted_head:
        synchronizationHeadPrefix(observed.last_adopted_head),
      lineage:
        observation.state === "present"
          ? observation.lineage
          : null,
      remote_name: remote?.name ?? null,
      remote_location: remote?.location ?? null,
    };
  };

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

  const localIssue = async (
    phase: SynchronizationDiagnosticPhase = "local-reconcile",
    reason: SynchronizationFailureReason = "unknown",
    error?: unknown,
  ): Promise<RepositorySynchronizationStatus> => {
    localFailureCount += 1;
    const delay = retryDelayMs(localFailureCount);
    recordFailure(phase, reason, true, delay, error);
    const status = await setStatus("pending", "issue");
    schedule(delay);
    return status;
  };

  const remoteIssue = async (
    retryable: boolean,
    phase: SynchronizationDiagnosticPhase = "classify",
    reason: SynchronizationFailureReason = "unknown",
    error?: unknown,
  ): Promise<RepositorySynchronizationStatus> => {
    if (retryable) {
      remoteFailureCount += 1;
      const delay = retryDelayMs(remoteFailureCount);
      recordFailure(phase, reason, true, delay, error);
      const status = await setStatus(
        remoteFailureCount >= 7 ? "sync-issue" : "retrying",
      );
      schedule(delay);
      return status;
    }
    recordFailure(phase, reason, false, null, error);
    remoteFailureCount = 7;
    const status = await setStatus("sync-issue");
    schedule(SYNC_HEALTHY_POLL_MS);
    return status;
  };

  const recoveryIssue = async (
    phase: "recover-divergence" | "resolve-conflict",
    reason: SynchronizationFailureReason,
    retryable: boolean,
    outcome: "refused" | "failed",
    error?: unknown,
  ): Promise<RepositorySynchronizationStatus> => {
    const status = await remoteIssue(
      retryable,
      phase,
      reason,
      error,
    );
    currentDiagnostics = {
      ...currentDiagnostics,
      recovery_attempted: true,
      recovery_outcome: outcome,
    };
    return status;
  };

  const reconcileLocalSnapshot = (): Promise<void> =>
    reconcilePersistedPortableSnapshot(
      db,
      (datasetId) => effects.readCurrentSnapshot(adapter, datasetId),
    );

  const exportCurrent = (): Promise<string> =>
    exportCanonicalPortableSnapshot(
      db,
      (snapshot, revision) =>
        effects.writeSnapshot(adapter, snapshot, revision),
    );

  const observe = async (
    environment: Readonly<Record<string, string>>,
    phase:
      | "observe-remote"
      | "verify-remote"
      | "recover-divergence" = "observe-remote",
  ): Promise<ObservedPortableRemote> => {
    beginPhase(phase);
    const metadata = await readMetadata(db);
    const observed = {
      revision: metadata.revision,
      last_adopted_head: metadata.last_adopted_head,
      observation: await effects.observeRemote(
        adapter,
        metadata.dataset_id,
        metadata.last_adopted_head,
        environment,
      ),
    };
    applyObservationDiagnostics(observed);
    return observed;
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

  const resumeInterruptedRecovery = async (): Promise<
    RepositorySynchronizationStatus | null
  > => {
    const metadata = await readMetadata(db);
    const candidate = await effects.readRecoveryCandidateHead(
      adapter,
      metadata.dataset_id,
    );
    if (candidate === null) return null;

    if (metadata.last_adopted_head !== candidate) {
      await effects.deleteRecoveryCandidate(
        adapter,
        metadata.dataset_id,
        candidate,
      );
      return null;
    }

    beginPhase("recover-divergence");
    currentDiagnostics = {
      ...currentDiagnostics,
      recovery_attempted: true,
      recovery_outcome: null,
    };

    let candidateSnapshot: PortableSnapshot;
    let current;
    let parents: readonly [string, string];
    try {
      candidateSnapshot = await effects.readSnapshotAtRef(
        adapter,
        candidate,
        metadata.dataset_id,
      );
      current = await effects.readCurrentSnapshot(
        adapter,
        metadata.dataset_id,
      );
      parents = await effects.recoveryCandidateParents(
        adapter,
        candidate,
      );
    } catch (error) {
      return recoveryIssue(
        "recover-divergence",
        "unknown",
        false,
        "failed",
        error,
      );
    }

    if (current === null) {
      return recoveryIssue(
        "recover-divergence",
        "ref-race",
        false,
        "refused",
      );
    }
    const lineage =
      current.head === candidate
        ? "equal"
        : parents.includes(current.head)
          ? "remote-ahead"
          : null;
    if (lineage === null) {
      return recoveryIssue(
        "recover-divergence",
        "ref-race",
        false,
        "refused",
      );
    }

    try {
      if (current.head === candidate) {
        await effects.compareAndSetPortableHead(
          adapter,
          candidate,
          candidate,
        );
      }
      const result = await finishInterruptedSynchronizationAdoption(
        db,
        {
          local_head: current.head,
          remote_head: candidate,
          lineage,
          remote_snapshot: candidateSnapshot,
        },
        (expectedHead, targetHead) =>
          effects.compareAndSetPortableHead(
            adapter,
            expectedHead,
            targetHead,
          ),
      );
      if (result !== "finished") {
        return recoveryIssue(
          "recover-divergence",
          "ref-race",
          false,
          "refused",
        );
      }
      await effects.deleteRecoveryCandidate(
        adapter,
        metadata.dataset_id,
        candidate,
      );
      recoveryVerificationKind = "resumed";
      currentDiagnostics = {
        ...currentDiagnostics,
        recovery_attempted: true,
        recovery_outcome: null,
      };
      return null;
    } catch (error) {
      return recoveryIssue(
        "recover-divergence",
        "ref-race",
        false,
        "failed",
        error,
      );
    }
  };

  const attemptDivergenceRecovery = async (
    observed: ObservedPortableRemote,
    environment: Readonly<Record<string, string>>,
  ): Promise<RepositorySynchronizationStatus | null> => {
    currentConflictCase = null;
    const observation = observed.observation;
    if (
      observation.state !== "present" ||
      observation.lineage !== "diverged" ||
      observation.remote_rewritten ||
      observation.local_head === null
    ) {
      return recoveryIssue(
        "recover-divergence",
        "diverged",
        false,
        "refused",
      );
    }

    beginPhase("recover-divergence");
    currentDiagnostics = {
      ...currentDiagnostics,
      recovery_attempted: true,
      recovery_outcome: null,
    };
    const metadata = await readMetadata(db);
    const local = await effects.readCurrentSnapshot(
      adapter,
      metadata.dataset_id,
    );
    if (
      local === null ||
      local.head !== observation.local_head ||
      metadata.revision !== observed.revision
    ) {
      return recoveryIssue(
        "recover-divergence",
        "ref-race",
        true,
        "refused",
      );
    }

    let mergeBase: string | null;
    try {
      mergeBase = await effects.uniqueRecoveryMergeBase(
        adapter,
        observation.local_head,
        observation.remote_head,
      );
    } catch (error) {
      return recoveryIssue(
        "recover-divergence",
        "unknown",
        false,
        "failed",
        error,
      );
    }
    if (mergeBase === null) {
      return recoveryIssue(
        "recover-divergence",
        "ancestry-unknown",
        false,
        "refused",
      );
    }

    let ancestor: PortableSnapshot;
    try {
      ancestor = await effects.readSnapshotAtRef(
        adapter,
        mergeBase,
        metadata.dataset_id,
      );
    } catch (error) {
      const reason =
        error instanceof SnapshotDatasetMismatchError
          ? "dataset-mismatch"
          : error instanceof SnapshotValidationError
            ? "invalid-snapshot"
            : "unknown";
      return recoveryIssue(
        "recover-divergence",
        reason,
        false,
        reason === "unknown" ? "failed" : "refused",
        error,
      );
    }

    const reconciliation = reconcileRelatedPortableSnapshots(
      ancestor,
      local.snapshot,
      observation.remote_snapshot,
    );
    if (reconciliation.kind === "semantic-conflict") {
      currentConflictCase = buildJigDataConflictCase(
        mergeBase,
        observation.local_head,
        observation.remote_head,
        observed.revision,
        ancestor,
        local.snapshot,
        observation.remote_snapshot,
      );
      return recoveryIssue(
        currentConflictCase === null
          ? "recover-divergence"
          : "resolve-conflict",
        "semantic-conflict",
        false,
        "refused",
      );
    }

    let candidate: string;
    try {
      const [localTimestamp, remoteTimestamp] = await Promise.all([
        effects.recoveryCommitterTimestampSeconds(
          adapter,
          observation.local_head,
        ),
        effects.recoveryCommitterTimestampSeconds(
          adapter,
          observation.remote_head,
        ),
      ]);
      candidate = await effects.writeRecoveryCandidate(
        adapter,
        metadata.dataset_id,
        reconciliation.snapshot,
        recoveryCommitSpec(
          "automatic",
          observation.local_head,
          localTimestamp,
          observation.remote_head,
          remoteTimestamp,
        ),
      );
    } catch (error) {
      return recoveryIssue(
        "recover-divergence",
        "unknown",
        false,
        "failed",
        error,
      );
    }

    const currentMetadata = await readMetadata(db);
    const currentLocal = await effects.readCurrentSnapshot(
      adapter,
      metadata.dataset_id,
    );
    let confirmed: ObservedPortableRemote;
    try {
      confirmed = await observe(environment, "recover-divergence");
    } catch (error) {
      await effects.deleteRecoveryCandidate(
        adapter,
        metadata.dataset_id,
        candidate,
      );
      return recoveryIssue(
        "recover-divergence",
        "transport",
        true,
        "refused",
        error,
      );
    }
    if (
      currentMetadata.revision !== observed.revision ||
      currentLocal === null ||
      currentLocal.head !== observation.local_head ||
      confirmed.observation.state !== "present" ||
      confirmed.observation.local_head !== observation.local_head ||
      confirmed.observation.remote_head !== observation.remote_head ||
      confirmed.observation.remote_rewritten ||
      confirmed.observation.lineage !== "diverged"
    ) {
      await effects.deleteRecoveryCandidate(
        adapter,
        metadata.dataset_id,
        candidate,
      );
      return recoveryIssue(
        "recover-divergence",
        "ref-race",
        true,
        "refused",
      );
    }

    try {
      await adoptObservedSynchronizationRemote(
        db,
        {
          local_head: observation.local_head,
          remote_head: candidate,
          lineage: "remote-ahead",
          remote_snapshot: reconciliation.snapshot,
        },
        observed.revision,
        (expectedHead, targetHead) =>
          effects.compareAndSetPortableHead(
            adapter,
            expectedHead,
            targetHead,
          ),
      );
      await effects.deleteRecoveryCandidate(
        adapter,
        metadata.dataset_id,
        candidate,
      );
    } catch (error) {
      return recoveryIssue(
        "recover-divergence",
        "ref-race",
        false,
        "failed",
        error,
      );
    }

    recoveryVerificationKind = "accepted";
    currentDiagnostics = {
      ...currentDiagnostics,
      recovery_attempted: true,
      recovery_outcome: null,
    };
    return null;
  };

  const processObservation = async (
    observed: ObservedPortableRemote,
    environment: Readonly<Record<string, string>>,
    mayPush: boolean,
  ): Promise<RepositorySynchronizationStatus | null> => {
    const { observation } = observed;
    remoteIdentity = observationRemote(observation);
    beginPhase("classify");
    const localPending = await isPending();
    const decision = decideSynchronization(
      observationFacts(observation, localPending),
    );

    if (decision.kind === "attention") {
      if (
        decision.reason === "diverged" &&
        mayPush &&
        !localPending &&
        observation.state === "present" &&
        observation.lineage === "diverged"
      ) {
        const recovery = await attemptDivergenceRecovery(
          observed,
          environment,
        );
        if (recovery !== null) return recovery;
        const afterRecovery = await observe(
          environment,
          "verify-remote",
        );
        return processObservation(
          afterRecovery,
          environment,
          true,
        );
      }
      currentConflictCase = null;
      return remoteIssue(
        false,
        "classify",
        decision.reason,
      );
    }

    if (decision.kind === "local-only") {
      try {
        if (await isPending()) {
          beginPhase("export-local");
          await exportCurrent();
        }
      } catch (error) {
        return localIssue(
          "export-local",
          "local-export-failed",
          error,
        );
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
      completeDiagnostics();
      schedule(SYNC_HEALTHY_POLL_MS);
      return currentStatus;
    }

    if (decision.kind === "synchronized") {
      if (observation.state !== "present") return remoteIssue(false);
      await markAdoptedHead(db, observation.remote_head);
      currentDiagnostics = {
        ...currentDiagnostics,
        last_adopted_head:
          synchronizationHeadPrefix(observation.remote_head),
      };
      firstDirtyAt = null;
      remoteFailureCount = 0;
      const status = await setStatus("synchronized");
      completeDiagnostics();
      schedule(SYNC_HEALTHY_POLL_MS);
      return status;
    }

    if (decision.kind === "adopt-remote") {
      if (observation.state !== "present") return remoteIssue(false);
      beginPhase("adopt-remote");
      try {
        await adoptRemote(observation, observed.revision);
      } catch (error) {
        return remoteIssue(
          false,
          "adopt-remote",
          "ref-race",
          error,
        );
      }
      return null;
    }

    if (!mayPush) {
      if (await isPending()) {
        const status = await setStatus("pending");
        schedule(0);
        return status;
      }
      return remoteIssue(
        true,
        "verify-remote",
        "transport",
        "Remote verification still requires a local push",
      );
    }

    if (remoteIdentity === null) {
      return remoteIssue(false, "classify", "remote-ambiguous");
    }
    try {
      if (await isPending()) {
        beginPhase("export-local");
        await exportCurrent();
      }
    } catch (error) {
      return localIssue(
        "export-local",
        "local-export-failed",
        error,
      );
    }

    beginPhase("push");
    let pushed;
    let pushError: unknown;
    try {
      pushed = await effects.push(
        adapter,
        remoteIdentity,
        environment,
      );
    } catch (error) {
      pushError = error;
      pushed = { status: "sync-issue", retryable: true } as const;
    }

    let afterPush: ObservedPortableRemote;
    try {
      afterPush = await observe(environment, "verify-remote");
    } catch (error) {
      remoteIdentity ??= UNRESOLVED_REMOTE;
      return remoteIssue(
        true,
        "verify-remote",
        "transport",
        error,
      );
    }

    if (pushed.status === "sync-issue") {
      const afterDecision = decideSynchronization(
        observationFacts(
          afterPush.observation,
          await isPending(),
        ),
      );
      if (afterDecision.kind === "push-local") {
        return remoteIssue(
          pushed.retryable,
          "push",
          "transport",
          pushError ?? "Git push did not complete",
        );
      }
    }

    return processObservation(afterPush, environment, false);
  };

  const runOnce = async (): Promise<RepositorySynchronizationStatus> => {
    beginAttempt();
    try {
      const datasetId = (await readMetadata(db)).dataset_id;
      await effects.ensurePortableData(adapter, datasetId);
      await reconcileLocalSnapshot();
      localFailureCount = 0;
    } catch (error) {
      return localIssue("local-reconcile", "unknown", error);
    }

    const resumed = await resumeInterruptedRecovery();
    if (resumed !== null) return resumed;

    let environment: Readonly<Record<string, string>> | null;
    try {
      environment = await effects.networkEnvironment();
    } catch (error) {
      remoteIdentity ??= UNRESOLVED_REMOTE;
      return remoteIssue(
        true,
        "observe-remote",
        "transport",
        error,
      );
    }
    if (environment === null) {
      remoteIdentity ??= UNRESOLVED_REMOTE;
      return remoteIssue(
        false,
        "observe-remote",
        "authentication",
      );
    }

    let observed: ObservedPortableRemote;
    try {
      observed = await observe(environment);
    } catch (error) {
      remoteIdentity ??= UNRESOLVED_REMOTE;
      try {
        if (await isPending()) {
          beginPhase("export-local");
          await exportCurrent();
        }
        localFailureCount = 0;
      } catch (localError) {
        return localIssue(
          "export-local",
          "local-export-failed",
          localError,
        );
      }
      return remoteIssue(
        true,
        "observe-remote",
        "transport",
        error,
      );
    }
    remoteIdentity = observationRemote(observed.observation);

    if (observed.observation.state === "present") {
      const interrupted =
        await finishInterruptedAdoption(observed.observation);
      if (interrupted === "unsafe") {
        return remoteIssue(
          false,
          "adopt-remote",
          "ref-race",
          "Interrupted adoption evidence is inconsistent",
        );
      }
      if (interrupted === "finished") {
        try {
          observed = await observe(environment, "verify-remote");
        } catch (error) {
          return remoteIssue(
            true,
            "verify-remote",
            "transport",
            error,
          );
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
      const confirmed = await observe(environment, "verify-remote");
      return (
        await processObservation(
          confirmed,
          environment,
          false,
        )
      ) ?? remoteIssue(
        false,
        "verify-remote",
        "unknown",
        "Remote verification did not settle",
      );
    } catch (error) {
      return remoteIssue(
        true,
        "verify-remote",
        "transport",
        error,
      );
    }
  };

  const trigger = async (): Promise<RepositorySynchronizationStatus> => {
    if (currentConflictCase !== null) {
      clearTimer();
      return currentStatus;
    }
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
      } catch (error) {
        attemptStartedAt = new Date().toISOString();
        await localIssue("local-reconcile", "unknown", error);
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
            now + SYNCHRONIZATION_MUTATION_DEBOUNCE_MS,
            firstDirtyAt + EXPORT_MAX_FLUSH_MS,
          ) - now,
        ),
      );
    },
    trigger,
    status: () => currentStatus,
    diagnostics: () => currentDiagnostics,
    readSynchronizationConflict: () => currentConflictCase,
  };
}
