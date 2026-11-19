export const SYNCHRONIZATION_RETRY_SECONDS = [
  5,
  10,
  20,
  40,
  80,
  160,
  300,
] as const;

export const SYNCHRONIZATION_HEALTHY_POLL_MS = 60_000;

export function synchronizationRetryDelayMs(
  failureCount: number,
): number {
  if (!Number.isInteger(failureCount) || failureCount < 1) {
    throw new Error("failureCount must be a positive integer");
  }
  const index = Math.min(
    failureCount - 1,
    SYNCHRONIZATION_RETRY_SECONDS.length - 1,
  );
  return (
    SYNCHRONIZATION_RETRY_SECONDS[index] ??
    SYNCHRONIZATION_RETRY_SECONDS[
      SYNCHRONIZATION_RETRY_SECONDS.length - 1
    ] ??
    300
  ) * 1000;
}

export type GitLineage =
  | "equal"
  | "remote-ahead"
  | "local-ahead"
  | "diverged"
  | "unknown";

export type SynchronizationDecision =
  | "local-only"
  | "initialize-remote"
  | "synchronized"
  | "export-and-push"
  | "adopt-remote"
  | "reconcile"
  | "normalize-to-remote"
  | "needs-attention";

export interface SynchronizationFacts {
  readonly remote:
    | "absent"
    | "present"
    | "ambiguous";
  readonly previously_observed_remote: boolean;
  readonly remote_rewritten: boolean;
  readonly lineage: GitLineage;
  readonly local_pending: boolean;
  readonly canonical_matches_remote: boolean;
  readonly base_available: boolean;
}

export function decideSynchronization(
  facts: SynchronizationFacts,
): SynchronizationDecision {
  if (facts.remote === "ambiguous") {
    return "needs-attention";
  }
  if (facts.remote === "absent") {
    return facts.previously_observed_remote
      ? "needs-attention"
      : "local-only";
  }
  if (facts.remote_rewritten) {
    return facts.canonical_matches_remote
      ? "normalize-to-remote"
      : "needs-attention";
  }
  if (facts.lineage === "unknown") {
    return "needs-attention";
  }
  if (
    facts.lineage === "diverged" &&
    facts.canonical_matches_remote
  ) {
    return "normalize-to-remote";
  }
  if (facts.lineage === "equal") {
    return facts.local_pending
      ? "export-and-push"
      : "synchronized";
  }
  if (facts.lineage === "remote-ahead") {
    if (facts.canonical_matches_remote) {
      return "normalize-to-remote";
    }
    if (!facts.local_pending) {
      return "adopt-remote";
    }
    return facts.base_available
      ? "reconcile"
      : "needs-attention";
  }
  if (facts.lineage === "local-ahead") {
    return "export-and-push";
  }
  return facts.base_available
    ? "reconcile"
    : "needs-attention";
}
