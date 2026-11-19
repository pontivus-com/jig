export const SYNCHRONIZATION_RETRY_SECONDS = [
  5, 10, 20, 40, 80, 160, 300,
] as const;
export const SYNCHRONIZATION_HEALTHY_POLL_MS = 60_000;

export function synchronizationRetryDelayMs(
  failureCount: number,
): number {
  if (!Number.isInteger(failureCount) || failureCount < 1) {
    throw new Error("failureCount must be a positive integer");
  }
  return (
    SYNCHRONIZATION_RETRY_SECONDS[
      Math.min(
        failureCount - 1,
        SYNCHRONIZATION_RETRY_SECONDS.length - 1,
      )
    ] ?? 300
  ) * 1000;
}

export type GitLineage =
  | "equal"
  | "remote-ahead"
  | "local-ahead"
  | "diverged"
  | "unknown";

export type SynchronizationDecision =
  | "synchronized"
  | "export"
  | "adopt"
  | "reconcile"
  | "normalize"
  | "attention";

export interface SynchronizationFacts {
  readonly remote_rewritten: boolean;
  readonly lineage: GitLineage;
  readonly local_pending: boolean;
  readonly canonical_matches_remote: boolean;
  readonly base_available: boolean;
}

export function decideSynchronization(
  facts: SynchronizationFacts,
): SynchronizationDecision {
  if (facts.remote_rewritten) {
    return facts.canonical_matches_remote
      ? "normalize"
      : "attention";
  }
  if (facts.lineage === "unknown") {
    return "attention";
  }
  if (facts.canonical_matches_remote) {
    return facts.lineage === "equal"
      ? facts.local_pending
        ? "export"
        : "synchronized"
      : "normalize";
  }
  if (facts.lineage === "equal") {
    return facts.local_pending ? "export" : "synchronized";
  }
  if (facts.lineage === "local-ahead") {
    return "export";
  }
  if (facts.lineage === "remote-ahead" && !facts.local_pending) {
    return "adopt";
  }
  return facts.base_available ? "reconcile" : "attention";
}
