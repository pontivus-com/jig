import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { Task } from "../../src/core/task";
import {
  ensureJigLocalExclude,
  ensurePortableData,
  GitAdapterError,
  inspectSynchronizationRemote,
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
