import {
  isWeekday,
  validateRecurrenceSeries,
  type RecurrencePattern,
  type RecurrenceSeries,
  type Weekday,
} from "../../src/core/recurrence";
import {
  validateTask,
  type Task,
  type TaskCommand,
} from "../../src/core/task";
import { validateOptionalJigDataConflictCase } from "../../src/core/synchronization-recovery";
import type * as recoveryTypes from "../../src/core/synchronization-recovery";
import type {
  CanonicalState,
  CommandResult,
  Diagnostics,
  RepositorySynchronizationStatus,
  ServiceStatus,
  SynchronizationDiagnostics,
} from "../../src/protocol/runtime";

declare global {
  interface Window {
    __JIG_WRITE_TOKEN__?: string;
  }
}

export class JigHttpError extends Error {
  readonly status: number;
  readonly payload: unknown;

  constructor(status: number, payload: unknown, message: string) {
    super(message);
    this.name = "JigHttpError";
    this.status = status;
    this.payload = payload;
  }
}

function objectValue(value: unknown): Record<string, unknown> {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw new JigHttpError(
      500,
      value,
      "Jig service returned an invalid response",
    );
  }
  return value as Record<string, unknown>;
}

async function responsePayload(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return response.text();
  }

  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function fetchJson(
  input: string,
  init?: RequestInit,
): Promise<unknown> {
  const response = await fetch(input, {
    ...init,
    headers: {
      accept: "application/json",
      ...init?.headers,
    },
  });
  const payload = await responsePayload(response);

  if (!response.ok) {
    const object =
      payload !== null && typeof payload === "object"
        ? (payload as Record<string, unknown>)
        : null;
    const message =
      typeof object?.error === "string"
        ? object.error
        : `Jig request failed with HTTP ${response.status}`;
    throw new JigHttpError(response.status, payload, message);
  }

  return payload;
}

function writeToken(): string {
  const token = window.__JIG_WRITE_TOKEN__;
  if (typeof token !== "string" || token.length === 0) {
    throw new JigHttpError(
      0,
      null,
      "Jig write token is missing; reload the local application",
    );
  }
  return token;
}

export async function postJson(
  path: string,
  body: unknown,
): Promise<unknown> {
  return fetchJson(path, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-jig-write-token": writeToken(),
    },
    body: JSON.stringify(body),
  });
}

function parseRevision(value: unknown): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 0
  ) {
    throw new JigHttpError(
      500,
      value,
      "Jig service returned an invalid revision",
    );
  }
  return value;
}

function responseString(
  object: Record<string, unknown>,
  key: string,
  source: unknown,
): string {
  const value = object[key];
  if (typeof value !== "string") {
    throw new JigHttpError(
      500,
      source,
      `Jig service returned invalid recurrence ${key}`,
    );
  }
  return value;
}

function parseRecurrencePattern(
  value: unknown,
): RecurrencePattern {
  const object = objectValue(value);
  if (object.kind === "weekly") {
    if (
      typeof object.interval_weeks !== "number" ||
      !Number.isInteger(object.interval_weeks) ||
      !Array.isArray(object.weekdays)
    ) {
      throw new JigHttpError(
        500,
        value,
        "Jig service returned invalid weekly recurrence",
      );
    }
    const weekdays: Weekday[] = [];
    for (const weekday of object.weekdays) {
      if (!isWeekday(weekday)) {
        throw new JigHttpError(
          500,
          value,
          "Jig service returned invalid recurrence weekday",
        );
      }
      weekdays.push(weekday);
    }
    return {
      kind: "weekly",
      interval_weeks: object.interval_weeks,
      weekdays,
    };
  }
  if (
    object.kind === "monthly" &&
    typeof object.day_of_month === "number" &&
    Number.isInteger(object.day_of_month)
  ) {
    return {
      kind: "monthly",
      day_of_month: object.day_of_month,
    };
  }
  throw new JigHttpError(
    500,
    value,
    "Jig service returned invalid recurrence pattern",
  );
}

