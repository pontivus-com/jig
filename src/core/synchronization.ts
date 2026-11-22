export const SYNCHRONIZATION_MUTATION_DEBOUNCE_MS = 3_000;

export type SynchronizationLineage =
  | "equal"
  | "remote-ahead"
  | "local-ahead"
  | "diverged"
  | "unknown";

export type SynchronizationFailureReason =
  | "local-export-failed"
  | "transport"
  | "authentication"
  | "remote-ambiguous"
  | "remote-absent-after-sync"
  | "remote-rewritten"
  | "diverged"
  | "ancestry-unknown"
  | "invalid-snapshot"
  | "dataset-mismatch"
  | "semantic-conflict"
  | "ref-race"
  | "unknown";

export type SynchronizationUnsafeReason = Extract<
  SynchronizationFailureReason,
  "invalid-snapshot" | "dataset-mismatch" | "remote-ambiguous" | "unknown"
>;

export type SynchronizationFacts =
  | {
      readonly kind: "no-remote";
    }
  | {
      readonly kind: "remote-ambiguous";
    }
  | {
      readonly kind: "remote-absent";
      readonly previously_synchronized: boolean;
    }
  | {
      readonly kind: "remote-present";
      readonly local_pending: boolean;
      readonly remote_rewritten: boolean;
      readonly lineage: SynchronizationLineage;
    }
  | {
      readonly kind: "unsafe-remote";
      readonly reason: SynchronizationUnsafeReason;
    };

export type SynchronizationDecision =
  | { readonly kind: "local-only" }
  | { readonly kind: "synchronized" }
  | { readonly kind: "adopt-remote" }
  | { readonly kind: "push-local" }
  | {
      readonly kind: "attention";
      readonly reason: SynchronizationFailureReason;
    };

export function decideSynchronization(
  facts: SynchronizationFacts,
): SynchronizationDecision {
  if (facts.kind === "no-remote") {
    return { kind: "local-only" };
  }

  if (facts.kind === "remote-ambiguous") {
    return { kind: "attention", reason: "remote-ambiguous" };
  }

  if (facts.kind === "unsafe-remote") {
    return { kind: "attention", reason: facts.reason };
  }

  if (facts.kind === "remote-absent") {
    return facts.previously_synchronized
      ? { kind: "attention", reason: "remote-absent-after-sync" }
      : { kind: "push-local" };
  }

  if (facts.remote_rewritten) {
    return { kind: "attention", reason: "remote-rewritten" };
  }

  switch (facts.lineage) {
    case "equal":
      return facts.local_pending
        ? { kind: "push-local" }
        : { kind: "synchronized" };
    case "remote-ahead":
      return facts.local_pending
        ? { kind: "attention", reason: "diverged" }
        : { kind: "adopt-remote" };
    case "local-ahead":
      return { kind: "push-local" };
    case "diverged":
      return { kind: "attention", reason: "diverged" };
    case "unknown":
      return { kind: "attention", reason: "ancestry-unknown" };
  }
}

export function synchronizationFailureSummary(
  reason: SynchronizationFailureReason,
): string {
  switch (reason) {
    case "local-export-failed":
      return "Local portable export failed";
    case "transport":
      return "Git transport operation failed";
    case "authentication":
      return "Git authentication is unavailable";
    case "remote-ambiguous":
      return "Synchronization remote is ambiguous";
    case "remote-absent-after-sync":
      return "Previously synchronized jig-data remote is absent";
    case "remote-rewritten":
      return "Remote jig-data history was rewritten";
    case "diverged":
      return "Local and remote jig-data histories diverged";
    case "ancestry-unknown":
      return "Jig-data ancestry could not be proved";
    case "invalid-snapshot":
      return "Remote jig-data snapshot is invalid";
    case "dataset-mismatch":
      return "Remote jig-data belongs to a different dataset";
    case "semantic-conflict":
      return "Portable data has a semantic conflict";
    case "ref-race":
      return "A Jig-owned Git ref changed concurrently";
    case "unknown":
      return "Synchronization operation failed";
  }
}
