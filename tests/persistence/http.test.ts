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
import { GitHubOnboardingController } from "../../src/shell/github-onboarding";

const DATASET_ID = "018f47f0-7b5c-7d4d-8e2b-9c3aa11f0001";
const TOKEN = "a".repeat(64);
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
      repository_status: "local-only",
      github_reconnect_available: false,
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
        repository_status: "pending",
        github_reconnect_available: false,
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

  it("protects configured GitHub reconnect and replaces only the device credential", async () => {
    let nowMs = Date.parse("2030-01-01T00:00:00.000Z");
    let storedUserId: number | null = null;
    const reconnect = new GitHubOnboardingController({
      registration: {
        app_slug: "jig-desktop-mobile-test",
        client_id: "shared-client-id",
      },
      config_path: join(root, "config.json"),
      http_port: 47831,
      on_configured: () => undefined,
      assert_secret_service: async () => undefined,
      now: () => new Date(nowMs),
      start_device_authorization: async () => ({
        device_code: "device-code",
        user_code: "ABCD-EFGH",
        verification_uri: "https://github.com/login/device",
        expires_in: 900,
        interval: 5,
      }),
      poll_device_authorization: async () => ({
        status: "authorized" as const,
        credential: {
          user_id: 42,
          access_token: "access-token",
          refresh_token: "refresh-token",
          access_token_expires_at: "2030-01-01T08:00:00.000Z",
          refresh_token_expires_at: "2030-07-04T00:00:00.000Z",
        },
      }),
      store_credential: async (credential) => {
        storedUserId = credential.user_id;
      },
    });

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
        repository_status: "sync-issue",
        github_reconnect_available: true,
      }),
      get_diagnostics: () => ({
        service_healthy: true,
        sqlite_available: true,
        sqlite_schema_version: 1,
        repository_path: root,
        portable_format_version: 1,
        repository_adapter_healthy: false,
      }),
      trigger_sync: async () => "sync-issue",
      github_reconnect: reconnect,
      ensure_current_day_rollover: async () => undefined,
      on_task_mutation: () => undefined,
    });

    const unauthorized = await handle(
      postRequest("/api/v1/github/reconnect/start", {}, null),
    );
    expect(unauthorized.status).toBe(403);
    expect(storedUserId).toBeNull();

    const started = await handle(
      postRequest("/api/v1/github/reconnect/start", {}),
    );
    expect(started.status).toBe(200);
    expect(await started.json()).toMatchObject({
      phase: "authorizing",
      authorization: {
        mode: "device",
        user_code: "ABCD-EFGH",
      },
      repositories: [],
    });

    nowMs += 5_000;
    const refreshed = await handle(
      postRequest("/api/v1/github/reconnect/refresh", {}),
    );
    expect(refreshed.status).toBe(200);
    expect(await refreshed.json()).toMatchObject({
      phase: "idle",
      authorization: null,
      repositories: [],
      error: null,
    });
    expect(storedUserId).toBe(42);
  });

  it("does not expose GitHub reconnect for provider-neutral repositories", async () => {
    const response = await handler()(
      postRequest("/api/v1/github/reconnect/start", {}),
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toStrictEqual({
      error: "GitHub reconnect is unavailable for this repository",
    });
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
        github_reconnect_available: false,
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
      ensure_current_day_rollover: async () => undefined,
      on_task_mutation: () => undefined,
    });

    const response = await handle(
      postRequest("/api/v1/sync", {}),
    );
    expect(response.status).toBe(202);
    expect(syncCalls).toBe(1);
  });
});
