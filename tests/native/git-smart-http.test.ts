import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  afterEach,
  describe,
  expect,
  it,
} from "vitest";
import type { Task } from "../../src/core/task";
import {
  serializeSnapshot,
  validateSnapshot,
} from "../../src/core/portable";
import {
  applyTaskCommand as applyTaskCommandAtLocalDate,
  readCanonicalState,
  readMetadata,
} from "../../src/persistence/sqlite";

function applyTaskCommand(
  connection: Parameters<typeof applyTaskCommandAtLocalDate>[0],
  command: Parameters<typeof applyTaskCommandAtLocalDate>[1],
  expectedRevision: number,
  now: string,
  createId: () => string = crypto.randomUUID,
): ReturnType<typeof applyTaskCommandAtLocalDate> {
  const currentLocalDate =
    command.type === "create"
      ? command.scheduled_date
      : now.slice(0, 10);
  return applyTaskCommandAtLocalDate(
    connection,
    command,
    expectedRevision,
    currentLocalDate,
    now,
    createId,
  );
}

import {
  initializeDatabase,
  openDatabase,
} from "../../src/shell/sqlite-bun";
import { initializeRepositoryInstallation } from "../../src/shell/setup";
import { createSyncController } from "../../src/shell/sync";
import type { CanonicalState } from "../../src/protocol/runtime";
import {
  acquireAndroidPortableRepository,
  alignAndroidPortableHead,
  cloneAndroidPortableRepository,
  commitAndroidPortableSnapshot,
  observeAndroidPortableRemote,
  pushAndroidPortableRepository,
  reopenAndroidPortableRepository,
  type AndroidGitEffects,
} from "../../ui/src/native/git";
import {
  createAndroidGitFilesystem,
} from "../../ui/src/native/git-filesystem";
import {
  createAndroidGitHttpClient,
  type NativeHttpPort,
} from "../../ui/src/native/git-http";
import {
  base64ToBytes,
  bytesToBase64,
} from "../../ui/src/native/binary";
import { ANDROID_GIT_WORKTREE } from "../../ui/src/native/paths";
import { createAndroidSyncController } from "../../ui/src/native/sync";
import { fakeFilesystem } from "./fake-filesystem";

const DATASET_ID =
  "018f47f0-7b5c-7d4d-8e2b-9c3aa11f4001";
const USER = "x-access-token";
const PASSWORD = "fixture-token";
const AUTHORIZATION =
  `Basic ${btoa(`${USER}:${PASSWORD}`)}`;

let root: string | null = null;
let server: ReturnType<typeof Bun.serve> | null = null;

