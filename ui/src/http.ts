import {
  validateTask,
  type Task,
  type TaskCommand,
} from "../../src/core/task";
import type {
  CanonicalState,
  CommandResult,
  RepositoryStatus,
} from "../../src/shell/sqlite";
import type {
  Diagnostics,
  ServiceStatus,
} from "../../src/shell/http";

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

async function fetchJson(
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

async function postJson(
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

export async function readCanonicalTasks(): Promise<CanonicalState> {
  const payload = objectValue(await fetchJson("/api/v1/tasks"));
  if (!Array.isArray(payload.tasks)) {
    throw new JigHttpError(
      500,
      payload,
      "Jig service returned an invalid Task set",
    );
  }

  const tasks: Task[] = payload.tasks.map((value) => validateTask(value));
  return {
    revision: parseRevision(payload.revision),
    tasks,
  };
}

function isRepositoryStatus(value: unknown): value is RepositoryStatus {
  return (
    value === "local-only" ||
    value === "pending" ||
    value === "retrying" ||
    value === "synchronized" ||
    value === "sync-issue"
  );
}

export async function readStatus(): Promise<ServiceStatus> {
  const payload = objectValue(await fetchJson("/api/v1/status"));
  if (
    payload.ready !== true ||
    typeof payload.repository_path !== "string" ||
    !isRepositoryStatus(payload.repository_status)
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
    repository_status: payload.repository_status,
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
    typeof payload.sqlite_schema_version !== "number" ||
    typeof payload.repository_path !== "string" ||
    typeof payload.portable_format_version !== "number"
  ) {
    throw new JigHttpError(
      500,
      payload,
      "Jig service returned invalid diagnostics",
    );
  }

  return {
    service_healthy: payload.service_healthy as boolean,
    sqlite_available: payload.sqlite_available as boolean,
    sqlite_schema_version: payload.sqlite_schema_version,
    repository_path: payload.repository_path,
    portable_format_version: payload.portable_format_version,
    repository_adapter_healthy:
      payload.repository_adapter_healthy as boolean,
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

export async function triggerSync(): Promise<RepositoryStatus> {
  const payload = objectValue(await postJson("/api/v1/sync", {}));
  if (!isRepositoryStatus(payload.repository_status)) {
    throw new JigHttpError(
      500,
      payload,
      "Jig service returned invalid synchronization status",
    );
  }
  return payload.repository_status;
}

export function isStaleRevision(error: unknown): boolean {
  return error instanceof JigHttpError && error.status === 409;
}
