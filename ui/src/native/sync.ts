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
  alignAndroidPortableHead,
  androidPortableHead,
  androidSynchronizationRemote,
  commitAndroidPortableSnapshot,
  observeAndroidPortableRemote,
  pushAndroidPortableRepository,
  reopenAndroidPortableRepository,
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
  let attemptStartedAt: string | null = null;
  let diagnosticFailureReason: SynchronizationFailureReason | null = null;
  let diagnosticFailureCount = 0;
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
    beginPhase("local-reconcile");
  };

  const completeDiagnostics = (): void => {
    diagnosticFailureReason = null;
    diagnosticFailureCount = 0;
    currentDiagnostics = {
      ...currentDiagnostics,
      phase: "idle",
      reason: null,
      retryable: null,
      attempt_count: 0,
      last_attempt_at: attemptStartedAt,
      next_retry_at: null,
      recovery_attempted: false,
      recovery_outcome: null,
      error_summary: null,
    };
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
      recovery_attempted: false,
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
    phase: "observe-remote" | "verify-remote" = "observe-remote",
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