async function runGit(
  cwd: string,
  args: readonly string[],
): Promise<string> {
  const child = Bun.spawn(["git", ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
    env: process.env,
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  if (exitCode !== 0) {
    throw new Error(
      `git ${args.join(" ")} failed (${exitCode}): ${stderr || stdout}`,
    );
  }
  return stdout.trim();
}

function headerSeparator(bytes: Uint8Array): {
  readonly index: number;
  readonly length: number;
} {
  for (let index = 0; index < bytes.length - 3; index += 1) {
    if (
      bytes[index] === 13 &&
      bytes[index + 1] === 10 &&
      bytes[index + 2] === 13 &&
      bytes[index + 3] === 10
    ) {
      return { index, length: 4 };
    }
  }
  for (let index = 0; index < bytes.length - 1; index += 1) {
    if (bytes[index] === 10 && bytes[index + 1] === 10) {
      return { index, length: 2 };
    }
  }
  throw new Error("git http-backend returned malformed CGI output");
}

function parseCgiResponse(bytes: Uint8Array): Response {
  const separator = headerSeparator(bytes);
  const headerText = new TextDecoder().decode(
    bytes.slice(0, separator.index),
  );
  const headers = new Headers();
  let status = 200;
  for (const line of headerText.split(/\r?\n/)) {
    const colon = line.indexOf(":");
    if (colon < 0) {
      continue;
    }
    const name = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim();
    if (name.toLowerCase() === "status") {
      const code = Number(value.split(" ", 1)[0]);
      if (Number.isInteger(code)) {
        status = code;
      }
      continue;
    }
    headers.append(name, value);
  }
  return new Response(
    bytes.slice(separator.index + separator.length),
    { status, headers },
  );
}

async function gitBackendResponse(
  request: Request,
  projectRoot: string,
): Promise<Response> {
  if (request.headers.get("authorization") !== AUTHORIZATION) {
    return new Response("authentication required", {
      status: 401,
      headers: {
        "www-authenticate": 'Basic realm="jig-test"',
      },
    });
  }

  const url = new URL(request.url);
  const body = new Uint8Array(await request.arrayBuffer());
  const contentType = request.headers.get("content-type") ?? "";
  const child = Bun.spawn(["git", "http-backend"], {
    stdin: body,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
      GIT_PROJECT_ROOT: projectRoot,
      GIT_HTTP_EXPORT_ALL: "1",
      PATH_INFO: url.pathname,
      QUERY_STRING: url.searchParams.toString(),
      REQUEST_METHOD: request.method,
      CONTENT_TYPE: contentType,
      CONTENT_LENGTH: String(body.byteLength),
      REMOTE_USER: "fixture-user",
      HTTP_AUTHORIZATION: AUTHORIZATION,
    },
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).arrayBuffer(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  if (exitCode !== 0) {
    throw new Error(
      `git http-backend failed (${exitCode}): ${stderr}`,
    );
  }
  return parseCgiResponse(new Uint8Array(stdout));
}

function requestBody(value: string): ArrayBuffer {
  const bytes = base64ToBytes(value);
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function nativeHttpFor(
  port: number,
): NativeHttpPort {
  return {
    async request(options) {
      const source = new URL(options.url);
      const mapped = new URL(
        `http://127.0.0.1:${port}${source.pathname}${source.search}`,
      );
      const response = await fetch(mapped, {
        method: options.method,
        headers: options.headers,
        ...(options.data === undefined
          ? {}
          : { body: requestBody(options.data) }),
      });
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });
      return {
        status: response.status,
        headers: responseHeaders,
        data: bytesToBase64(
          new Uint8Array(await response.arrayBuffer()),
        ),
        url: options.url,
      };
    },
  };
}

async function writeSnapshot(
  directory: string,
  snapshot: ReturnType<typeof serializeSnapshot>,
): Promise<void> {
  for (const [path, value] of snapshot.files) {
    const absolute = join(directory, path);
    await mkdir(
      absolute.slice(0, absolute.lastIndexOf("/")),
      { recursive: true },
    );
    await writeFile(absolute, value, "utf8");
  }
}

function task(
  id: string,
  title: string,
  position: number,
): Task {
  return {
    id,
    title,
    scheduled_date: "2026-11-18",
    position,
    priority: "NORMAL",
    context: "Android Git",
    reference: null,
    note: null,
    reminder_time: null,
    recurrence_series_id: null,
    recurrence_occurrence_date: null,
    completed_at: null,
    created_at: "2026-11-18T01:00:00.000Z",
    updated_at: "2026-11-18T01:00:00.000Z",
  };
}

async function fixture(
  options: Readonly<{ dataBranch?: boolean }> = {},
): Promise<{
  readonly remote: string;
  readonly remoteUrl: string;
}> {
  root = await mkdtemp(join(tmpdir(), "jig-smart-http-"));
  const remote = join(root, "remote.git");
  const seed = join(root, "seed");

  await runGit(root, ["init", "--bare", remote]);
  await runGit(root, ["init", "-b", "main", seed]);
  await runGit(seed, ["config", "user.name", "Fixture"]);
  await runGit(seed, ["config", "user.email", "fixture@example.invalid"]);
  await writeFile(
    join(seed, "README.md"),
    "Unrelated repository content\n",
    "utf8",
  );
  await runGit(seed, ["add", "README.md"]);
  await runGit(seed, ["commit", "-m", "Seed unrelated content"]);
  await runGit(seed, ["remote", "add", "origin", remote]);
  await runGit(seed, ["push", "origin", "main"]);
  await runGit(root, [
    "--git-dir",
    remote,
    "symbolic-ref",
    "HEAD",
    "refs/heads/main",
  ]);

  if (options.dataBranch !== false) {
    await runGit(seed, ["checkout", "--orphan", "jig-data"]);
    await runGit(seed, ["rm", "-rf", "."]);
    await writeSnapshot(
      seed,
      serializeSnapshot([], DATASET_ID),
    );
    await runGit(seed, ["add", "format.json"]);
    await runGit(seed, ["commit", "-m", "Initialize Jig data"]);
    await runGit(seed, ["push", "origin", "jig-data"]);
  }
  await runGit(root, [
    "--git-dir",
    remote,
    "config",
    "http.receivepack",
    "true",
  ]);

  server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: (request) => gitBackendResponse(request, root ?? ""),
  });

  return {
    remote,
    remoteUrl: "https://fixture.invalid/remote.git",
  };
}

afterEach(async () => {
  server?.stop(true);
  server = null;
  if (root !== null) {
    await rm(root, { recursive: true, force: true });
    root = null;
  }
});

