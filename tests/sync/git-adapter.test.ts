import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { Task } from "../../src/core/task";
import {
  ensureJigLocalExclude,
  ensurePortableData,
  GitAdapterError,
  inspectSynchronizationAuthority,
  inspectSynchronizationRemote,
  observePortableRemote,
  pushPortableDataRef,
  readCurrentPortableSnapshot,
  repositorySynchronizationMode,
  runGit,
  sanitizeSynchronizationRemoteLocation,
  serializeSnapshot,
  writePortableSnapshot,
} from "../../src/shell/git";
const DATA_REF = "refs/heads/jig-data";

const DATASET_ID = "018f47f0-7b5c-7d4d-8e2b-9c3aa11f0001";
const roots: string[] = [];

async function git(repo: string, args: readonly string[]): Promise<string> {
  const result = await runGit(repo, args);
  if (result.exit_code !== 0) {
    throw new Error(result.stderr || result.stdout);
  }
  return result.stdout;
}

async function fixture(): Promise<string> {
  const repo = await mkdtemp(join(tmpdir(), "jig-git-"));
  roots.push(repo);
  await git(repo, ["init"]);
  await git(repo, ["config", "user.name", "Jig Test"]);
  await git(repo, ["config", "user.email", "jig-test@local.invalid"]);
  await writeFile(join(repo, "document.txt"), "original\n", "utf8");
  await git(repo, ["add", "document.txt"]);
  await git(repo, ["commit", "-m", "Initial user content"]);
  return repo;
}

async function writeSnapshotFiles(
  directory: string,
  snapshot: ReturnType<typeof serializeSnapshot>,
): Promise<void> {
  for (const [path, value] of snapshot.files) {
    const absolute = join(directory, path);
    await mkdir(dirname(absolute), { recursive: true });
    await writeFile(absolute, value, "utf8");
  }
}

async function remoteFixture(
  sourceRepository: string,
): Promise<string> {
  const remote = await mkdtemp(join(tmpdir(), "jig-remote-"));
  roots.push(remote);
  await git(remote, ["init", "--bare"]);
  await git(sourceRepository, ["remote", "add", "origin", remote]);
  await git(sourceRepository, [
    "push",
    "origin",
    "refs/heads/jig-data:refs/heads/jig-data",
  ]);
  return remote;
}

async function cloneDataBranch(
  remote: string,
  label: string,
): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), `jig-${label}-`));
  roots.push(root);
  await rm(root, { recursive: true, force: true });
  await git(tmpdir(), [
    "clone",
    "--branch",
    "jig-data",
    remote,
    root,
  ]);
  await git(root, ["config", "user.name", "Jig Test"]);
  await git(root, [
    "config",
    "user.email",
    "jig-test@local.invalid",
  ]);
  return root;
}

function task(): Task {
  return {
    id: "018f47f0-7b5c-7d4d-8e2b-9c3aa11f0101",
    title: "Jig-only task",
    scheduled_date: "2026-11-16",
    position: 0,
    priority: "NORMAL",
    context: null,
    reference: null,
    note: null,
    reminder_time: null,
    recurrence_series_id: null,
    recurrence_occurrence_date: null,
    completed_at: null,
    created_at: "2026-11-16T01:00:00.000Z",
    updated_at: "2026-11-16T01:00:00.000Z",
  };
}

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) =>
      rm(root, { recursive: true, force: true }),
    ),
  );
});

