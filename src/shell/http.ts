import { readFile } from "node:fs/promises";
import { extname, isAbsolute, relative, resolve } from "node:path";
import type { Database } from "bun:sqlite";
import {
  isPriority,
  TaskValidationError,
  type TaskCommand,
} from "../core/task";
import { PlanningError } from "../core/planning";
import {
  applyTaskCommand,
  readCanonicalState,
  StaleRevisionError,
  type RepositoryStatus,
} from "./sqlite";

export interface ServiceStatus {
  readonly ready: true;
  readonly repository_path: string;
  readonly repository_status: RepositoryStatus;
}

export interface Diagnostics {
  readonly service_healthy: boolean;
  readonly sqlite_available: boolean;
  readonly sqlite_schema_version: number;
  readonly repository_path: string;
  readonly portable_format_version: number;
  readonly repository_adapter_healthy: boolean;
}

export interface HttpDependencies {
  readonly db: Database;
  readonly write_token: string;
  readonly repository_path: string;
  readonly ui_directory: string;
  readonly now: () => string;
  readonly create_id: () => string;
  readonly get_status: () => ServiceStatus;
  readonly get_diagnostics: () => Diagnostics;
  readonly trigger_sync: () => Promise<RepositoryStatus>;
  readonly on_task_mutation: () => void;
}

type JsonObject = Record<string, unknown>;

function json(
  body: unknown,
  status = 200,
  headers: HeadersInit = {},
): Response {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
      ...headers,
    },
  });
}

function asObject(value: unknown, message: string): JsonObject {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw new TaskValidationError(message);
  }
  return value as JsonObject;
}

function exactKeys(
  object: JsonObject,
  allowed: readonly string[],
  required: readonly string[],
  name: string,
): void {
  for (const key of Object.keys(object)) {
    if (!allowed.includes(key)) {
      throw new TaskValidationError(`${name} contains unknown field ${key}`);
    }
  }
  for (const key of required) {
    if (!(key in object)) {
      throw new TaskValidationError(`${name} is missing ${key}`);
    }
  }
}

function optionalNullableString(
  object: JsonObject,
  key: string,
): string | null | undefined {
  const value = object[key];
  if (value === undefined || value === null) {
    return value;
  }
  if (typeof value !== "string") {
    throw new TaskValidationError(`${key} must be a string or null`);
  }
  return value;
}

function requiredString(object: JsonObject, key: string): string {
  const value = object[key];
  if (typeof value !== "string") {
    throw new TaskValidationError(`${key} must be a string`);
  }
  return value;
}

function parseCommand(value: unknown): TaskCommand {
  const object = asObject(value, "command must be an object");
  const type = object.type;
  if (typeof type !== "string") {
    throw new TaskValidationError("command.type must be a string");
  }

  switch (type) {
    case "create": {
      exactKeys(
        object,
        [
          "type",
          "title",
          "scheduled_date",
          "priority",
          "context",
          "reference",
          "note",
          "reminder_time",
        ],
        ["type", "title", "scheduled_date"],
        "create command",
      );
      const priority = object.priority;
      if (priority !== undefined && !isPriority(priority)) {
        throw new TaskValidationError("priority is invalid");
      }
      return {
        type: "create",
        title: requiredString(object, "title"),
        scheduled_date: requiredString(object, "scheduled_date"),
        ...(priority === undefined ? {} : { priority }),
        ...(object.context === undefined
          ? {}
          : { context: optionalNullableString(object, "context") ?? null }),
        ...(object.reference === undefined
          ? {}
          : { reference: optionalNullableString(object, "reference") ?? null }),
        ...(object.note === undefined
          ? {}
          : { note: optionalNullableString(object, "note") ?? null }),
        ...(object.reminder_time === undefined
          ? {}
          : {
              reminder_time:
                optionalNullableString(object, "reminder_time") ?? null,
            }),
      };
    }

    case "edit": {
      exactKeys(
        object,
        ["type", "task_id", "changes"],
        ["type", "task_id", "changes"],
        "edit command",
      );
      const changes = asObject(
        object.changes,
        "edit changes must be an object",
      );
      exactKeys(
        changes,
        [
          "title",
          "scheduled_date",
          "priority",
          "context",
          "reference",
          "note",
          "reminder_time",
        ],
        [],
        "edit changes",
      );

      const priority = changes.priority;
      if (priority !== undefined && !isPriority(priority)) {
        throw new TaskValidationError("priority is invalid");
      }

      return {
        type: "edit",
        task_id: requiredString(object, "task_id"),
        changes: {
          ...(changes.title === undefined
            ? {}
            : { title: requiredString(changes, "title") }),
          ...(changes.scheduled_date === undefined
            ? {}
            : {
                scheduled_date: requiredString(
                  changes,
                  "scheduled_date",
                ),
              }),
          ...(priority === undefined ? {} : { priority }),
          ...(changes.context === undefined
            ? {}
            : {
                context:
                  optionalNullableString(changes, "context") ?? null,
              }),
          ...(changes.reference === undefined
            ? {}
            : {
                reference:
                  optionalNullableString(changes, "reference") ?? null,
              }),
          ...(changes.note === undefined
            ? {}
            : { note: optionalNullableString(changes, "note") ?? null }),
          ...(changes.reminder_time === undefined
            ? {}
            : {
                reminder_time:
                  optionalNullableString(changes, "reminder_time") ?? null,
              }),
        },
      };
    }

    case "move": {
      exactKeys(
        object,
        ["type", "task_id", "destination_date", "destination_index"],
        ["type", "task_id", "destination_date", "destination_index"],
        "move command",
      );
      const destinationIndex = object.destination_index;
      if (
        typeof destinationIndex !== "number" ||
        !Number.isInteger(destinationIndex)
      ) {
        throw new TaskValidationError(
          "destination_index must be an integer",
        );
      }
      return {
        type: "move",
        task_id: requiredString(object, "task_id"),
        destination_date: requiredString(object, "destination_date"),
        destination_index: destinationIndex,
      };
    }

    case "complete":
    case "reopen":
    case "delete":
      exactKeys(
        object,
        ["type", "task_id"],
        ["type", "task_id"],
        `${type} command`,
      );
      return {
        type,
        task_id: requiredString(object, "task_id"),
      };

    default:
      throw new TaskValidationError(`Unknown Task command ${type}`);
  }
}

