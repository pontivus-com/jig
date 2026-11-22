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
import {
  sanitizeSynchronizationErrorSummary,
  synchronizationHeadPrefix,
  type RepositorySynchronizationStatus,
  type SynchronizationDiagnosticPhase,
  type SynchronizationDiagnostics,
} from "../../../src/protocol/runtime";
import {
  decideSynchronization,
  synchronizationFailureSummary,
  SYNCHRONIZATION_MUTATION_DEBOUNCE_MS,
  type SynchronizationFailureReason,
  type SynchronizationFacts,
} from "../../../src/core/synchronization";
import {
  applyJigDataResolution,
  buildJigDataConflictCase,
  reconcileRelatedPortableSnapshots,
  recoveryCommitSpec,
} from "../../../src/core/synchronization-recovery";
import type * as recovery from "../../../src/core/synchronization-recovery";
import {
  SnapshotDatasetMismatchError,
  SnapshotValidationError,
  type PortableSnapshot,
} from "../../../src/core/portable";
import {
  alignAndroidPortableHead,
  androidPortableHead,
  androidRecoveryCandidateParents,
  androidRecoveryCommitterTimestampSeconds,
  androidSynchronizationRemote,
  commitAndroidPortableSnapshot,
  compareAndSetAndroidPortableHead,
  deleteAndroidRecoveryCandidate,
  observeAndroidPortableRemote,
  pushAndroidPortableRepository,
  readAndroidRecoveryCandidateHead,
  readAndroidSnapshotAtOid,
  reopenAndroidPortableRepository,
  uniqueAndroidRecoveryMergeBase,
  writeAndroidRecoveryCandidate,
  type AndroidGitEffects,
  type AndroidPortableRemoteObservation,
  type GitCredentialProvider,
} from "./git";

interface ObservedAndroidRemote {
  readonly revision: number;
  readonly last_adopted_head: string | null;
  readonly observation: AndroidPortableRemoteObservation;
}