describe("Android Git smart-HTTP feasibility", () => {
  it("clones, commits, pushes, restarts and fetches through the selected adapter without touching unrelated content", async () => {
    const { remote, remoteUrl } = await fixture();
    const port = server?.port;
    if (port === undefined) {
      throw new Error("Fixture HTTP server did not start");
    }

    const { port: filesystemPort } = fakeFilesystem();
    const effects: AndroidGitEffects = {
      fs: createAndroidGitFilesystem(filesystemPort),
      http: createAndroidGitHttpClient(nativeHttpFor(port)),
      dir: ANDROID_GIT_WORKTREE,
    };
    let credentialReads = 0;
    const credential = async (): Promise<string> => {
      credentialReads += 1;
      return PASSWORD;
    };

    const cloned = await cloneAndroidPortableRepository(
      effects,
      remoteUrl,
      credential,
    );
    expect(cloned).toMatchObject({
      dataset_id: DATASET_ID,
      tasks: [],
      recurrences: [],
    });
    expect(credentialReads).toBeGreaterThan(0);

    const firstTask = task(
      "018f47f0-7b5c-7d4d-8e2b-9c3aa11f4002",
      "Android pushed",
      0,
    );
    const state: CanonicalState = {
      revision: 1,
      tasks: [firstTask],
      recurrences: [],
    };
    await commitAndroidPortableSnapshot(
      effects,
      serializeSnapshot(
        state.tasks,
        DATASET_ID,
        state.recurrences,
      ),
      state.revision,
    );
    await pushAndroidPortableRepository(effects, credential);

    expect(
      await runGit(root ?? "", [
        "--git-dir",
        remote,
        "show",
        "main:README.md",
      ]),
    ).toBe("Unrelated repository content");

    const desktop = join(root ?? "", "desktop");
    await runGit(root ?? "", [
      "clone",
      "--branch",
      "jig-data",
      remote,
      desktop,
    ]);
    await runGit(desktop, ["config", "user.name", "Fixture"]);
    await runGit(desktop, [
      "config",
      "user.email",
      "fixture@example.invalid",
    ]);
    const desktopFiles = new Map<string, string>();
    for (const path of [
      "format.json",
      `tasks/${firstTask.id}.json`,
    ]) {
      desktopFiles.set(
        path,
        await readFile(join(desktop, path), "utf8"),
      );
    }
    expect(
      validateSnapshot(desktopFiles, DATASET_ID).tasks,
    ).toStrictEqual([firstTask]);

    const secondTask = task(
      "018f47f0-7b5c-7d4d-8e2b-9c3aa11f4003",
      "Desktop pushed",
      1,
    );
    await writeSnapshot(
      desktop,
      serializeSnapshot(
        [firstTask, secondTask],
        DATASET_ID,
      ),
    );
    await runGit(desktop, ["add", "-A"]);
    await runGit(desktop, ["commit", "-m", "Desktop portable update"]);
    await runGit(desktop, ["push", "origin", "jig-data"]);
    const desktopHead = await runGit(desktop, ["rev-parse", "HEAD"]);

    const observed = await observeAndroidPortableRemote(
      effects,
      DATASET_ID,
      null,
      credential,
    );
    expect(observed).toMatchObject({
      state: "present",
      remote_head: desktopHead,
      lineage: "remote-ahead",
    });
    if (observed.state !== "present") {
      throw new Error("expected Android remote observation");
    }
    expect(observed.remote_snapshot.tasks).toStrictEqual([
      firstTask,
      secondTask,
    ]);
    await alignAndroidPortableHead(
      effects,
      observed.local_head,
      observed.remote_head,
    );

    const restarted: AndroidGitEffects = {
      fs: createAndroidGitFilesystem(filesystemPort),
      http: createAndroidGitHttpClient(nativeHttpFor(port)),
      dir: ANDROID_GIT_WORKTREE,
    };
    const reopened = await reopenAndroidPortableRepository(
      restarted,
      DATASET_ID,
    );
    expect(reopened.tasks).toStrictEqual([
      firstTask,
      secondTask,
    ]);
  });

  it("round-trips one repository Android → Desktop → Android through the real synchronization controllers", async () => {
    const { remote, remoteUrl } = await fixture();
    const port = server?.port;
    if (port === undefined || root === null) {
      throw new Error("Fixture HTTP server did not start");
    }

    const desktop = join(root, "real-desktop");
    await runGit(root, ["clone", remote, desktop]);
    const installed = await initializeRepositoryInstallation({
      repository_path: desktop,
      http_port: 47831,
      config_path: join(root, "desktop-config.json"),
    });
    const desktopDb = await openDatabase(installed.sqlite_path);
    const desktopSync = createSyncController(
      desktopDb,
      { repository_path: desktop },
    );

    const { port: filesystemPort } = fakeFilesystem();
    const androidEffects: AndroidGitEffects = {
      fs: createAndroidGitFilesystem(filesystemPort),
      http: createAndroidGitHttpClient(nativeHttpFor(port)),
      dir: ANDROID_GIT_WORKTREE,
    };
    const credential = async (): Promise<string> => PASSWORD;
    await cloneAndroidPortableRepository(
      androidEffects,
      remoteUrl,
      credential,
    );
    const androidDb = await initializeDatabase(
      join(root, "real-android.sqlite"),
      DATASET_ID,
    );
    const androidSync = createAndroidSyncController(
      androidDb,
      androidEffects,
      credential,
    );

    try {
      await desktopSync.start();
      await expect(desktopSync.trigger()).resolves.toMatchObject({
        local_git: "committed",
        remote: { state: "synchronized" },
      });
      await androidSync.start();
      await expect(androidSync.trigger()).resolves.toMatchObject({
        local_git: "committed",
        remote: { state: "synchronized" },
      });

      await applyTaskCommand(
        androidDb,
        {
          type: "create",
          title: "Android first",
          scheduled_date: "2026-11-18",
        },
        0,
        "2026-11-18T03:00:00.000Z",
        () =>
          "018f47f0-7b5c-7d4d-8e2b-9c3aa11f4030",
      );
      androidSync.notifyMutation();
      await expect(androidSync.trigger()).resolves.toMatchObject({
        remote: { state: "synchronized" },
      });

      await expect(desktopSync.trigger()).resolves.toMatchObject({
        remote: { state: "synchronized" },
      });
      expect(
        (await readCanonicalState(desktopDb)).tasks.map(
          (candidate) => candidate.title,
        ),
      ).toEqual(["Android first"]);

      const desktopRevision =
        (await readCanonicalState(desktopDb)).revision;
      await applyTaskCommand(
        desktopDb,
        {
          type: "create",
          title: "Desktop second",
          scheduled_date: "2026-11-18",
        },
        desktopRevision,
        "2026-11-18T04:00:00.000Z",
        () =>
          "018f47f0-7b5c-7d4d-8e2b-9c3aa11f4031",
      );
      desktopSync.notifyMutation();
      await expect(desktopSync.trigger()).resolves.toMatchObject({
        remote: { state: "synchronized" },
      });

      await expect(androidSync.trigger()).resolves.toMatchObject({
        remote: { state: "synchronized" },
      });
      expect(
        (await readCanonicalState(androidDb)).tasks
          .map((candidate) => candidate.title)
          .sort(),
      ).toEqual(["Android first", "Desktop second"]);
    } finally {
      desktopSync.stop();
      androidSync.stop();
      await desktopDb.close();
      await androidDb.close();
    }
  });

  it("round-trips one repository Desktop → Android → Desktop through the real synchronization controllers", async () => {
    const { remote, remoteUrl } = await fixture();
    const port = server?.port;
    if (port === undefined || root === null) {
      throw new Error("Fixture HTTP server did not start");
    }

    const desktop = join(root, "reverse-desktop");
    await runGit(root, ["clone", remote, desktop]);
    const installed = await initializeRepositoryInstallation({
      repository_path: desktop,
      http_port: 47831,
      config_path: join(root, "reverse-desktop-config.json"),
    });
    const desktopDb = await openDatabase(installed.sqlite_path);
    const desktopSync = createSyncController(
      desktopDb,
      { repository_path: desktop },
    );

    const { port: filesystemPort } = fakeFilesystem();
    const androidEffects: AndroidGitEffects = {
      fs: createAndroidGitFilesystem(filesystemPort),
      http: createAndroidGitHttpClient(nativeHttpFor(port)),
      dir: ANDROID_GIT_WORKTREE,
    };
    const credential = async (): Promise<string> => PASSWORD;
    await cloneAndroidPortableRepository(
      androidEffects,
      remoteUrl,
      credential,
    );
    const androidDb = await initializeDatabase(
      join(root, "reverse-android.sqlite"),
      DATASET_ID,
    );
    const androidSync = createAndroidSyncController(
      androidDb,
      androidEffects,
      credential,
    );

    try {
      await desktopSync.start();
      await androidSync.start();
      await desktopSync.trigger();
      await androidSync.trigger();

      await applyTaskCommand(
        desktopDb,
        {
          type: "create",
          title: "Desktop first",
          scheduled_date: "2026-11-18",
        },
        (await readCanonicalState(desktopDb)).revision,
        "2026-11-18T04:30:00.000Z",
        () =>
          "018f47f0-7b5c-7d4d-8e2b-9c3aa11f4032",
      );
      desktopSync.notifyMutation();
      await expect(desktopSync.trigger()).resolves.toMatchObject({
        remote: { state: "synchronized" },
      });

      await expect(androidSync.trigger()).resolves.toMatchObject({
        remote: { state: "synchronized" },
      });
      expect(
        (await readCanonicalState(androidDb)).tasks.map(
          (candidate) => candidate.title,
        ),
      ).toEqual(["Desktop first"]);

      await applyTaskCommand(
        androidDb,
        {
          type: "create",
          title: "Android second",
          scheduled_date: "2026-11-18",
        },
        (await readCanonicalState(androidDb)).revision,
        "2026-11-18T05:00:00.000Z",
        () =>
          "018f47f0-7b5c-7d4d-8e2b-9c3aa11f4033",
      );
      androidSync.notifyMutation();
      await expect(androidSync.trigger()).resolves.toMatchObject({
        remote: { state: "synchronized" },
      });

      await expect(desktopSync.trigger()).resolves.toMatchObject({
        remote: { state: "synchronized" },
      });
      expect(
        (await readCanonicalState(desktopDb)).tasks
          .map((candidate) => candidate.title)
          .sort(),
      ).toEqual(["Android second", "Desktop first"]);
    } finally {
      desktopSync.stop();
      androidSync.stop();
      await desktopDb.close();
      await androidDb.close();
    }
  });

  it("preserves both sides and stops safely on a real cross-runtime semantic conflict", async () => {
    const { remote, remoteUrl } = await fixture();
    const port = server?.port;
    if (port === undefined || root === null) {
      throw new Error("Fixture HTTP server did not start");
    }

    const desktop = join(root, "conflict-desktop");
    await runGit(root, ["clone", remote, desktop]);
    const installed = await initializeRepositoryInstallation({
      repository_path: desktop,
      http_port: 47831,
      config_path: join(root, "conflict-desktop-config.json"),
    });
    const desktopDb = await openDatabase(installed.sqlite_path);
    const desktopSync = createSyncController(
      desktopDb,
      { repository_path: desktop },
    );

    const { port: filesystemPort } = fakeFilesystem();
    const androidEffects: AndroidGitEffects = {
      fs: createAndroidGitFilesystem(filesystemPort),
      http: createAndroidGitHttpClient(nativeHttpFor(port)),
      dir: ANDROID_GIT_WORKTREE,
    };
    const credential = async (): Promise<string> => PASSWORD;
    await cloneAndroidPortableRepository(
      androidEffects,
      remoteUrl,
      credential,
    );
    const androidDb = await initializeDatabase(
      join(root, "conflict-android.sqlite"),
      DATASET_ID,
    );
    const androidSync = createAndroidSyncController(
      androidDb,
      androidEffects,
      credential,
    );
    const taskId =
      "018f47f0-7b5c-7d4d-8e2b-9c3aa11f4050";

    try {
      await desktopSync.start();
      await androidSync.start();
      await desktopSync.trigger();
      await androidSync.trigger();

      await applyTaskCommand(
        desktopDb,
        {
          type: "create",
          title: "Shared base",
          scheduled_date: "2026-11-18",
        },
        (await readCanonicalState(desktopDb)).revision,
        "2026-11-18T06:00:00.000Z",
        () => taskId,
      );
      desktopSync.notifyMutation();
      await desktopSync.trigger();
      await androidSync.trigger();

      const desktopBaseRevision =
        (await readCanonicalState(desktopDb)).revision;
      const androidBaseRevision =
        (await readCanonicalState(androidDb)).revision;
      await applyTaskCommand(
        desktopDb,
        {
          type: "edit",
          task_id: taskId,
          changes: { title: "Desktop conflict" },
        },
        desktopBaseRevision,
        "2026-11-18T06:01:00.000Z",
      );
      desktopSync.notifyMutation();
      await applyTaskCommand(
        androidDb,
        {
          type: "edit",
          task_id: taskId,
          changes: { title: "Android conflict" },
        },
        androidBaseRevision,
        "2026-11-18T06:02:00.000Z",
      );
      androidSync.notifyMutation();

      await expect(desktopSync.trigger()).resolves.toMatchObject({
        remote: { state: "synchronized" },
      });
      const remoteHeadBeforeConflict = await runGit(root, [
        "--git-dir",
        remote,
        "rev-parse",
        "jig-data",
      ]);

      await expect(androidSync.trigger()).resolves.toMatchObject({
        local_git: "pending",
        remote: { state: "sync-issue" },
      });

      expect(
        (await readCanonicalState(androidDb)).tasks[0],
      ).toMatchObject({ title: "Android conflict" });
      expect(
        (await readCanonicalState(desktopDb)).tasks[0],
      ).toMatchObject({ title: "Desktop conflict" });
      expect(
        await runGit(root, [
          "--git-dir",
          remote,
          "rev-parse",
          "jig-data",
        ]),
      ).toBe(remoteHeadBeforeConflict);
      expect(
        await runGit(root, [
          "--git-dir",
          remote,
          "show",
          `jig-data:tasks/${taskId}.json`,
        ]),
      ).toContain('"title": "Desktop conflict"');
    } finally {
      desktopSync.stop();
      androidSync.stop();
      await desktopDb.close();
      await androidDb.close();
    }
  });

  it("initializes only jig-data when the selected repository has no portable branch", async () => {
    const { remote, remoteUrl } = await fixture({
      dataBranch: false,
    });
    const port = server?.port;
    if (port === undefined) {
      throw new Error("Fixture HTTP server did not start");
    }
    const { port: filesystemPort } = fakeFilesystem();
    const effects: AndroidGitEffects = {
      fs: createAndroidGitFilesystem(filesystemPort),
      http: createAndroidGitHttpClient(nativeHttpFor(port)),
      dir: ANDROID_GIT_WORKTREE,
    };

    const acquired = await acquireAndroidPortableRepository(
      effects,
      remoteUrl,
      async () => PASSWORD,
      () => DATASET_ID,
    );
    expect(acquired).toMatchObject({
      dataset_id: DATASET_ID,
      tasks: [],
      recurrences: [],
    });
    expect(
      await runGit(root ?? "", [
        "--git-dir",
        remote,
        "show",
        "main:README.md",
      ]),
    ).toBe("Unrelated repository content");
    expect(
      await runGit(root ?? "", [
        "--git-dir",
        remote,
        "show",
        "jig-data:format.json",
      ]),
    ).toContain(DATASET_ID);
  });

  it("retains Android remote deletion and rewrite evidence across repeated observations and restart", async () => {
    const { remote, remoteUrl } = await fixture();
    const port = server?.port;
    if (port === undefined || root === null) {
      throw new Error("Fixture HTTP server did not start");
    }
    const { port: filesystemPort } = fakeFilesystem();
    const effects: AndroidGitEffects = {
      fs: createAndroidGitFilesystem(filesystemPort),
      http: createAndroidGitHttpClient(nativeHttpFor(port)),
      dir: ANDROID_GIT_WORKTREE,
    };
    const credential = async (): Promise<string> => PASSWORD;
    await cloneAndroidPortableRepository(
      effects,
      remoteUrl,
      credential,
    );

    const first = await observeAndroidPortableRemote(
      effects,
      DATASET_ID,
      null,
      credential,
    );
    if (first.state !== "present") {
      throw new Error("expected initial Android remote observation");
    }
    const originalHead = first.remote_head;

    await runGit(root, [
      "--git-dir",
      remote,
      "update-ref",
      "-d",
      "refs/heads/jig-data",
    ]);
    const deleted = await observeAndroidPortableRemote(
      effects,
      DATASET_ID,
      originalHead,
      credential,
    );
    expect(deleted).toMatchObject({
      state: "absent",
      previously_synchronized: true,
    });

    const replacement = join(root, "android-rewrite");
    await runGit(root, [
      "init",
      "-b",
      "jig-data",
      replacement,
    ]);
    await runGit(replacement, [
      "config",
      "user.name",
      "Fixture",
    ]);
    await runGit(replacement, [
      "config",
      "user.email",
      "fixture@example.invalid",
    ]);
    await writeSnapshot(
      replacement,
      serializeSnapshot(
        [task(
          "018f47f0-7b5c-7d4d-8e2b-9c3aa11f4060",
          "Replacement history",
          0,
        )],
        DATASET_ID,
      ),
    );
    await runGit(replacement, ["add", "-A"]);
    await runGit(replacement, [
      "commit",
      "-m",
      "Replacement Jig history",
    ]);
    await runGit(replacement, [
      "remote",
      "add",
      "origin",
      remote,
    ]);
    await runGit(replacement, [
      "push",
      "origin",
      "jig-data",
    ]);

    const rewritten = await observeAndroidPortableRemote(
      effects,
      DATASET_ID,
      originalHead,
      credential,
    );
    expect(rewritten).toMatchObject({
      state: "present",
      remote_rewritten: true,
    });

    const restarted: AndroidGitEffects = {
      fs: createAndroidGitFilesystem(filesystemPort),
      http: createAndroidGitHttpClient(nativeHttpFor(port)),
      dir: ANDROID_GIT_WORKTREE,
    };
    const repeated = await observeAndroidPortableRemote(
      restarted,
      DATASET_ID,
      originalHead,
      credential,
    );
    expect(repeated).toMatchObject({
      state: "present",
      remote_rewritten: true,
    });
  });

  it("rejects an invalid Android remote portable tree before moving the local branch", async () => {
    const { remote, remoteUrl } = await fixture();
    const port = server?.port;
    if (port === undefined || root === null) {
      throw new Error("Fixture HTTP server did not start");
    }
    const { port: filesystemPort } = fakeFilesystem();
    const effects: AndroidGitEffects = {
      fs: createAndroidGitFilesystem(filesystemPort),
      http: createAndroidGitHttpClient(nativeHttpFor(port)),
      dir: ANDROID_GIT_WORKTREE,
    };
    const credential = async (): Promise<string> => PASSWORD;
    await cloneAndroidPortableRepository(
      effects,
      remoteUrl,
      credential,
    );
    const localHead = await runGit(root, [
      "--git-dir",
      remote,
      "rev-parse",
      "jig-data",
    ]);

    const writer = join(root, "android-invalid-tree");
    await runGit(root, [
      "clone",
      "--branch",
      "jig-data",
      remote,
      writer,
    ]);
    await runGit(writer, ["config", "user.name", "Fixture"]);
    await runGit(writer, [
      "config",
      "user.email",
      "fixture@example.invalid",
    ]);
    await writeFile(
      join(writer, "unexpected.txt"),
      "not portable Jig data\n",
      "utf8",
    );
    await runGit(writer, ["add", "unexpected.txt"]);
    await runGit(writer, [
      "commit",
      "-m",
      "Invalid Android portable tree",
    ]);
    await runGit(writer, ["push", "origin", "jig-data"]);

    await expect(
      observeAndroidPortableRemote(
        effects,
        DATASET_ID,
        null,
        credential,
      ),
    ).resolves.toMatchObject({ state: "unsafe" });
    expect(
      await reopenAndroidPortableRepository(
        effects,
        DATASET_ID,
      ),
    ).toMatchObject({ tasks: [] });
    expect(localHead).not.toBe(
      await runGit(writer, ["rev-parse", "HEAD"]),
    );
  });

  it("refuses true portable-history divergence instead of auto-merging", async () => {
    const { remote, remoteUrl } = await fixture();
    const port = server?.port;
    if (port === undefined) {
      throw new Error("Fixture HTTP server did not start");
    }
    const { port: filesystemPort } = fakeFilesystem();
    const effects: AndroidGitEffects = {
      fs: createAndroidGitFilesystem(filesystemPort),
      http: createAndroidGitHttpClient(nativeHttpFor(port)),
      dir: ANDROID_GIT_WORKTREE,
    };
    const credential = async (): Promise<string> => PASSWORD;
    await cloneAndroidPortableRepository(
      effects,
      remoteUrl,
      credential,
    );

    const localTask = task(
      "018f47f0-7b5c-7d4d-8e2b-9c3aa11f4010",
      "Local divergent",
      0,
    );
    await commitAndroidPortableSnapshot(
      effects,
      serializeSnapshot([localTask], DATASET_ID),
      1,
    );

    const desktop = join(root ?? "", "divergent-desktop");
    await runGit(root ?? "", [
      "clone",
      "--branch",
      "jig-data",
      remote,
      desktop,
    ]);
    await runGit(desktop, ["config", "user.name", "Fixture"]);
    await runGit(desktop, [
      "config",
      "user.email",
      "fixture@example.invalid",
    ]);
    const remoteTask = task(
      "018f47f0-7b5c-7d4d-8e2b-9c3aa11f4011",
      "Remote divergent",
      0,
    );
    await writeSnapshot(
      desktop,
      serializeSnapshot([remoteTask], DATASET_ID),
    );
    await runGit(desktop, ["add", "-A"]);
    await runGit(desktop, [
      "commit",
      "-m",
      "Remote divergent update",
    ]);
    await runGit(desktop, ["push", "origin", "jig-data"]);

    await expect(
      observeAndroidPortableRemote(
        effects,
        DATASET_ID,
        null,
        credential,
      ),
    ).resolves.toMatchObject({
      state: "present",
      lineage: "diverged",
    });
    expect(
      (
        await reopenAndroidPortableRepository(
          effects,
          DATASET_ID,
        )
      ).tasks,
    ).toStrictEqual([localTask]);
  });

  it("keeps SQLite durable and Local Git pending when authenticated remote observation fails", async () => {
    const { remoteUrl } = await fixture();
    const port = server?.port;
    if (port === undefined || root === null) {
      throw new Error("Fixture HTTP server did not start");
    }
    const { port: filesystemPort } = fakeFilesystem();
    const effects: AndroidGitEffects = {
      fs: createAndroidGitFilesystem(filesystemPort),
      http: createAndroidGitHttpClient(nativeHttpFor(port)),
      dir: ANDROID_GIT_WORKTREE,
    };
    await cloneAndroidPortableRepository(
      effects,
      remoteUrl,
      async () => PASSWORD,
    );

    const database = await initializeDatabase(
      join(root, "android-sync.sqlite"),
      DATASET_ID,
    );
    try {
      await applyTaskCommand(
        database,
        {
          type: "create",
          title: "Offline-safe mutation",
          scheduled_date: "2026-11-18",
        },
        0,
        "2026-11-18T02:00:00.000Z",
        () =>
          "018f47f0-7b5c-7d4d-8e2b-9c3aa11f4020",
      );

      const controller = createAndroidSyncController(
        database,
        effects,
        async () => "wrong-token",
      );
      await controller.start();
      const status = await controller.trigger();

      expect(status).toMatchObject({
        local_git: "pending",
        remote: {
          state: "sync-issue",
          remote_name: "origin",
          remote_location: remoteUrl,
        },
      });
      expect(await readMetadata(database)).toMatchObject({
        revision: 1,
        last_exported_revision: 0,
        pending_sync: true,
      });
      expect(
        (await readCanonicalState(database)).tasks[0],
      ).toMatchObject({
        title: "Offline-safe mutation",
      });
      controller.stop();
    } finally {
      await database.close();
    }
  });

  it("adopts a remote fast-forward snapshot into canonical SQLite", async () => {
    const { remote, remoteUrl } = await fixture();
    const port = server?.port;
    if (port === undefined || root === null) {
      throw new Error("Fixture HTTP server did not start");
    }
    const { port: filesystemPort } = fakeFilesystem();
    const effects: AndroidGitEffects = {
      fs: createAndroidGitFilesystem(filesystemPort),
      http: createAndroidGitHttpClient(nativeHttpFor(port)),
      dir: ANDROID_GIT_WORKTREE,
    };
    const credential = async (): Promise<string> => PASSWORD;
    await cloneAndroidPortableRepository(
      effects,
      remoteUrl,
      credential,
    );

    const database = await initializeDatabase(
      join(root, "android-adopt.sqlite"),
      DATASET_ID,
    );
    const controller = createAndroidSyncController(
      database,
      effects,
      credential,
    );
    try {
      await controller.start();
      await expect(controller.trigger()).resolves.toMatchObject({
        local_git: "committed",
        remote: { state: "synchronized" },
      });

      const desktop = join(root, "adopt-desktop");
      await runGit(root, [
        "clone",
        "--branch",
        "jig-data",
        remote,
        desktop,
      ]);
      await runGit(desktop, ["config", "user.name", "Fixture"]);
      await runGit(desktop, [
        "config",
        "user.email",
        "fixture@example.invalid",
      ]);
      const remoteTask = task(
        "018f47f0-7b5c-7d4d-8e2b-9c3aa11f4021",
        "Remote adopted",
        0,
      );
      await writeSnapshot(
        desktop,
        serializeSnapshot([remoteTask], DATASET_ID),
      );
      await runGit(desktop, ["add", "-A"]);
      await runGit(desktop, [
        "commit",
        "-m",
        "Remote canonical update",
      ]);
      await runGit(desktop, ["push", "origin", "jig-data"]);

      await expect(controller.trigger()).resolves.toMatchObject({
        local_git: "committed",
        remote: { state: "synchronized" },
      });
      expect(
        (await readCanonicalState(database)).tasks,
      ).toStrictEqual([remoteTask]);
      expect(await readMetadata(database)).toMatchObject({
        revision: 1,
        last_exported_revision: 1,
        pending_sync: false,
      });
    } finally {
      controller.stop();
      await database.close();
    }
  });

  it("reports authentication failure without putting credentials in the remote URL", async () => {
    const { remoteUrl } = await fixture();
    const port = server?.port;
    if (port === undefined) {
      throw new Error("Fixture HTTP server did not start");
    }
    const { port: filesystemPort } = fakeFilesystem();
    const effects: AndroidGitEffects = {
      fs: createAndroidGitFilesystem(filesystemPort),
      http: createAndroidGitHttpClient(nativeHttpFor(port)),
      dir: ANDROID_GIT_WORKTREE,
    };

    await expect(
      cloneAndroidPortableRepository(
        effects,
        remoteUrl,
        async () => "wrong-token",
      ),
    ).rejects.toThrow();
    expect(remoteUrl).toBe(
      "https://fixture.invalid/remote.git",
    );
  });
});