describe("isolated jig-data adapter", () => {
  it("bounds a hung remote Git subprocess instead of occupying synchronization indefinitely", async () => {
    const repo = await fixture();
    const result = await runGit(
      repo,
      [
        "-c",
        "alias.jig-hang=!sleep 5",
        "jig-hang",
      ],
      undefined,
      {},
      10,
    );

    expect(result.exit_code).not.toBe(0);
    expect(result.stderr).toBe("Git operation timed out");
  });

  it("leaves unrelated staged and unstaged user state unchanged", async () => {
    const repo = await fixture();
    await ensureJigLocalExclude(repo);

    await writeFile(join(repo, "document.txt"), "staged\n", "utf8");
    await git(repo, ["add", "document.txt"]);
    await writeFile(join(repo, "document.txt"), "working\n", "utf8");
    await writeFile(join(repo, "untracked.txt"), "mine\n", "utf8");
    const before = await git(repo, ["status", "--porcelain=v1"]);

    const config = {
      repository_path: repo,
    } as const;

    await ensurePortableData(config, DATASET_ID);
    const snapshot = serializeSnapshot([task()], DATASET_ID);
    const head = await writePortableSnapshot(config, snapshot, 1);

    expect(head).toMatch(/^[0-9a-f]{40}$/);
    expect(await git(repo, ["status", "--porcelain=v1"])).toBe(before);
    expect(
      await readCurrentPortableSnapshot(config, DATASET_ID),
    ).toMatchObject({
      snapshot: {
        dataset_id: DATASET_ID,
        tasks: [task()],
      },
    });
  });

  it("refuses an existing incompatible jig-data ref", async () => {
    const repo = await fixture();
    await ensureJigLocalExclude(repo);

    const emptyTree = await git(repo, ["mktree"]);
    const badCommitResult = await runGit(
      repo,
      ["commit-tree", emptyTree, "-m", "Unrelated branch"],
      undefined,
      {
        GIT_AUTHOR_NAME: "Test",
        GIT_AUTHOR_EMAIL: "test@local.invalid",
        GIT_COMMITTER_NAME: "Test",
        GIT_COMMITTER_EMAIL: "test@local.invalid",
      },
    );
    expect(badCommitResult.exit_code).toBe(0);
    await git(repo, ["update-ref", DATA_REF, badCommitResult.stdout]);

    const config = {
      repository_path: repo,
    } as const;

    await expect(
      ensurePortableData(config, DATASET_ID),
    ).rejects.toThrow(GitAdapterError);
  });

  it("creates Jig synchronization commits without inheriting user commit signing policy", async () => {
    const repo = await fixture();
    await ensureJigLocalExclude(repo);
    await git(repo, ["config", "commit.gpgSign", "true"]);
    await git(repo, ["config", "user.signingkey", "missing-jig-test-key"]);

    const config = {
      repository_path: repo,
    } as const;

    await ensurePortableData(config, DATASET_ID);
    const head = await writePortableSnapshot(
      config,
      serializeSnapshot([task()], DATASET_ID),
      1,
    );

    expect(head).toMatch(/^[0-9a-f]{40}$/);
    expect(await git(repo, ["config", "--get", "commit.gpgSign"])).toBe(
      "true",
    );
    expect(await git(repo, ["config", "--get", "user.signingkey"])).toBe(
      "missing-jig-test-key",
    );
  });

  it("recovers only the exact v1.0.0 empty bootstrap residue into a valid snapshot", async () => {
    const repo = await fixture();
    await ensureJigLocalExclude(repo);

    const emptyTree = await git(repo, ["mktree"]);
    const legacy = await runGit(
      repo,
      ["commit-tree", emptyTree, "-m", "Initialize Jig data"],
      undefined,
      {
        GIT_AUTHOR_NAME: "Jig",
        GIT_AUTHOR_EMAIL: "jig@local.invalid",
        GIT_COMMITTER_NAME: "Jig",
        GIT_COMMITTER_EMAIL: "jig@local.invalid",
      },
    );
    expect(legacy.exit_code).toBe(0);
    await git(repo, ["update-ref", DATA_REF, legacy.stdout]);

    const config = {
      repository_path: repo,
    } as const;

    await ensurePortableData(config, DATASET_ID);

    const current = await readCurrentPortableSnapshot(config, DATASET_ID);
    expect(current?.snapshot.dataset_id).toBe(DATASET_ID);
    expect(current?.snapshot.tasks).toStrictEqual([]);
    expect(await git(repo, ["rev-parse", `${DATA_REF}^`])).toBe(
      legacy.stdout,
    );
  });

  it("defers remote selection to Git configuration instead of assuming origin", async () => {
    const repo = await fixture();
    await git(repo, ["remote", "add", "primary", "/tmp/jig-primary.git"]);
    await git(repo, ["remote", "add", "backup", "/tmp/jig-backup.git"]);

    const config = { repository_path: repo } as const;
    expect(await repositorySynchronizationMode(config)).toBe(
      "ambiguous",
    );

    await git(repo, ["config", "remote.pushDefault", "backup"]);
    expect(await repositorySynchronizationMode(config)).toBe(
      "remote",
    );
  });

  it("refuses multiple effective push destinations instead of partially synchronizing", async () => {
    const repo = await fixture();
    await git(repo, [
      "remote",
      "add",
      "origin",
      "https://example.invalid/team/jig-data.git",
    ]);
    await git(repo, [
      "remote",
      "set-url",
      "--add",
      "--push",
      "origin",
      "https://backup.invalid/team/jig-data.git",
    ]);
    await git(repo, [
      "remote",
      "set-url",
      "--add",
      "--push",
      "origin",
      "https://example.invalid/team/jig-data.git",
    ]);

    await expect(
      inspectSynchronizationAuthority({
        repository_path: repo,
      }),
    ).resolves.toStrictEqual({ state: "ambiguous" });
    expect(
      await repositorySynchronizationMode({
        repository_path: repo,
      }),
    ).toBe("ambiguous");
  });

  it("reports the selected synchronization remote without exposing credentials", async () => {
    const repo = await fixture();
    await git(repo, [
      "remote",
      "add",
      "origin",
      "https://user:secret@example.com/team/planning.git?token=hidden#fragment",
    ]);

    await expect(
      inspectSynchronizationRemote({ repository_path: repo }),
    ).resolves.toStrictEqual({
      name: "origin",
      location: "https://example.com/team/planning.git",
    });

    expect(
      sanitizeSynchronizationRemoteLocation(
        "git@github.com:pontivus-com/private-planning.git",
      ),
    ).toBe("github.com:pontivus-com/private-planning.git");
    expect(
      sanitizeSynchronizationRemoteLocation(
        "ssh://git:secret@github.com/pontivus-com/private-planning.git?token=hidden#fragment",
      ),
    ).toBe("ssh://github.com/pontivus-com/private-planning.git");
  });

  it("observes and validates a remote-only fast-forward before local mutation", async () => {
    const repo = await fixture();
    const config = { repository_path: repo } as const;
    await ensurePortableData(config, DATASET_ID);
    await writePortableSnapshot(
      config,
      serializeSnapshot([], DATASET_ID),
      0,
    );
    const remote = await remoteFixture(repo);
    const writer = await cloneDataBranch(remote, "writer");
    const remoteTask = task();
    await writeSnapshotFiles(
      writer,
      serializeSnapshot([remoteTask], DATASET_ID),
    );
    await git(writer, ["add", "-A"]);
    await git(writer, ["commit", "-m", "Remote Jig update"]);
    await git(writer, ["push", "origin", "jig-data"]);
    const remoteHead = await git(writer, ["rev-parse", "HEAD"]);

    const before = await git(repo, ["rev-parse", DATA_REF]);
    const observed = await observePortableRemote(
      config,
      DATASET_ID,
      null,
    );

    expect(observed).toMatchObject({
      state: "present",
      local_head: before,
      remote_head: remoteHead,
      remote_rewritten: false,
      lineage: "remote-ahead",
    });
    if (observed.state !== "present") {
      throw new Error("expected present remote observation");
    }
    expect(observed.remote_snapshot.tasks).toStrictEqual([
      remoteTask,
    ]);
    expect(await git(repo, ["rev-parse", DATA_REF])).toBe(before);
  });

  it("retains Git-owned remote-head evidence when the remote branch is deleted or rewritten", async () => {
    const repo = await fixture();
    const config = { repository_path: repo } as const;
    await ensurePortableData(config, DATASET_ID);
    await writePortableSnapshot(
      config,
      serializeSnapshot([], DATASET_ID),
      0,
    );
    const remote = await remoteFixture(repo);

    const first = await observePortableRemote(
      config,
      DATASET_ID,
      null,
    );
    if (first.state !== "present") {
      throw new Error("expected initial remote observation");
    }
    const firstHead = first.remote_head;

    await git(repo, ["push", "origin", "--delete", "jig-data"]);
    const deleted = await observePortableRemote(
      config,
      DATASET_ID,
      firstHead,
    );
    expect(deleted).toMatchObject({
      state: "absent",
      previously_synchronized: true,
    });

    const seed = await mkdtemp(join(tmpdir(), "jig-rewrite-seed-"));
    roots.push(seed);
    await git(seed, ["init", "-b", "jig-data"]);
    await git(seed, ["config", "user.name", "Jig Test"]);
    await git(seed, ["config", "user.email", "jig-test@local.invalid"]);
    await writeSnapshotFiles(
      seed,
      serializeSnapshot([task()], DATASET_ID),
    );
    await git(seed, ["add", "-A"]);
    await git(seed, ["commit", "-m", "Replacement history"]);
    await git(seed, ["remote", "add", "origin", remote]);
    await git(seed, ["push", "origin", "jig-data"]);
    const replacementHead = await git(seed, ["rev-parse", "HEAD"]);

    const rewritten = await observePortableRemote(
      config,
      DATASET_ID,
      firstHead,
    );
    expect(rewritten).toMatchObject({
      state: "present",
      remote_head: replacementHead,
      remote_rewritten: true,
    });

    const repeated = await observePortableRemote(
      config,
      DATASET_ID,
      firstHead,
    );
    expect(repeated).toMatchObject({
      state: "present",
      remote_head: replacementHead,
      remote_rewritten: true,
    });
  });

  it("classifies a different portable dataset as unsafe without replacing local identity", async () => {
    const repo = await fixture();
    const config = { repository_path: repo } as const;
    await ensurePortableData(config, DATASET_ID);
    await writePortableSnapshot(
      config,
      serializeSnapshot([], DATASET_ID),
      0,
    );
    const remote = await remoteFixture(repo);
    const writer = await cloneDataBranch(
      remote,
      "different-dataset",
    );
    await writeSnapshotFiles(
      writer,
      serializeSnapshot(
        [],
        "018f47f0-7b5c-7d4d-8e2b-9c3aa11f9999",
      ),
    );
    await git(writer, ["add", "-A"]);
    await git(writer, [
      "commit",
      "-m",
      "Different Jig dataset",
    ]);
    await git(writer, ["push", "origin", "jig-data"]);

    await expect(
      observePortableRemote(
        config,
        DATASET_ID,
        null,
      ),
    ).resolves.toMatchObject({ state: "unsafe" });

    expect(
      (await readCurrentPortableSnapshot(config, DATASET_ID))
        ?.snapshot.dataset_id,
    ).toBe(DATASET_ID);
  });

  it("rejects non-canonical paths on the portable branch before adoption", async () => {
    const repo = await fixture();
    const config = { repository_path: repo } as const;
    await ensurePortableData(config, DATASET_ID);
    await writePortableSnapshot(
      config,
      serializeSnapshot([], DATASET_ID),
      0,
    );
    const remote = await remoteFixture(repo);
    const writer = await cloneDataBranch(remote, "invalid-tree");
    await writeFile(
      join(writer, "unexpected.txt"),
      "not Jig portable data\n",
      "utf8",
    );
    await git(writer, ["add", "unexpected.txt"]);
    await git(writer, ["commit", "-m", "Invalid portable tree"]);
    await git(writer, ["push", "origin", "jig-data"]);

    await expect(
      observePortableRemote(
        config,
        DATASET_ID,
        null,
      ),
    ).resolves.toMatchObject({ state: "unsafe" });
  });

  it("rejects symlink entries on jig-data before adoption", async () => {
    const repo = await fixture();
    const config = { repository_path: repo } as const;
    await ensurePortableData(config, DATASET_ID);
    await writePortableSnapshot(
      config,
      serializeSnapshot([], DATASET_ID),
      0,
    );
    const remote = await remoteFixture(repo);
    const writer = await cloneDataBranch(remote, "symlink-tree");
    const symlinkPath =
      "tasks/018f47f0-7b5c-7d4d-8e2b-9c3aa11f0771.json";
    await mkdir(join(writer, "tasks"), { recursive: true });
    await symlink("../format.json", join(writer, symlinkPath));
    await git(writer, ["add", symlinkPath]);
    await git(writer, ["commit", "-m", "Add invalid symlink"]);
    await git(writer, ["push", "origin", "jig-data"]);

    await expect(
      observePortableRemote(
        config,
        DATASET_ID,
        null,
      ),
    ).resolves.toMatchObject({ state: "unsafe" });
  });

  it("rejects submodule entries on jig-data before adoption", async () => {
    const repo = await fixture();
    const config = { repository_path: repo } as const;
    await ensurePortableData(config, DATASET_ID);
    await writePortableSnapshot(
      config,
      serializeSnapshot([], DATASET_ID),
      0,
    );
    const remote = await remoteFixture(repo);
    const writer = await cloneDataBranch(remote, "submodule-tree");
    const other = await fixture();
    await git(writer, [
      "-c",
      "protocol.file.allow=always",
      "submodule",
      "add",
      other,
      "tasks/018f47f0-7b5c-7d4d-8e2b-9c3aa11f0772.json",
    ]);
    await git(writer, ["commit", "-m", "Add invalid submodule"]);
    await git(writer, ["push", "origin", "jig-data"]);

    await expect(
      observePortableRemote(
        config,
        DATASET_ID,
        null,
      ),
    ).resolves.toMatchObject({ state: "unsafe" });
  });

  it("publishes a missing remote jig-data branch using an ordinary push", async () => {
    const repo = await fixture();
    const remote = await mkdtemp(join(tmpdir(), "jig-empty-remote-"));
    roots.push(remote);
    await git(remote, ["init", "--bare"]);
    await git(repo, ["remote", "add", "origin", remote]);
    const config = { repository_path: repo } as const;
    await ensurePortableData(config, DATASET_ID);
    await writePortableSnapshot(
      config,
      serializeSnapshot([task()], DATASET_ID),
      1,
    );

    const observed = await observePortableRemote(
      config,
      DATASET_ID,
      null,
    );
    expect(observed).toMatchObject({
      state: "absent",
      previously_synchronized: false,
    });
    await expect(
      pushPortableDataRef(
        config,
        {
          name: "origin",
          location: remote,
        },
      ),
    ).resolves.toStrictEqual({
      status: "synchronized",
      retryable: false,
    });
    expect(
      await git(remote, [
        "show-ref",
        "--verify",
        "--hash",
        "refs/heads/jig-data",
      ]),
    ).toMatch(/^[0-9a-f]{40}$/);
  });

  it("kills a hung Git subprocess when its shell deadline expires", async () => {
    const repo = await fixture();
    const result = await runGit(
      repo,
      [
        "-c",
        "alias.jig-slow=!sleep 5",
        "jig-slow",
      ],
      undefined,
      {},
      20,
    );

    expect(result.exit_code).not.toBe(0);
    expect(result.stderr).toBe("Git operation timed out");
  });

  it("uses the Git common dir for local exclusion from linked worktrees", async () => {
    const repo = await fixture();
    const linked = join(repo, "..", `${repo.split("/").at(-1)}-linked`);
    roots.push(linked);
    await git(repo, ["worktree", "add", linked, "-b", "linked-test"]);

    const excludePath = await ensureJigLocalExclude(linked);
    expect(await readFile(excludePath, "utf8")).toContain("/.jig/");
    await mkdir(join(linked, ".jig"), { recursive: true });
    expect(await git(linked, ["status", "--porcelain=v1"])).toBe("");
  });
});
