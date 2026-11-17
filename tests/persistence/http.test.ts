import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createHttpHandler } from "../../src/shell/http";
import {
  applyTaskCommand,
  initializeDatabase,
  readCanonicalState,
  rollForwardOutstandingInDatabase,
} from "../../src/shell/sqlite";

const DATASET_ID = "018f47f0-7b5c-7d4d-8e2b-9c3aa11f0001";
const TOKEN = "a".repeat(64);
let root = "";
let db: Database;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "jig-http-"));
  db = initializeDatabase(join(root, "jig.sqlite"), DATASET_ID);
});

afterEach(async () => {
  db.close();
  await rm(root, { recursive: true, force: true });
});

function handler() {
  return createHttpHandler({
    db,
    write_token: TOKEN,
    repository_path: root,
    ui_directory: root,
    now: () => "2026-11-16T01:00:00.000Z",
    create_id: () =>
      "018f47f0-7b5c-7d4d-8e2b-9c3aa11f0101",
    get_status: () => ({
      ready: true,
      repository_path: root,
      repository_status: "local-only",
    }),
    get_diagnostics: () => ({
      service_healthy: true,
      sqlite_available: true,
      sqlite_schema_version: 1,
      repository_path: root,
      portable_format_version: 1,
      repository_adapter_healthy: true,
    }),
    trigger_sync: async () => "local-only",
    ensure_current_day_rollover: () => undefined,
    on_task_mutation: () => undefined,
  });
}

function postRequest(
  path: string,
  body: unknown,
  token: string | null = TOKEN,
  origin = "http://127.0.0.1:47831",
): Request {
  const headers = new Headers({
    "content-type": "application/json",
    origin,
  });
  if (token !== null) {
    headers.set("x-jig-write-token", token);
  }
  return new Request(`http://127.0.0.1:47831${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

describe("loopback HTTP admission", () => {
  it("returns canonical Task state and revision", async () => {
    const response = await handler()(
      new Request("http://127.0.0.1:47831/api/v1/tasks"),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toStrictEqual({
      revision: 0,
      tasks: [],
    });
  });

  it("requires the ephemeral write token on every mutation", async () => {
    const response = await handler()(
      postRequest(
        "/api/v1/commands",
        {
          expected_revision: 0,
          command: {
            type: "create",
            title: "Blocked",
            scheduled_date: "2026-11-16",
          },
        },
        null,
      ),
    );

    expect(response.status).toBe(403);
    expect(readCanonicalState(db)).toStrictEqual({
      revision: 0,
      tasks: [],
    });
  });

  it("rejects cross-origin mutation", async () => {
    const response = await handler()(
      postRequest(
        "/api/v1/sync",
        {},
        TOKEN,
        "https://example.invalid",
      ),
    );
    expect(response.status).toBe(403);
  });

  it("commits a canonical command only after matching expected revision", async () => {
    const handle = handler();
    const create = await handle(
      postRequest("/api/v1/commands", {
        expected_revision: 0,
        command: {
          type: "create",
          title: "One",
          scheduled_date: "2026-11-16",
        },
      }),
    );
    expect(create.status).toBe(200);
    expect((await create.json()) as { revision: number }).toMatchObject({
      revision: 1,
    });

    const stale = await handle(
      postRequest("/api/v1/commands", {
        expected_revision: 0,
        command: {
          type: "complete",
          task_id: "018f47f0-7b5c-7d4d-8e2b-9c3aa11f0101",
        },
      }),
    );
    expect(stale.status).toBe(409);
    expect(await stale.json()).toStrictEqual({
      error: "stale_revision",
      current_revision: 1,
    });
    expect(readCanonicalState(db).revision).toBe(1);
  });

  it("runs rollover before revision admission and rejects a pre-rollover command", async () => {
    applyTaskCommand(
      db,
      {
        type: "create",
        title: "Yesterday",
        scheduled_date: "2026-11-15",
      },
      0,
      "2026-11-15T18:00:00.000Z",
      () => "018f47f0-7b5c-7d4d-8e2b-9c3aa11f0101",
    );

    let rolloverCalls = 0;
    const handle = createHttpHandler({
      db,
      write_token: TOKEN,
      repository_path: root,
      ui_directory: root,
      now: () => "2026-11-16T01:00:00.000Z",
      create_id: () =>
        "018f47f0-7b5c-7d4d-8e2b-9c3aa11f0102",
      get_status: () => ({
        ready: true,
        repository_path: root,
        repository_status: "pending",
      }),
      get_diagnostics: () => ({
        service_healthy: true,
        sqlite_available: true,
        sqlite_schema_version: 2,
        repository_path: root,
        portable_format_version: 1,
        repository_adapter_healthy: true,
      }),
      trigger_sync: async () => "pending",
      ensure_current_day_rollover: () => {
        rolloverCalls += 1;
        rollForwardOutstandingInDatabase(
          db,
          "2026-11-16",
          "2026-11-16T00:00:00.000Z",
        );
      },
      on_task_mutation: () => undefined,
    });

    const response = await handle(
      postRequest("/api/v1/commands", {
        expected_revision: 1,
        command: {
          type: "complete",
          task_id: "018f47f0-7b5c-7d4d-8e2b-9c3aa11f0101",
        },
      }),
    );

    expect(rolloverCalls).toBe(1);
    expect(response.status).toBe(409);
    expect(await response.json()).toStrictEqual({
      error: "stale_revision",
      current_revision: 2,
    });
    const state = readCanonicalState(db);
    expect(state.revision).toBe(2);
    expect(state.tasks[0]).toMatchObject({
      scheduled_date: "2026-11-16",
      completed_at: null,
    });
  });

  it("rejects unknown command fields instead of widening the boundary", async () => {
    const response = await handler()(
      postRequest("/api/v1/commands", {
        expected_revision: 0,
        command: {
          type: "create",
          title: "No",
          scheduled_date: "2026-11-16",
          project_id: "not-part-of-jig",
        },
      }),
    );
    expect(response.status).toBe(400);
  });

  it("routes sync through the injected serialized worker trigger", async () => {
    let syncCalls = 0;
    const handle = createHttpHandler({
      db,
      write_token: TOKEN,
      repository_path: root,
      ui_directory: root,
      now: () => "2026-11-16T01:00:00.000Z",
      create_id: crypto.randomUUID,
      get_status: () => ({
        ready: true,
        repository_path: root,
          repository_status: "pending",
      }),
      get_diagnostics: () => ({
        service_healthy: true,
        sqlite_available: true,
        sqlite_schema_version: 1,
        repository_path: root,
          portable_format_version: 1,
          repository_adapter_healthy: true,
      }),
      trigger_sync: async () => {
        syncCalls += 1;
        return "synchronized";
      },
      ensure_current_day_rollover: () => undefined,
      on_task_mutation: () => undefined,
    });

    const response = await handle(
      postRequest("/api/v1/sync", {}),
    );
    expect(response.status).toBe(202);
    expect(syncCalls).toBe(1);
  });
});