async function parseJsonRequest(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw new TaskValidationError(
      "State-changing requests require Content-Type application/json",
    );
  }
  try {
    return await request.json();
  } catch {
    throw new TaskValidationError("Request body must be valid JSON");
  }
}

function authorizeMutation(
  request: Request,
  writeToken: string,
): Response | null {
  const requestUrl = new URL(request.url);
  const origin = request.headers.get("origin");
  if (origin !== null && origin !== requestUrl.origin) {
    return json({ error: "cross-origin mutation rejected" }, 403);
  }
  if (request.headers.get("x-jig-write-token") !== writeToken) {
    return json({ error: "invalid write token" }, 403);
  }
  return null;
}

function contentTypeFor(path: string): string {
  switch (extname(path)) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".json":
      return "application/json; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

async function serveUi(
  pathname: string,
  dependencies: HttpDependencies,
): Promise<Response> {
  const requested = pathname === "/" ? "index.html" : pathname.slice(1);
  const absolute = resolve(dependencies.ui_directory, requested);
  const relation = relative(dependencies.ui_directory, absolute);
  if (
    !isAbsolute(dependencies.ui_directory) ||
    relation.startsWith("..") ||
    isAbsolute(relation)
  ) {
    return new Response("Not found", { status: 404 });
  }

  try {
    let content = await readFile(absolute, "utf8");
    if (requested === "index.html") {
      const bootstrap = `<script>window.__JIG_WRITE_TOKEN__=${JSON.stringify(
        dependencies.write_token,
      )};</script>`;
      content = content.replace("</head>", `${bootstrap}</head>`);
    }
    return new Response(content, {
      headers: {
        "content-type": contentTypeFor(absolute),
        "cache-control": "no-store",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

function errorResponse(error: unknown): Response {
  if (error instanceof StaleRevisionError) {
    return json(
      {
        error: "stale_revision",
        current_revision: error.current_revision,
      },
      409,
    );
  }
  if (error instanceof PlanningError) {
    return json(
      { error: error.message },
      error.code === "NOT_FOUND" ? 404 : 400,
    );
  }
  if (error instanceof TaskValidationError) {
    return json({ error: error.message }, 400);
  }
  return json({ error: "internal persistence failure" }, 500);
}

export function createHttpHandler(
  dependencies: HttpDependencies,
): (request: Request) => Promise<Response> {
  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    const { pathname } = url;

    if (request.method === "GET" && pathname === "/api/v1/tasks") {
      return json(readCanonicalState(dependencies.db));
    }
    if (request.method === "GET" && pathname === "/api/v1/status") {
      return json(dependencies.get_status());
    }
    if (
      request.method === "GET" &&
      pathname === "/api/v1/diagnostics"
    ) {
      return json(dependencies.get_diagnostics());
    }

    if (
      request.method === "POST" &&
      ["/api/v1/commands", "/api/v1/sync"].includes(
        pathname,
      )
    ) {
      const unauthorized = authorizeMutation(
        request,
        dependencies.write_token,
      );
      if (unauthorized !== null) {
        return unauthorized;
      }

      try {
        if (pathname === "/api/v1/commands") {
          const body = asObject(
            await parseJsonRequest(request),
            "command request must be an object",
          );
          exactKeys(
            body,
            ["expected_revision", "command"],
            ["expected_revision", "command"],
            "command request",
          );
          if (
            typeof body.expected_revision !== "number" ||
            !Number.isInteger(body.expected_revision) ||
            body.expected_revision < 0
          ) {
            throw new TaskValidationError(
              "expected_revision must be a nonnegative integer",
            );
          }

          const result = applyTaskCommand(
            dependencies.db,
            parseCommand(body.command),
            body.expected_revision,
            dependencies.now(),
            dependencies.create_id,
          );
          dependencies.on_task_mutation();
          return json(result);
        }

        if (pathname === "/api/v1/sync") {
          await parseJsonRequest(request);
          const repositoryStatus = await dependencies.trigger_sync();
          return json(
            { repository_status: repositoryStatus },
            202,
          );
        }


      } catch (error) {
        return errorResponse(error);
      }
    }

    if (request.method === "GET") {
      return serveUi(pathname, dependencies);
    }

    return new Response("Not found", { status: 404 });
  };
}
