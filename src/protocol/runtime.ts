import type { RecurrenceSeries } from "../core/recurrence";
import type { Task } from "../core/task";
import type {
  SynchronizationFailureReason,
  SynchronizationLineage,
} from "../core/synchronization";
export type { SynchronizationFailureReason } from "../core/synchronization";

/**
 * Architecture-neutral API/envelope contracts shared by the imperative shell
 * and browser adapter. These wrap canonical core values; they are not DTOs and
 * do not define a second Task or command schema.
 */
export type SynchronizationDiagnosticPhase =
  | "idle"
  | "local-reconcile"
  | "observe-remote"
  | "classify"
  | "adopt-remote"
  | "export-local"
  | "push"
  | "verify-remote"
  | "recover-divergence"
  | "resolve-conflict";

export type SynchronizationRecoveryOutcome =
  | "accepted"
  | "refused"
  | "resumed"
  | "failed";

export interface SynchronizationDiagnostics {
  readonly phase: SynchronizationDiagnosticPhase;
  readonly reason: SynchronizationFailureReason | null;
  readonly retryable: boolean | null;
  readonly attempt_count: number;
  readonly last_attempt_at: string | null;
  readonly next_retry_at: string | null;
  readonly local_head: string | null;
  readonly remote_head: string | null;
  readonly last_adopted_head: string | null;
  readonly lineage: SynchronizationLineage | null;
  readonly remote_name: string | null;
  readonly remote_location: string | null;
  readonly recovery_attempted: boolean;
  readonly recovery_outcome: SynchronizationRecoveryOutcome | null;
  readonly error_summary: string | null;
}

export function synchronizationHeadPrefix(
  head: string | null,
): string | null {
  if (head === null) return null;
  const normalized = head.toLowerCase();
  return /^[0-9a-f]{12,}$/.test(normalized)
    ? normalized.slice(0, 12)
    : null;
}

function sanitizedUrl(value: string): string {
  try {
    const url = new URL(value);
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return "[redacted-url]";
  }
}

export function sanitizeSynchronizationErrorSummary(
  error: unknown,
): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Synchronization adapter failure";
  const urls = raw.replace(
    /https?:\/\/[^\s<>"']+/gi,
    (value) => sanitizedUrl(value),
  );
  const authorization = urls
    .replace(/\b(Bearer|Basic)\s+[^\s,;]+/gi, "$1 [redacted]")
    .replace(
      /\b(authorization|access[_-]?token|refresh[_-]?token|client[_-]?secret|password|git_askpass|title|note|reference)\b\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi,
      (_match, key: string) => `${key}=[redacted]`,
    );
  const compact = authorization.replace(/\s+/g, " ").trim();
  return compact.length <= 512
    ? compact
    : `${compact.slice(0, 509)}...`;
}

function diagnosticTextValue(
  value: string | number | boolean | null,
): string {
  return value === null ? "-" : String(value);
}

export function formatSynchronizationDiagnostics(
  value: SynchronizationDiagnostics,
): string {
  const fields: readonly (readonly [
    string,
    string | number | boolean | null,
  ])[] = [
    ["phase", value.phase],
    ["reason", value.reason],
    ["retryable", value.retryable],
    ["attempt_count", value.attempt_count],
    ["last_attempt_at", value.last_attempt_at],
    ["next_retry_at", value.next_retry_at],
    ["local_head", value.local_head],
    ["remote_head", value.remote_head],
    ["last_adopted_head", value.last_adopted_head],
    ["lineage", value.lineage],
    ["remote_name", value.remote_name],
    ["remote_location", value.remote_location],
    ["recovery_attempted", value.recovery_attempted],
    ["recovery_outcome", value.recovery_outcome],
    ["error_summary", value.error_summary],
  ];
  return fields
    .map(
      ([name, field]) =>
        `${name}: ${diagnosticTextValue(field)}`,
    )
    .join("\n");
}

export type LocalGitSnapshotState =
  | "pending"
  | "committed"
  | "issue";

export type RemoteGitSynchronization =
  | {
      readonly state: "not-configured";
      readonly remote_name: null;
      readonly remote_location: null;
    }
  | {
      readonly state:
        | "pending"
        | "retrying"
        | "synchronized"
        | "sync-issue";
      readonly remote_name: string;
      readonly remote_location: string;
    };

export interface RepositorySynchronizationStatus {
  readonly local_git: LocalGitSnapshotState;
  readonly remote: RemoteGitSynchronization;
}

export interface CanonicalState {
  readonly revision: number;
  readonly tasks: readonly Task[];
  readonly recurrences: readonly RecurrenceSeries[];
}

export type CommandResult =
  | { readonly revision: number; readonly task: Task }
  | { readonly revision: number; readonly deleted_task_id: string };

export interface ServiceStatus {
  readonly ready: true;
  readonly repository_path: string;
  readonly repository_status: RepositorySynchronizationStatus;
}

export interface Diagnostics {
  readonly service_healthy: boolean;
  readonly sqlite_available: boolean;
  readonly sqlite_schema_version: number;
  readonly repository_path: string;
  readonly portable_format_version: number;
  readonly repository_adapter_healthy: boolean;
  readonly synchronization: SynchronizationDiagnostics;
}