function parseRecurrenceSeries(value: unknown): RecurrenceSeries {
  const object = objectValue(value);
  return validateRecurrenceSeries({
    id: responseString(object, "id", value),
    effective_from: responseString(
      object,
      "effective_from",
      value,
    ),
    end_date: responseString(object, "end_date", value),
    pattern: parseRecurrencePattern(object.pattern),
    created_at: responseString(object, "created_at", value),
    updated_at: responseString(object, "updated_at", value),
  });
}

export async function readCanonicalTasks(): Promise<CanonicalState> {
  const payload = objectValue(await fetchJson("/api/v1/tasks"));
  if (
    !Array.isArray(payload.tasks) ||
    !Array.isArray(payload.recurrences)
  ) {
    throw new JigHttpError(
      500,
      payload,
      "Jig service returned an invalid canonical state",
    );
  }

  const tasks: Task[] = payload.tasks.map((value) => validateTask(value));
  const recurrences: RecurrenceSeries[] =
    payload.recurrences.map((value) => parseRecurrenceSeries(value));
  return {
    revision: parseRevision(payload.revision),
    tasks,
    recurrences,
  };
}

function parseRepositorySynchronizationStatus(
  value: unknown,
): RepositorySynchronizationStatus {
  const status = objectValue(value);
  const localGit = status.local_git;
  if (
    localGit !== "pending" &&
    localGit !== "committed" &&
    localGit !== "issue"
  ) {
    throw new JigHttpError(
      500,
      value,
      "Jig service returned invalid local Git status",
    );
  }

  const remote = objectValue(status.remote);
  const state = remote.state;
  if (state === "not-configured") {
    if (remote.remote_name !== null || remote.remote_location !== null) {
      throw new JigHttpError(
        500,
        value,
        "Jig service returned invalid unconfigured remote status",
      );
    }
    return {
      local_git: localGit,
      remote: {
        state,
        remote_name: null,
        remote_location: null,
      },
    };
  }

  if (
    state !== "pending" &&
    state !== "retrying" &&
    state !== "synchronized" &&
    state !== "sync-issue"
  ) {
    throw new JigHttpError(
      500,
      value,
      "Jig service returned invalid remote synchronization status",
    );
  }
  if (
    typeof remote.remote_name !== "string" ||
    typeof remote.remote_location !== "string"
  ) {
    throw new JigHttpError(
      500,
      value,
      "Jig service returned invalid synchronization remote identity",
    );
  }

  return {
    local_git: localGit,
    remote: {
      state,
      remote_name: remote.remote_name,
      remote_location: remote.remote_location,
    },
  };
}

export async function readStatus(): Promise<ServiceStatus> {
  const payload = objectValue(await fetchJson("/api/v1/status"));
  if (
    payload.ready !== true ||
    typeof payload.repository_path !== "string"
  ) {
    throw new JigHttpError(
      500,
      payload,
      "Jig service returned invalid status",
    );
  }

  return {
    ready: true,
    repository_path: payload.repository_path,
    repository_status:
      parseRepositorySynchronizationStatus(payload.repository_status),
  };
}

function synchronizationDiagnosticString(
  value: unknown,
  payload: unknown,
): string | null {
  if (value === null) return null;
  if (typeof value === "string") return value;
  throw new JigHttpError(
    500,
    payload,
    "Jig service returned invalid synchronization diagnostics",
  );
}

function synchronizationDiagnosticInstant(
  value: unknown,
  payload: unknown,
): string | null {
  const instant = synchronizationDiagnosticString(value, payload);
  if (
    instant !== null &&
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(instant)
  ) {
    throw new JigHttpError(
      500,
      payload,
      "Jig service returned invalid synchronization diagnostics",
    );
  }
  return instant;
}

