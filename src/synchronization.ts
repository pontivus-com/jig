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
export const SYNCHRONIZATION_REMOTE_DEADLINE_MS = 60_000;

export class SynchronizationDeadlineError extends Error {
  constructor() {
    super("Synchronization remote operation exceeded its deadline");
    this.name = "SynchronizationDeadlineError";
  }
}

export async function runSynchronizationRemoteOperation<T>(
  operation: () => Promise<T>,
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      operation(),
      new Promise<T>((_resolve, reject) => {
        timeout = setTimeout(
          () => reject(new SynchronizationDeadlineError()),
          SYNCHRONIZATION_REMOTE_DEADLINE_MS,
        );
      }),
    ]);
  } finally {
    if (timeout !== null) {
      clearTimeout(timeout);
    }
  }
}

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
  | "synchronized"
  | "export"
  | "adopt"
  | "attention";

export interface SynchronizationFacts {
  readonly remote_rewritten: boolean;
  readonly lineage: GitLineage;
  readonly local_pending: boolean;
  readonly canonical_matches_remote: boolean;
}

export function decideSynchronization(
  facts: SynchronizationFacts,
): SynchronizationDecision {
  if (facts.remote_rewritten) {
    return "attention";
  }
  if (
    facts.lineage === "unknown" ||
    facts.lineage === "diverged"
  ) {
    return "attention";
  }
  if (facts.lineage === "equal") {
    return facts.local_pending
      ? "export"
      : "synchronized";
  }
  if (facts.lineage === "remote-ahead") {
    return !facts.local_pending ||
      facts.canonical_matches_remote
      ? "adopt"
      : "attention";
  }
  return "export";
}
