import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { serializeSnapshot } from "../../src/core/portable";
import { validateTask } from "../../src/core/task";
import {
  applyTaskCommand,
  markExported,
  readCanonicalState,
  type JigSqlConnection,
} from "../../src/persistence/sqlite";
import {
  deriveJigDataDateOrders,
  jigDataConflictKey,
} from "../../src/core/synchronization-recovery";
import { exportCanonicalPortableSnapshot } from "../../src/persistence/synchronization";
import {
  ensurePortableData,
  readCurrentPortableSnapshot,
  writePortableSnapshot,
} from "../../src/shell/git/portable-store";
import { readRecoveryCandidateHead } from "../../src/shell/git/recovery";
import { runGit } from "../../src/shell/git/process";
import { createSyncController } from "../../src/shell/sync";
import { initializeDatabase } from "../../src/shell/sqlite-bun";

const DATASET_ID =
  "018f47f0-7b5c-7d4d-8e2b-9c3aa11f0011";
const LOCAL_TASK_ID =
  "018f47f0-7b5c-7d4d-8e2b-000000008101";
const REMOTE_TASK_ID =
  "018f47f0-7b5c-7d4d-8e2b-000000008102";

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

describe("Desktop related-divergence recovery", () => {
  it("reconciles two valid sibling Jig snapshots without touching the user branch", async () => {
    const repository = await mkdtemp(
      join(tmpdir(), "jig-recovery-repository-"),
    );
    const remote = await mkdtemp(
      join(tmpdir(), "jig-recovery-remote-"),
    );
    roots.push(repository, remote);

    await git(repository, ["init"]);
    await git(repository, ["config", "user.name", "Jig Test"]);
    await git(repository, ["config", "user.email", "jig-test@local.invalid"]);
    await writeFile(
      join(repository, "user-content.txt"),
      "unrelated user content\n",
      "utf8",
    );
    await git(repository, ["add", "user-content.txt"]);
    await git(repository, ["commit", "-m", "User branch baseline"]);
    const userHead = await git(repository, ["rev-parse", "HEAD"]);

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

    const publisher = createSyncController(
      db,
      { repository_path: repository },
    );
    expect(await publisher.trigger()).toMatchObject({
      local_git: "committed",
      remote: { state: "synchronized" },
    });
    publisher.stop();

    const created = await applyTaskCommand(
      db,
      {
        type: "create",
        title: "Local sibling change",
        scheduled_date: "2026-11-22",
      },
      0,
      "2026-11-22",
      "2026-11-22T12:00:00.000Z",
      () => LOCAL_TASK_ID,
    );
    expect(created.revision).toBe(1);
    const localHead = await exportCanonicalPortableSnapshot(
      db,
      (snapshot, revision) =>
        writePortableSnapshot(adapter, snapshot, revision),
    );

    const writer = await mkdtemp(
      join(tmpdir(), "jig-recovery-writer-"),
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
    const remoteSnapshot = serializeSnapshot([
      validateTask({
        id: REMOTE_TASK_ID,
        title: "Remote sibling change",
        scheduled_date: "2026-11-23",
        position: 0,
        priority: "NORMAL",
        context: null,
        reference: null,
        note: null,
        reminder_time: null,
        recurrence_series_id: null,
        recurrence_occurrence_date: null,
        completed_at: null,
        created_at: "2026-11-22T12:10:00.000Z",
        updated_at: "2026-11-22T12:10:00.000Z",
      }),
    ], DATASET_ID);
    await writeSnapshotFiles(writer, remoteSnapshot.files);
    await git(writer, ["add", "-A"]);
    await git(writer, ["commit", "-m", "Remote sibling change"]);
    await git(writer, ["push", "origin", "jig-data"]);
    const remoteHeadBeforeRecovery = await git(writer, [
      "rev-parse",
      "HEAD",
    ]);
    expect(remoteHeadBeforeRecovery).not.toBe(localHead);

    const controller = createSyncController(
      db,
      { repository_path: repository },
    );
    expect(await controller.trigger()).toMatchObject({
      local_git: "committed",
      remote: { state: "synchronized" },
    });
    expect(controller.diagnostics()).toMatchObject({
      phase: "idle",
      reason: null,
      retryable: null,
      recovery_attempted: true,
      recovery_outcome: "accepted",
    });

    expect(
      (await readCanonicalState(db)).tasks.map((task) => task.title),
    ).toEqual([
      "Local sibling change",
      "Remote sibling change",
    ]);
    const recovered = await readCurrentPortableSnapshot(
      adapter,
      DATASET_ID,
    );
    if (recovered === null) {
      throw new Error("expected recovered Jig portable snapshot");
    }
    expect(recovered.head).not.toBe(localHead);
    expect(recovered.head).not.toBe(remoteHeadBeforeRecovery);
    expect(
      await git(remote, [
        "show-ref",
        "--verify",
        "--hash",
        "refs/heads/jig-data",
      ]),
    ).toBe(recovered.head);
    expect(
      await readRecoveryCandidateHead(adapter, DATASET_ID),
    ).toBeNull();

    expect(await git(repository, ["rev-parse", "HEAD"])).toBe(userHead);
    expect(
      await readFile(join(repository, "user-content.txt"), "utf8"),
    ).toBe("unrelated user content\n");
    controller.stop();
  });

  it("exposes and resolves an eligible Desktop semantic conflict through the shared policy", async () => {
    const repository = await mkdtemp(
      join(tmpdir(), "jig-conflict-repository-"),
    );
    const remote = await mkdtemp(
      join(tmpdir(), "jig-conflict-remote-"),
    );
    roots.push(repository, remote);

    await git(repository, ["init"]);
    await git(repository, ["config", "user.name", "Jig Test"]);
    await git(repository, ["config", "user.email", "jig-test@local.invalid"]);
    await writeFile(
      join(repository, "user-content.txt"),
      "unrelated user content\n",
      "utf8",
    );
    await git(repository, ["add", "user-content.txt"]);
    await git(repository, ["commit", "-m", "User branch baseline"]);
    const userHead = await git(repository, ["rev-parse", "HEAD"]);

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

    const controller = createSyncController(
      db,
      { repository_path: repository },
    );
    expect(await controller.trigger()).toMatchObject({
      remote: { state: "synchronized" },
    });

    const sharedTaskId =
      "018f47f0-7b5c-7d4d-8e2b-000000008103";
    await applyTaskCommand(
      db,
      {
        type: "create",
        title: "Shared base",
        scheduled_date: "2026-11-22",
      },
      0,
      "2026-11-22",
      "2026-11-22T13:00:00.000Z",
      () => sharedTaskId,
    );
    await exportCanonicalPortableSnapshot(
      db,
      (snapshot, revision) =>
        writePortableSnapshot(adapter, snapshot, revision),
    );
    expect(await controller.trigger()).toMatchObject({
      remote: { state: "synchronized" },
    });

    const writer = await mkdtemp(
      join(tmpdir(), "jig-conflict-writer-"),
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

    const baseState = await readCanonicalState(db);
    await applyTaskCommand(
      db,
      {
        type: "edit",
        task_id: sharedTaskId,
        changes: { title: "Local conflict" },
      },
      baseState.revision,
      "2026-11-22",
      "2026-11-22T13:01:00.000Z",
    );
    await exportCanonicalPortableSnapshot(
      db,
      (snapshot, revision) =>
        writePortableSnapshot(adapter, snapshot, revision),
    );

    const baseTask = baseState.tasks[0];
    if (baseTask === undefined) {
      throw new Error("expected shared base Task");
    }
    const remoteSnapshot = serializeSnapshot([
      validateTask({
        ...baseTask,
        title: "Remote conflict",
        updated_at: "2026-11-22T13:02:00.000Z",
      }),
    ], DATASET_ID);
    await writeSnapshotFiles(writer, remoteSnapshot.files);
    await git(writer, ["add", "-A"]);
    await git(writer, ["commit", "-m", "Remote conflicting change"]);
    await git(writer, ["push", "origin", "jig-data"]);

    expect(await controller.trigger()).toMatchObject({
      local_git: "committed",
      remote: { state: "sync-issue" },
    });
    const conflictCase = controller.readSynchronizationConflict();
    if (conflictCase === null) {
      throw new Error("expected eligible Desktop synchronization conflict");
    }
    expect(controller.diagnostics()).toMatchObject({
      phase: "resolve-conflict",
      reason: "semantic-conflict",
    });
    const conflict = conflictCase.conflicts[0];
    if (conflict === undefined) {
      throw new Error("expected one Desktop synchronization conflict");
    }
    const staleChoices = [{
      conflict_key: jigDataConflictKey(conflict),
      side: "local" as const,
    }];
    const staleDateOrders = deriveJigDataDateOrders(
      conflictCase,
      staleChoices,
    );
    if (staleDateOrders === null) {
      throw new Error("expected Desktop conflict date-order review");
    }

    const newerRemoteSnapshot = serializeSnapshot([
      validateTask({
        ...baseTask,
        title: "Remote conflict newer",
        updated_at: "2026-11-22T13:03:00.000Z",
      }),
    ], DATASET_ID);
    await writeSnapshotFiles(writer, newerRemoteSnapshot.files);
    await git(writer, ["add", "-A"]);
    await git(writer, ["commit", "-m", "Remote conflict advanced"]);
    await git(writer, ["push", "origin", "jig-data"]);
    const advancedRemoteHead = (
      await git(writer, ["rev-parse", "HEAD"])
    ).trim();

    expect(
      await controller.resolveSynchronizationConflict({
        ancestor_head: conflictCase.ancestor_head,
        local_head: conflictCase.local_head,
        remote_head: conflictCase.remote_head,
        expected_revision: conflictCase.expected_revision,
        choices: staleChoices,
        date_orders: staleDateOrders,
      }),
    ).toMatchObject({
      local_git: "committed",
      remote: { state: "sync-issue" },
    });
    expect((await readCanonicalState(db)).tasks[0]).toMatchObject({
      id: sharedTaskId,
      title: "Local conflict",
    });
    expect(
      (
        await git(remote, [
          "show-ref",
          "--verify",
          "--hash",
          "refs/heads/jig-data",
        ])
      ).trim(),
    ).toBe(advancedRemoteHead);
    expect(
      await readRecoveryCandidateHead(adapter, DATASET_ID),
    ).toBeNull();

    const freshCase = controller.readSynchronizationConflict();
    if (freshCase === null) {
      throw new Error("expected refreshed Desktop synchronization conflict");
    }
    expect(freshCase.remote_head).toBe(advancedRemoteHead);
    expect(freshCase.remote_head).not.toBe(conflictCase.remote_head);
    const freshConflict = freshCase.conflicts[0];
    if (freshConflict === undefined) {
      throw new Error("expected refreshed Desktop conflict");
    }
    const choices = [{
      conflict_key: jigDataConflictKey(freshConflict),
      side: "local" as const,
    }];
    const dateOrders = deriveJigDataDateOrders(
      freshCase,
      choices,
    );
    if (dateOrders === null) {
      throw new Error("expected refreshed Desktop date-order review");
    }

    expect(
      await controller.resolveSynchronizationConflict({
        ancestor_head: freshCase.ancestor_head,
        local_head: freshCase.local_head,
        remote_head: freshCase.remote_head,
        expected_revision: freshCase.expected_revision,
        choices,
        date_orders: dateOrders,
      }),
    ).toMatchObject({
      local_git: "committed",
      remote: { state: "synchronized" },
    });
    expect(controller.readSynchronizationConflict()).toBeNull();
    expect(controller.diagnostics()).toMatchObject({
      phase: "idle",
      reason: null,
      recovery_attempted: true,
      recovery_outcome: "accepted",
    });
    expect((await readCanonicalState(db)).tasks[0]).toMatchObject({
      id: sharedTaskId,
      title: "Local conflict",
    });

    const resolvedRemote = await git(remote, [
      "show",
      "-s",
      "--format=%s%n%P",
      "jig-data",
    ]);
    const [message, parents] = resolvedRemote.trim().split("\n");
    expect(message).toBe("Resolve Jig sync conflict");
    expect(parents?.trim().split(/\s+/)).toHaveLength(2);
    expect(
      await readRecoveryCandidateHead(adapter, DATASET_ID),
    ).toBeNull();

    expect(await git(repository, ["rev-parse", "HEAD"])).toBe(userHead);
    expect(
      await readFile(join(repository, "user-content.txt"), "utf8"),
    ).toBe("unrelated user content\n");
    controller.stop();
  });
});