function synchronizationDiagnosticHead(
  value: unknown,
  payload: unknown,
): string | null {
  const head = synchronizationDiagnosticString(value, payload);
  if (head !== null && !/^[0-9a-f]{12}$/.test(head)) {
    throw new JigHttpError(
      500,
      payload,
      "Jig service returned invalid synchronization diagnostics",
    );
  }
  return head;
}

function parseSynchronizationDiagnostics(
  value: unknown,
): SynchronizationDiagnostics {
  const payload = objectValue(value);
  const phase = payload.phase;
  const reason = payload.reason;
  const retryable = payload.retryable;
  const attemptCount = payload.attempt_count;
  const lastAttemptAt = synchronizationDiagnosticInstant(
    payload.last_attempt_at,
    value,
  );
  const nextRetryAt = synchronizationDiagnosticInstant(
    payload.next_retry_at,
    value,
  );
  const localHead = synchronizationDiagnosticHead(payload.local_head, value);
  const remoteHead = synchronizationDiagnosticHead(payload.remote_head, value);
  const lastAdoptedHead = synchronizationDiagnosticHead(
    payload.last_adopted_head,
    value,
  );
  const lineage = payload.lineage;
  const remoteName = synchronizationDiagnosticString(payload.remote_name, value);
  const remoteLocation = synchronizationDiagnosticString(
    payload.remote_location,
    value,
  );
  const recoveryAttempted = payload.recovery_attempted;
  const recoveryOutcome = payload.recovery_outcome;
  const errorSummary = synchronizationDiagnosticString(
    payload.error_summary,
    value,
  );

  if (
    phase !== "idle" &&
    phase !== "local-reconcile" &&
    phase !== "observe-remote" &&
    phase !== "classify" &&
    phase !== "adopt-remote" &&
    phase !== "export-local" &&
    phase !== "push" &&
    phase !== "verify-remote" &&
    phase !== "recover-divergence" &&
    phase !== "resolve-conflict"
  ) {
    throw new JigHttpError(
      500,
      value,
      "Jig service returned invalid synchronization diagnostics",
    );
  }
  if (
    reason !== null &&
    reason !== "local-export-failed" &&
    reason !== "transport" &&
    reason !== "authentication" &&
    reason !== "remote-ambiguous" &&
    reason !== "remote-absent-after-sync" &&
    reason !== "remote-rewritten" &&
    reason !== "diverged" &&
    reason !== "ancestry-unknown" &&
    reason !== "invalid-snapshot" &&
    reason !== "dataset-mismatch" &&
    reason !== "semantic-conflict" &&
    reason !== "ref-race" &&
    reason !== "unknown"
  ) {
    throw new JigHttpError(
      500,
      value,
      "Jig service returned invalid synchronization diagnostics",
    );
  }
  if (
    retryable !== null &&
    typeof retryable !== "boolean"
  ) {
    throw new JigHttpError(
      500,
      value,
      "Jig service returned invalid synchronization diagnostics",
    );
  }
  if (
    typeof attemptCount !== "number" ||
    !Number.isInteger(attemptCount) ||
    attemptCount < 0
  ) {
    throw new JigHttpError(
      500,
      value,
      "Jig service returned invalid synchronization diagnostics",
    );
  }
  if (
    lineage !== null &&
    lineage !== "equal" &&
    lineage !== "remote-ahead" &&
    lineage !== "local-ahead" &&
    lineage !== "diverged" &&
    lineage !== "unknown"
  ) {
    throw new JigHttpError(
      500,
      value,
      "Jig service returned invalid synchronization diagnostics",
    );
  }
  if (typeof recoveryAttempted !== "boolean") {
    throw new JigHttpError(
      500,
      value,
      "Jig service returned invalid synchronization diagnostics",
    );
  }
  if (
    recoveryOutcome !== null &&
    recoveryOutcome !== "accepted" &&
    recoveryOutcome !== "refused" &&
    recoveryOutcome !== "resumed" &&
    recoveryOutcome !== "failed"
  ) {
    throw new JigHttpError(
      500,
      value,
      "Jig service returned invalid synchronization diagnostics",
    );
  }
  if (
    recoveryAttempted === false &&
    recoveryOutcome !== null
  ) {
    throw new JigHttpError(
      500,
      value,
      "Jig service returned invalid synchronization diagnostics",
    );
  }

  if (reason === null && errorSummary !== null) {
    throw new JigHttpError(
      500,
      value,
      "Jig service returned invalid synchronization diagnostics",
    );
  }

  return {
    phase,
    reason,
    retryable,
    attempt_count: attemptCount,
    last_attempt_at: lastAttemptAt,
    next_retry_at: nextRetryAt,
    local_head: localHead,
    remote_head: remoteHead,
    last_adopted_head: lastAdoptedHead,
    lineage,
    remote_name: remoteName,
    remote_location: remoteLocation,
    recovery_attempted: recoveryAttempted,
    recovery_outcome: recoveryOutcome,
    error_summary: errorSummary,
  };
}

