import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createHttpHandler } from "../../src/shell/http";
import {
  applyTaskCommand,
  readCanonicalState,
  rollForwardOutstandingInDatabase,
  type JigSqlConnection,
} from "../../src/persistence/sqlite";
import { initializeDatabase } from "../../src/shell/sqlite-bun";

const DATASET_ID = "018f47f0-7b5c-7d4d-8e2b-9c3aa11f0001";
const TOKEN = "a".repeat(64);
const LOCAL_ONLY_STATUS = {
  local_git: "committed",
  remote: {
    state: "not-configured",
    remote_name: null,
    remote_location: null,
  },
} as const;
const PENDING_STATUS = {
  local_git: "pending",
  remote: {
    state: "pending",
    remote_name: "origin",
    remote_location: "https://example.invalid/personal/jig-data.git",
  },
} as const;
const SYNCHRONIZED_STATUS = {
  local_git: "committed",
  remote: {
    state: "synchronized",
    remote_name: "origin",
    remote_location: "https://example.invalid/personal/jig-data.git",
  },
} as const;
let root = "";
let db: JigSqlConnection;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "jig-http-"));
  db = await initializeDatabase(join(root, "jig.sqlite"), DATASET_ID);
});

afterEach(async () => {
  await db.close();
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
      repository_status: LOCAL_ONLY_STATUS,
    }),
    get_diagnostics: () => ({
      service_healthy: true,
      sqlite_available: true,
      sqlite_schema_version: 1,
      repository_path: root,
      portable_format_version: 1,
      repository_adapter_healthy: true,
    }),
    trigger_sync: async () => LOCAL_ONLY_STATUS,
    ensure_current_day_rollover: async () => undefined,
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
      recurrences: [],
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
    expect(await readCanonicalState(db)).toStrictEqual({
      revision: 0,
      tasks: [],
      recurrences: [],
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
    expect((await readCanonicalState(db)).revision).toBe(1);
  });

  it("runs rollover before revision admission and rejects a pre-rollover command", async () => {
    await applyTaskCommand(
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
        repository_status: PENDING_STATUS,
      }),
      get_diagnostics: () => ({
        service_healthy: true,
        sqlite_available: true,
        sqlite_schema_version: 2,
        repository_path: root,
        portable_format_version: 1,
        repository_adapter_healthy: true,
      }),
      trigger_sync: async () => PENDING_STATUS,
      ensure_current_day_rollover: async () => {
        rolloverCalls += 1;
        await rollForwardOutstandingInDatabase(
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
    const state = await readCanonicalState(db);
    expect(state.revision).toBe(2);
    expect(state.tasks[0]).toMatchObject({
      scheduled_date: "2026-11-16",
      completed_at: null,
    });
  });

  it("admits recurrence on the canonical edit command and rejects widened recurrence shapes", async () => {
    const ids = [
      "018f47f0-7b5c-7d4d-8e2b-9c3aa11f2001",
      "018f47f0-7b5c-7d4d-8e2b-9c3aa11f2002",
      "018f47f0-7b5c-7d4d-8e2b-9c3aa11f2003",
    ];
    let index = 0;
    const handle = createHttpHandler({
      db,
      write_token: TOKEN,
      repository_path: root,
      ui_directory: root,
      now: () => "2026-11-16T01:00:00.000Z",
      create_id: () => {
        const id = ids[index];
        if (id === undefined) {
          throw new Error("HTTP recurrence id fixture exhausted");
        }
        index += 1;
        return id;
      },
      get_status: () => ({
        ready: true,
        repository_path: root,
        repository_status: LOCAL_ONLY_STATUS,
      }),
      get_diagnostics: () => ({
        service_healthy: true,
        sqlite_available: true,
        sqlite_schema_version: 3,
        repository_path: root,
        portable_format_version: 2,
        repository_adapter_healthy: true,
      }),
      trigger_sync: async () => LOCAL_ONLY_STATUS,
      ensure_current_day_rollover: async () => undefined,
      on_task_mutation: () => undefined,
    });

    const created = await handle(
      postRequest("/api/v1/commands", {
        expected_revision: 0,
        command: {
          type: "create",
          title: "HTTP recurrence",
          scheduled_date: "2026-11-16",
        },
      }),
    );
    expect(created.status).toBe(200);

    const repeated = await handle(
      postRequest("/api/v1/commands", {
        expected_revision: 1,
        command: {
          type: "edit",
          task_id: ids[0],
          changes: {},
          recurrence: {
            pattern: {
              kind: "weekly",
              interval_weeks: 1,
              weekdays: ["MON"],
            },
            end_date: "2026-11-23",
          },
        },
      }),
    );
    expect(repeated.status).toBe(200);
    expect(await readCanonicalState(db)).toMatchObject({
      revision: 2,
      recurrences: [
        {
          id: ids[1],
          effective_from: "2026-11-16",
          end_date: "2026-11-23",
        },
      ],
    });

    const widened = await handle(
      postRequest("/api/v1/commands", {
        expected_revision: 2,
        command: {
          type: "edit",
          task_id: ids[0],
          changes: {},
          recurrence: {
            pattern: {
              kind: "weekly",
              interval_weeks: 1,
              weekdays: ["MON"],
              propagate_title: true,
            },
            end_date: "2026-11-30",
          },
        },
      }),
    );
    expect(widened.status).toBe(400);
    expect((await readCanonicalState(db)).revision).toBe(2);
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
          repository_status: PENDING_STATUS,
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
        return SYNCHRONIZED_STATUS;
      },
      ensure_current_day_rollover: async () => undefined,
      on_task_mutation: () => undefined,
    });

    const response = await handle(
      postRequest("/api/v1/sync", {}),
    );
    expect(response.status).toBe(202);
    expect(syncCalls).toBe(1);
    expect(await response.json()).toStrictEqual({
      repository_status: SYNCHRONIZED_STATUS,
    });
  });
});
