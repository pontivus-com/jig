import {
  mkdir,
  mkdtemp,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  afterEach,
  describe,
  expect,
  it,
} from "vitest";

import type { Task } from "../../src/core/task";
import { serializeSnapshot } from "../../src/core/portable";
import {
  applyTaskCommand,
  markExported,
  readCanonicalState,
  readMetadata,
  type JigSqlConnection,
} from "../../src/persistence/sqlite";
import { runGit } from "../../src/shell/git/process";
import {
  ensurePortableData,
  readCurrentPortableSnapshot,
} from "../../src/shell/git/portable-store";
import { createSyncController } from "../../src/shell/sync";
import { initializeDatabase } from "../../src/shell/sqlite-bun";

const DATASET_ID =
  "018f47f0-7b5c-7d4d-8e2b-9c3aa11f0001";
const LOCAL_TASK_ID =
  "018f47f0-7b5c-7d4d-8e2b-000000000301";
const REMOTE_TASK_ID =
  "018f47f0-7b5c-7d4d-8e2b-000000000302";

const roots: string[] = [];
let db: JigSqlConnection | null = null;

async function git(
  cwd: string,
  args: readonly string[],
): Promise<string> {
  const result = await runGit(cwd, args);
  if (result.exit_code !== 0) {
    throw new Error(result.stderr || result.stdout);
  }
  return result.stdout;
}

async function writeSnapshotFiles(
  directory: string,
  files: ReadonlyMap<string, string>,
): Promise<void> {
  for (const [path, value] of files) {
    const absolute = join(directory, path);
    await mkdir(dirname(absolute), { recursive: true });
    await writeFile(absolute, value, "utf8");
  }
}

function remoteTask(position: number): Task {
  return {
    id: REMOTE_TASK_ID,
    title: "Remote fast-forward",
    scheduled_date: "2026-11-22",
    position,
    priority: "NORMAL",
    context: null,
    reference: null,
    note: null,
    reminder_time: null,
    recurrence_series_id: null,
    recurrence_occurrence_date: null,
    completed_at: null,
    created_at: "2026-11-22T12:00:00.000Z",
    updated_at: "2026-11-22T12:00:00.000Z",
  };
}

afterEach(async () => {
  if (db !== null) {
    await db.close();
    db = null;
  }
  await Promise.all(
    roots.splice(0).map((root) =>
      rm(root, { recursive: true, force: true }),
    ),
  );
});

describe("Desktop synchronization reproduction evidence", () => {
  it("keeps the upgraded system-Git controller synchronized across publish, local change, restart and remote fast-forward", async () => {
    const repository = await mkdtemp(
      join(tmpdir(), "jig-desktop-repro-repository-"),
    );
    const remote = await mkdtemp(
      join(tmpdir(), "jig-desktop-repro-remote-"),
    );
    roots.push(repository, remote);

    await git(repository, ["init"]);
    await git(repository, ["config", "user.name", "Jig Test"]);
    await git(repository, ["config", "user.email", "jig-test@local.invalid"]);
    await writeFile(
      join(repository, "user-content.txt"),
      "personal branch remains unrelated\n",
      "utf8",
    );
    await git(repository, ["add", "user-content.txt"]);
    await git(repository, ["commit", "-m", "User branch baseline"]);

    await git(remote, ["init", "--bare"]);
    await git(repository, ["remote", "add", "origin", remote]);

    const adapter = { repository_path: repository } as const;
    await ensurePortableData(adapter, DATASET_ID);
    const initial = await readCurrentPortableSnapshot(
      adapter,
      DATASET_ID,
    );
    if (initial === null) {
      throw new Error("expected initialized Jig portable snapshot");
    }

    await mkdir(join(repository, ".jig", "local"), {
      recursive: true,
    });
    db = await initializeDatabase(
      join(repository, ".jig", "local", "jig.sqlite"),
      DATASET_ID,
    );
    await markExported(db, 0, initial.head);

    const firstController = createSyncController(
      db,
      { repository_path: repository },
    );
    expect(await firstController.trigger()).toMatchObject({
      local_git: "committed",
      remote: { state: "synchronized" },
    });
    expect(firstController.diagnostics()).toMatchObject({
      phase: "idle",
      reason: null,
      retryable: null,
      attempt_count: 0,
    });

    const created = await applyTaskCommand(
      db,
      {
        type: "create",
        title: "Desktop local change",
        scheduled_date: "2026-11-22",
      },
      0,
      "2026-11-22",
      "2026-11-22T11:00:00.000Z",
      () => LOCAL_TASK_ID,
    );
    expect(created.revision).toBe(1);

    expect(await firstController.trigger()).toMatchObject({
      local_git: "committed",
      remote: { state: "synchronized" },
    });
    const localAfterPush = await readCurrentPortableSnapshot(
      adapter,
      DATASET_ID,
    );
    if (localAfterPush === null) {
      throw new Error("expected local Jig head after push");
    }
    expect(
      await git(remote, [
        "show-ref",
        "--verify",
        "--hash",
        "refs/heads/jig-data",
      ]),
    ).toBe(localAfterPush.head);
    firstController.stop();

    const restartedController = createSyncController(
      db,
      { repository_path: repository },
    );
    expect(await restartedController.trigger()).toMatchObject({
      local_git: "committed",
      remote: { state: "synchronized" },
    });

    const writer = await mkdtemp(
      join(tmpdir(), "jig-desktop-repro-writer-"),
    );
    roots.push(writer);
    await git(tmpdir(), [
      "clone",
      "--branch",
      "jig-data",
      remote,
      writer,
    ]);
    await git(writer, ["config", "user.name", "Jig Test"]);
    await git(writer, ["config", "user.email", "jig-test@local.invalid"]);

    const localState = await readCanonicalState(db);
    const remoteSnapshot = serializeSnapshot(
      [...localState.tasks, remoteTask(localState.tasks.length)],
      DATASET_ID,
    );
    await writeSnapshotFiles(writer, remoteSnapshot.files);
    await git(writer, ["add", "-A"]);
    await git(writer, ["commit", "-m", "Remote fast-forward"]);
    await git(writer, ["push", "origin", "jig-data"]);

    expect(await restartedController.trigger()).toMatchObject({
      local_git: "committed",
      remote: { state: "synchronized" },
    });
    expect(
      (await readCanonicalState(db)).tasks.map((task) => task.title),
    ).toEqual([
      "Desktop local change",
      "Remote fast-forward",
    ]);
    expect(await readMetadata(db)).toMatchObject({
      pending_sync: false,
    });
    expect(restartedController.diagnostics()).toMatchObject({
      phase: "idle",
      reason: null,
      retryable: null,
      attempt_count: 0,
    });
    restartedController.stop();
  });
});