export async function readDiagnostics(): Promise<Diagnostics> {
  const payload = objectValue(await fetchJson("/api/v1/diagnostics"));
  const booleanFields = [
    "service_healthy",
    "sqlite_available",
    "repository_adapter_healthy",
  ] as const;

  for (const field of booleanFields) {
    if (typeof payload[field] !== "boolean") {
      throw new JigHttpError(
        500,
        payload,
        "Jig service returned invalid diagnostics",
      );
    }
  }

  if (
    typeof payload.service_healthy !== "boolean" ||
    typeof payload.sqlite_available !== "boolean" ||
    typeof payload.sqlite_schema_version !== "number" ||
    typeof payload.repository_path !== "string" ||
    typeof payload.portable_format_version !== "number" ||
    typeof payload.repository_adapter_healthy !== "boolean"
  ) {
    throw new JigHttpError(
      500,
      payload,
      "Jig service returned invalid diagnostics",
    );
  }

  return {
    service_healthy: payload.service_healthy,
    sqlite_available: payload.sqlite_available,
    sqlite_schema_version: payload.sqlite_schema_version,
    repository_path: payload.repository_path,
    portable_format_version: payload.portable_format_version,
    repository_adapter_healthy: payload.repository_adapter_healthy,
    synchronization:
      parseSynchronizationDiagnostics(payload.synchronization),
  };
}

export async function submitTaskCommand(
  command: TaskCommand,
  expectedRevision: number,
): Promise<CommandResult> {
  const payload = objectValue(
    await postJson("/api/v1/commands", {
      expected_revision: expectedRevision,
      command,
    }),
  );
  const revision = parseRevision(payload.revision);

  if (typeof payload.deleted_task_id === "string") {
    return {
      revision,
      deleted_task_id: payload.deleted_task_id,
    };
  }

  if (payload.task === undefined) {
    throw new JigHttpError(
      500,
      payload,
      "Jig service returned an invalid command result",
    );
  }

  return {
    revision,
    task: validateTask(payload.task),
  };
}

export async function readSynchronizationConflict(): Promise<
  recoveryTypes.JigDataConflictCase | null
> {
  return validateOptionalJigDataConflictCase(
    await fetchJson("/api/v1/sync/conflict"),
  );
}

export async function resolveSynchronizationConflict(
  resolution: recoveryTypes.JigDataResolution,
): Promise<RepositorySynchronizationStatus> {
  const payload = objectValue(
    await postJson("/api/v1/sync/conflict/resolve", resolution),
  );
  return parseRepositorySynchronizationStatus(
    payload.repository_status,
  );
}

export async function triggerSync(): Promise<RepositorySynchronizationStatus> {
  const payload = objectValue(await postJson("/api/v1/sync", {}));
  return parseRepositorySynchronizationStatus(payload.repository_status);
}

export function isStaleRevision(error: unknown): boolean {
  return error instanceof JigHttpError && error.status === 409;
}
