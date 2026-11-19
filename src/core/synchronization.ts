export type SynchronizationLineage =
  | "equal"
  | "remote-ahead"
  | "local-ahead"
  | "diverged"
  | "unknown";

export type SynchronizationFacts =
  | {
      readonly kind: "no-remote";
      readonly local_pending: boolean;
    }
  | {
      readonly kind: "remote-absent";
      readonly local_pending: boolean;
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
    };

export type SynchronizationDecision =
  | { readonly kind: "local-only" }
  | { readonly kind: "synchronized" }
  | { readonly kind: "adopt-remote" }
  | { readonly kind: "push-local" }
  | { readonly kind: "attention" };

export function decideSynchronization(
  facts: SynchronizationFacts,
): SynchronizationDecision {
  if (facts.kind === "no-remote") {
    return { kind: "local-only" };
  }

  if (facts.kind === "unsafe-remote") {
    return { kind: "attention" };
  }

  if (facts.kind === "remote-absent") {
    return facts.previously_synchronized
      ? { kind: "attention" }
      : { kind: "push-local" };
  }

  if (facts.remote_rewritten) {
    return { kind: "attention" };
  }

  switch (facts.lineage) {
    case "equal":
      return facts.local_pending
        ? { kind: "push-local" }
        : { kind: "synchronized" };
    case "remote-ahead":
      return facts.local_pending
        ? { kind: "attention" }
        : { kind: "adopt-remote" };
    case "local-ahead":
      return { kind: "push-local" };
    case "diverged":
    case "unknown":
      return { kind: "attention" };
  }
}