export interface AndroidSyncController {
  readonly start: () => Promise<void>;
  readonly stop: () => void;
  readonly status: () => RepositorySynchronizationStatus;
  readonly diagnostics: () => SynchronizationDiagnostics;
  readonly readSynchronizationConflict: () => recovery.JigDataConflictCase | null;
  readonly resolveSynchronizationConflict: (
    resolution: recovery.JigDataResolution,
  ) => Promise<RepositorySynchronizationStatus>;
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
      return {
        kind: "unsafe-remote",
        reason: observation.unsafe_reason,
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

function androidAdapterFailureReason(
  error: unknown,
): SynchronizationFailureReason {
  const summary = sanitizeSynchronizationErrorSummary(error);
  return /auth|credential|token/i.test(summary)
    ? "authentication"
    : "transport";
}

function initialAndroidSynchronizationDiagnostics(): SynchronizationDiagnostics {
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

export function createAndroidSyncController(
  database: JigSqlConnection,
  effects: AndroidGitEffects,
  credential: GitCredentialProvider,
): AndroidSyncController {
  let currentDiagnostics = initialAndroidSynchronizationDiagnostics();
  let currentConflictCase: recovery.JigDataConflictCase | null = null;
  let attemptStartedAt: string | null = null;
  let diagnosticFailureReason: SynchronizationFailureReason | null = null;
  let diagnosticFailureCount = 0;
  let recoveryVerificationKind: "accepted" | "resumed" | null = null;
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
    error?: unknown,
  ): void => {
    if (diagnosticFailureReason === reason) {
      diagnosticFailureCount += 1;
    } else {
      diagnosticFailureReason = reason;
      diagnosticFailureCount = 1;
    }
    currentDiagnostics = {
      ...currentDiagnostics,
      phase,
      reason,
      retryable,
      attempt_count: diagnosticFailureCount,
      last_attempt_at:
        attemptStartedAt ?? new Date().toISOString(),
      next_retry_at: null,
      recovery_attempted:
        recoveryVerificationKind !== null ||
        currentDiagnostics.recovery_attempted,
      recovery_outcome: null,
      error_summary:
        error === undefined
          ? synchronizationFailureSummary(reason)
          : sanitizeSynchronizationErrorSummary(error),
    };
  };

  const applyObservationDiagnostics = (
    observed: ObservedAndroidRemote,
  ): void => {
    const observation = observed.observation;
    const remote =
      observation.state === "unsafe"
        ? observation.remote ?? null
        : observation.remote;
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
      currentDiagnostics = {
        ...currentDiagnostics,
        remote_name: remote.name,
        remote_location: remote.location,
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

  const observe = async (
    phase:
      | "observe-remote"
      | "verify-remote"
      | "recover-divergence"
      | "resolve-conflict" = "observe-remote",
  ): Promise<ObservedAndroidRemote> => {
    beginPhase(phase);
    const metadata = await readMetadata(database);
    const observed = {
      revision: metadata.revision,
      last_adopted_head: metadata.last_adopted_head,
      observation: await observeAndroidPortableRemote(
        effects,
        metadata.dataset_id,
        metadata.last_adopted_head,
        credential,
      ),
    };
    applyObservationDiagnostics(observed);
    return observed;
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


  const recoveryIssue = async (
    phase: "recover-divergence" | "resolve-conflict",
    reason: SynchronizationFailureReason,
    retryable: boolean,
    outcome: "refused" | "failed",
    error?: unknown,
  ): Promise<RepositorySynchronizationStatus> => {
    recordFailure(phase, reason, retryable, error);
    currentDiagnostics = {
      ...currentDiagnostics,
      recovery_attempted: true,
      recovery_outcome: outcome,
    };
    return setRemoteState("sync-issue");
  };

  const readCurrentPortableSnapshot = async (
    datasetId: string,
  ): Promise<Readonly<{
    head: string;
    snapshot: PortableSnapshot;
  }>> => ({
    head: await androidPortableHead(effects),
    snapshot: await reopenAndroidPortableRepository(
      effects,
      datasetId,
    ),
  });

  const resumeInterruptedRecovery = async (): Promise<
    RepositorySynchronizationStatus | null
  > => {
    const metadata = await readMetadata(database);
    const candidate = await readAndroidRecoveryCandidateHead(
      effects,
      metadata.dataset_id,
    );
    if (candidate === null) return null;

    if (metadata.last_adopted_head !== candidate) {
      await deleteAndroidRecoveryCandidate(
        effects,
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
    let currentSnapshot: Awaited<
      ReturnType<typeof readCurrentPortableSnapshot>
    >;
    let parents: readonly [string, string];
    try {
      candidateSnapshot = await readAndroidSnapshotAtOid(
        effects,
        candidate,
        metadata.dataset_id,
      );
      currentSnapshot = await readCurrentPortableSnapshot(
        metadata.dataset_id,
      );
      parents = await androidRecoveryCandidateParents(
        effects,
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

    const lineage =
      currentSnapshot.head === candidate
        ? "equal"
        : parents.includes(currentSnapshot.head)
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
      if (currentSnapshot.head === candidate) {
        await compareAndSetAndroidPortableHead(
          effects,
          candidate,
          candidate,
        );
      }
      const result = await finishInterruptedSynchronizationAdoption(
        database,
        {
          local_head: currentSnapshot.head,
          remote_head: candidate,
          lineage,
          remote_snapshot: candidateSnapshot,
        },
        (expectedHead, targetHead) =>
          compareAndSetAndroidPortableHead(
            effects,
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
      await deleteAndroidRecoveryCandidate(
        effects,
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
    observed: ObservedAndroidRemote,
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

    const metadata = await readMetadata(database);
    let local: Awaited<
      ReturnType<typeof readCurrentPortableSnapshot>
    >;
    try {
      local = await readCurrentPortableSnapshot(metadata.dataset_id);
    } catch (error) {
      return recoveryIssue(
        "recover-divergence",
        "unknown",
        false,
        "failed",
        error,
      );
    }
    if (
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
      mergeBase = await uniqueAndroidRecoveryMergeBase(
        effects,
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
      ancestor = await readAndroidSnapshotAtOid(
        effects,
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
        androidRecoveryCommitterTimestampSeconds(
          effects,
          observation.local_head,
        ),
        androidRecoveryCommitterTimestampSeconds(
          effects,
          observation.remote_head,
        ),
      ]);
      candidate = await writeAndroidRecoveryCandidate(
        effects,
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

    const currentMetadata = await readMetadata(database);
    let currentLocalHead: string;
    try {
      currentLocalHead = await androidPortableHead(effects);
    } catch (error) {
      await deleteAndroidRecoveryCandidate(
        effects,
        metadata.dataset_id,
        candidate,
      );
      return recoveryIssue(
        "recover-divergence",
        "ref-race",
        true,
        "refused",
        error,
      );
    }

    let confirmed: ObservedAndroidRemote;
    try {
      confirmed = await observe("recover-divergence");
    } catch (error) {
      await deleteAndroidRecoveryCandidate(
        effects,
        metadata.dataset_id,
        candidate,
      );
      return recoveryIssue(
        "recover-divergence",
        androidAdapterFailureReason(error),
        true,
        "refused",
        error,
      );
    }

    if (
      currentMetadata.revision !== observed.revision ||
      currentLocalHead !== observation.local_head ||
      confirmed.observation.state !== "present" ||
      confirmed.observation.local_head !== observation.local_head ||
      confirmed.observation.remote_head !== observation.remote_head ||
      confirmed.observation.remote_rewritten ||
      confirmed.observation.lineage !== "diverged"
    ) {
      await deleteAndroidRecoveryCandidate(
        effects,
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
        database,
        {
          local_head: observation.local_head,
          remote_head: candidate,
          lineage: "remote-ahead",
          remote_snapshot: reconciliation.snapshot,
        },
        observed.revision,
        (expectedHead, targetHead) =>
          compareAndSetAndroidPortableHead(
            effects,
            expectedHead,
            targetHead,
          ),
      );
      await deleteAndroidRecoveryCandidate(
        effects,
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
    observed: ObservedAndroidRemote,
    mayPush: boolean,
  ): Promise<RepositorySynchronizationStatus | null> => {
    const { observation } = observed;
    beginPhase("classify");
    const localPending = await isPending();
    const decision = decideSynchronization(
      observationFacts(observation, localPending),
    );

    if (decision.kind === "attention") {
      if (
        decision.reason === "diverged" &&
        mayPush &&
        localPending &&
        observation.state === "present" &&
        observation.lineage === "remote-ahead"
      ) {
        try {
          beginPhase("export-local");
          await exportCurrent();
          return processObservation(
            await observe("verify-remote"),
            true,
          );
        } catch (error) {
          recordFailure(
            "export-local",
            "local-export-failed",
            true,
            error,
          );
          return setRemoteState("pending", "issue");
        }
      }
      if (
        decision.reason === "diverged" &&
        mayPush &&
        !localPending &&
        observation.state === "present" &&
        observation.lineage === "diverged"
      ) {
        const recovery = await attemptDivergenceRecovery(observed);
        if (recovery !== null) return recovery;
        return processObservation(
          await observe("verify-remote"),
          true,
        );
      }
      currentConflictCase = null;
      recordFailure(
        "classify",
        decision.reason,
        false,
      );
      return setRemoteState("sync-issue");
    }
    if (decision.kind === "synchronized") {
      if (observation.state !== "present") {
        return setRemoteState("sync-issue");
      }
      await markAdoptedHead(database, observation.remote_head);
      currentDiagnostics = {
        ...currentDiagnostics,
        last_adopted_head:
          synchronizationHeadPrefix(observation.remote_head),
      };
      const status = await setRemoteState("synchronized");
      completeDiagnostics();
      return status;
    }
    if (decision.kind === "adopt-remote") {
      if (observation.state !== "present") {
        return setRemoteState("sync-issue");
      }
      beginPhase("adopt-remote");
      try {
        await adoptRemote(observation, observed.revision);
      } catch (error) {
        recordFailure("adopt-remote", "ref-race", false, error);
        return setRemoteState("sync-issue");
      }
      return null;
    }
    if (decision.kind === "local-only") {
      recordFailure("classify", "remote-ambiguous", false);
      return setRemoteState("sync-issue");
    }
    if (!mayPush) {
      recordFailure(
        "verify-remote",
        "transport",
        true,
        "Remote verification still requires a local push",
      );
      return setRemoteState("sync-issue");
    }

    try {
      if (await isPending()) {
        beginPhase("export-local");
        await exportCurrent();
      }
    } catch (error) {
      recordFailure(
        "export-local",
        "local-export-failed",
        true,
        error,
      );
      return setRemoteState("pending", "issue");
    }

    beginPhase("push");
    try {
      await pushAndroidPortableRepository(effects, credential);
    } catch (error) {
      let afterFailure: ObservedAndroidRemote;
      try {
        afterFailure = await observe("verify-remote");
      } catch (observeError) {
        recordFailure(
          "verify-remote",
          androidAdapterFailureReason(observeError),
          true,
          observeError,
        );
        return setRemoteState("sync-issue");
      }
      const afterDecision = decideSynchronization(
        observationFacts(
          afterFailure.observation,
          await isPending(),
        ),
      );
      if (afterDecision.kind === "push-local") {
        recordFailure(
          "push",
          androidAdapterFailureReason(error),
          true,
          error,
        );
        return setRemoteState("sync-issue");
      }
      return processObservation(afterFailure, false);
    }

    try {
      return processObservation(
        await observe("verify-remote"),
        false,
      );
    } catch (error) {
      recordFailure(
        "verify-remote",
        androidAdapterFailureReason(error),
        true,
        error,
      );
      return setRemoteState("sync-issue");
    }
  };

  const runOnce = async (): Promise<RepositorySynchronizationStatus> => {
    beginAttempt();
    try {
      await reconcileLocalSnapshot();
    } catch (error) {
      recordFailure("local-reconcile", "unknown", true, error);
      return setRemoteState("pending", "issue");
    }

    const resumed = await resumeInterruptedRecovery();
    if (resumed !== null) return resumed;

    let observed: ObservedAndroidRemote;
    try {
      observed = await observe();
    } catch (error) {
      recordFailure(
        "observe-remote",
        androidAdapterFailureReason(error),
        true,
        error,
      );
      return setRemoteState("sync-issue");
    }

    if (observed.observation.state === "present") {
      const interrupted =
        await finishInterruptedAdoption(observed.observation);
      if (interrupted === "unsafe") {
        recordFailure(
          "adopt-remote",
          "ref-race",
          false,
          "Interrupted adoption evidence is inconsistent",
        );
        return setRemoteState("sync-issue");
      }
      if (interrupted === "finished") {
        try {
          observed = await observe("verify-remote");
        } catch (error) {
          recordFailure(
            "verify-remote",
            androidAdapterFailureReason(error),
            true,
            error,
          );
          return setRemoteState("sync-issue");
        }
      }
    }

    const result = await processObservation(observed, true);
    if (result !== null) return result;

    try {
      return (
        await processObservation(
          await observe("verify-remote"),
          false,
        )
      ) ?? (() => {
        recordFailure(
          "verify-remote",
          "unknown",
          false,
          "Remote verification did not settle",
        );
        return setRemoteState("sync-issue");
      })();
    } catch (error) {
      recordFailure(
        "verify-remote",
        androidAdapterFailureReason(error),
        true,
        error,
      );
      return setRemoteState("sync-issue");
    }
  };

  const refreshAfterStaleConflict = async (): Promise<
    RepositorySynchronizationStatus
  > => {
    currentConflictCase = null;
    return runOnce();
  };

  const resolveCurrentConflict = async (
    resolution: recovery.JigDataResolution,
  ): Promise<RepositorySynchronizationStatus> => {
    const conflictCase = currentConflictCase;
    if (conflictCase === null) {
      throw new Error("No current synchronization conflict is available");
    }

    beginPhase("resolve-conflict");
    currentDiagnostics = {
      ...currentDiagnostics,
      reason: "semantic-conflict",
      retryable: false,
      recovery_attempted: true,
      recovery_outcome: null,
      error_summary: synchronizationFailureSummary("semantic-conflict"),
    };

    const metadata = await readMetadata(database);
    let local: Awaited<
      ReturnType<typeof readCurrentPortableSnapshot>
    >;
    let observed: ObservedAndroidRemote;
    try {
      local = await readCurrentPortableSnapshot(metadata.dataset_id);
      observed = await observe("resolve-conflict");
    } catch {
      return refreshAfterStaleConflict();
    }

    if (
      metadata.revision !== conflictCase.expected_revision ||
      local.head !== conflictCase.local_head ||
      observed.observation.state !== "present" ||
      observed.observation.local_head !== conflictCase.local_head ||
      observed.observation.remote_head !== conflictCase.remote_head ||
      observed.observation.remote_rewritten ||
      observed.observation.lineage !== "diverged"
    ) {
      return refreshAfterStaleConflict();
    }

    let mergeBase: string | null;
    let ancestor: PortableSnapshot;
    try {
      mergeBase = await uniqueAndroidRecoveryMergeBase(
        effects,
        conflictCase.local_head,
        conflictCase.remote_head,
      );
      if (
        mergeBase === null ||
        mergeBase !== conflictCase.ancestor_head
      ) {
        return refreshAfterStaleConflict();
      }
      ancestor = await readAndroidSnapshotAtOid(
        effects,
        mergeBase,
        metadata.dataset_id,
      );
    } catch {
      return refreshAfterStaleConflict();
    }

    const freshCase = buildJigDataConflictCase(
      mergeBase,
      conflictCase.local_head,
      conflictCase.remote_head,
      metadata.revision,
      ancestor,
      local.snapshot,
      observed.observation.remote_snapshot,
    );
    if (freshCase === null) {
      return refreshAfterStaleConflict();
    }
    currentConflictCase = freshCase;

    const applied = applyJigDataResolution(freshCase, resolution);
    if (applied.kind !== "resolved") {
      return recoveryIssue(
        "resolve-conflict",
        "semantic-conflict",
        false,
        "refused",
      );
    }

    let candidate: string;
    try {
      const [localTimestamp, remoteTimestamp] = await Promise.all([
        androidRecoveryCommitterTimestampSeconds(
          effects,
          freshCase.local_head,
        ),
        androidRecoveryCommitterTimestampSeconds(
          effects,
          freshCase.remote_head,
        ),
      ]);
      candidate = await writeAndroidRecoveryCandidate(
        effects,
        metadata.dataset_id,
        applied.snapshot,
        recoveryCommitSpec(
          "user-resolved",
          freshCase.local_head,
          localTimestamp,
          freshCase.remote_head,
          remoteTimestamp,
        ),
      );
    } catch (error) {
      return recoveryIssue(
        "resolve-conflict",
        "unknown",
        false,
        "failed",
        error,
      );
    }

    const currentMetadata = await readMetadata(database);
    let currentLocalHead: string;
    let confirmed: ObservedAndroidRemote;
    let confirmedMergeBase: string | null;
    try {
      currentLocalHead = await androidPortableHead(effects);
      confirmed = await observe("resolve-conflict");
      confirmedMergeBase =
        confirmed.observation.state === "present" &&
        confirmed.observation.local_head !== null
          ? await uniqueAndroidRecoveryMergeBase(
              effects,
              confirmed.observation.local_head,
              confirmed.observation.remote_head,
            )
          : null;
    } catch {
      await deleteAndroidRecoveryCandidate(
        effects,
        metadata.dataset_id,
        candidate,
      );
      return refreshAfterStaleConflict();
    }

    if (
      currentMetadata.revision !== freshCase.expected_revision ||
      currentLocalHead !== freshCase.local_head ||
      confirmed.observation.state !== "present" ||
      confirmed.observation.local_head !== freshCase.local_head ||
      confirmed.observation.remote_head !== freshCase.remote_head ||
      confirmed.observation.remote_rewritten ||
      confirmed.observation.lineage !== "diverged" ||
      confirmedMergeBase !== freshCase.ancestor_head
    ) {
      await deleteAndroidRecoveryCandidate(
        effects,
        metadata.dataset_id,
        candidate,
      );
      return refreshAfterStaleConflict();
    }

    try {
      await adoptObservedSynchronizationRemote(
        database,
        {
          local_head: freshCase.local_head,
          remote_head: candidate,
          lineage: "remote-ahead",
          remote_snapshot: applied.snapshot,
        },
        freshCase.expected_revision,
        (expectedHead, targetHead) =>
          compareAndSetAndroidPortableHead(
            effects,
            expectedHead,
            targetHead,
          ),
      );
      await deleteAndroidRecoveryCandidate(
        effects,
        metadata.dataset_id,
        candidate,
      );
    } catch {
      currentConflictCase = null;
      return runOnce();
    }

    currentConflictCase = null;
    recoveryVerificationKind = "accepted";
    currentDiagnostics = {
      ...currentDiagnostics,
      recovery_attempted: true,
      recovery_outcome: null,
    };

    const afterResolution = await observe("verify-remote");
    return (
      await processObservation(afterResolution, true)
    ) ?? (() => {
      recordFailure(
        "verify-remote",
        "unknown",
        false,
        "Resolved synchronization conflict did not settle",
      );
      return setRemoteState("sync-issue");
    })();
  };

  const resolveSynchronizationConflict = async (
    resolution: recovery.JigDataResolution,
  ): Promise<RepositorySynchronizationStatus> => {
    if (running !== null) {
      await running;
    }
    clearTimer();
    const operation = resolveCurrentConflict(resolution).finally(() => {
      running = null;
    });
    running = operation;
    return operation;
  };

  const trigger = async (): Promise<RepositorySynchronizationStatus> => {
    if (currentConflictCase !== null) {
      clearTimer();
      return current;
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
        await reconcileLocalSnapshot();
      } catch (error) {
        attemptStartedAt = new Date().toISOString();
        recordFailure("local-reconcile", "unknown", true, error);
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
    diagnostics: () => currentDiagnostics,
    readSynchronizationConflict: () => currentConflictCase,
    resolveSynchronizationConflict,
    notifyMutation: () => {
      void setRemoteState("pending");
      if (stopped) return;
      clearTimer();
      timer = setTimeout(() => {
        void trigger();
      }, SYNCHRONIZATION_MUTATION_DEBOUNCE_MS);
    },
    trigger,
  };
}
