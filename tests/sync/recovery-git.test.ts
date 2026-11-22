import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { serializeSnapshot } from "../../src/core/portable";
import { validateTask } from "../../src/core/task";
import { recoveryCommitSpec } from "../../src/core/synchronization-recovery";
import {
  ensurePortableData,
  readCurrentPortableSnapshot,
  readSnapshotAtRef,
  DATA_REF,
} from "../../src/shell/git/portable-store";
import { requireGit, runGit } from "../../src/shell/git/process";
import {
  compareAndSetPortableHead,
  deleteRecoveryCandidate,
  readRecoveryCandidateHead,
  recoveryCandidateParents,
  recoveryCommitterTimestampSeconds,
  uniqueRecoveryMergeBase,
  writeRecoveryCandidate,
} from "../../src/shell/git/recovery";

const DATASET_ID = "018f47f0-7b5c-7d4d-8e2b-000000008001";
const TASK_ID = "018f47f0-7b5c-7d4d-8e2b-000000008002";
const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) =>
      rm(root, { recursive: true, force: true }),
    ),
  );
});

async function repository(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "jig-recovery-git-"));
  roots.push(root);
  const initialized = await runGit(root, ["init"]);
  if (initialized.exit_code !== 0) {
    throw new Error(initialized.stderr || initialized.stdout);
  }
  return root;
}

async function childCommit(
  root: string,
  tree: string,
  parent: string | null,
  message: string,
  timestamp: number,
): Promise<string> {
  return requireGit(
    root,
    [
      "-c",
      "commit.gpgSign=false",
      "commit-tree",
      tree,
      ...(parent === null ? [] : ["-p", parent]),
      "-m",
      message,
    ],
    undefined,
    {
      GIT_AUTHOR_NAME: "Test",
      GIT_AUTHOR_EMAIL: "test@local.invalid",
      GIT_COMMITTER_NAME: "Test",
      GIT_COMMITTER_EMAIL: "test@local.invalid",
      GIT_AUTHOR_DATE: `${timestamp} +0000`,
      GIT_COMMITTER_DATE: `${timestamp} +0000`,
    },
  );
}

describe("Linux recovery-only Git effects", () => {
  it("constructs one deterministic isolated candidate and advances jig-data only by CAS", async () => {
    const root = await repository();
    const config = { repository_path: root } as const;
    await ensurePortableData(config, DATASET_ID);
    const base = await readCurrentPortableSnapshot(config, DATASET_ID);
    if (base === null) throw new Error("expected initial portable head");
    const tree = await requireGit(root, [
      "show",
      "-s",
      "--format=%T",
      base.head,
    ]);
    const local = await childCommit(
      root,
      tree,
      base.head,
      "Local parent",
      1_700_000_010,
    );
    const remote = await childCommit(
      root,
      tree,
      base.head,
      "Remote parent",
      1_700_000_020,
    );
    await requireGit(root, [
      "update-ref",
      DATA_REF,
      local,
      base.head,
    ]);

    expect(
      await uniqueRecoveryMergeBase(config, local, remote),
    ).toBe(base.head);
    const localTimestamp =
      await recoveryCommitterTimestampSeconds(config, local);
    const remoteTimestamp =
      await recoveryCommitterTimestampSeconds(config, remote);
    expect(localTimestamp).toBe(1_700_000_010);
    expect(remoteTimestamp).toBe(1_700_000_020);

    const snapshot = serializeSnapshot([
      validateTask({
        id: TASK_ID,
        title: "Recovered",
        scheduled_date: "2026-11-22",
        position: 0,
        priority: "NORMAL",
        context: null,
        reference: null,
        note: null,
        reminder_time: null,
        recurrence_series_id: null,
        recurrence_occurrence_date: null,
        completed_at: null,
        created_at: "2026-11-22T00:00:00.000Z",
        updated_at: "2026-11-22T00:00:00.000Z",
      }),
    ], DATASET_ID);
    const spec = recoveryCommitSpec(
      "automatic",
      local,
      localTimestamp,
      remote,
      remoteTimestamp,
    );
    const candidate = await writeRecoveryCandidate(
      config,
      DATASET_ID,
      snapshot,
      spec,
    );

    expect(await readRecoveryCandidateHead(config, DATASET_ID)).toBe(
      candidate,
    );
    expect(await recoveryCandidateParents(config, candidate)).toEqual(
      spec.parents,
    );
    expect(
      await requireGit(root, ["show-ref", "--verify", "--hash", DATA_REF]),
    ).toBe(local);
    expect(
      await readSnapshotAtRef(root, candidate, DATASET_ID),
    ).toMatchObject({
      dataset_id: DATASET_ID,
      tasks: [{ id: TASK_ID, title: "Recovered" }],
    });
    expect(
      await requireGit(root, [
        "show",
        "-s",
        "--format=%an|%ae|%ct|%P|%s",
        candidate,
      ]),
    ).toBe(
      [
        "Jig",
        "jig@local.invalid",
        "1700000021",
        spec.parents.join(" "),
        "Reconcile Jig data",
      ].join("|"),
    );

    expect(
      await writeRecoveryCandidate(
        config,
        DATASET_ID,
        snapshot,
        spec,
      ),
    ).toBe(candidate);

    await compareAndSetPortableHead(config, local, candidate);
    expect(
      await requireGit(root, ["show-ref", "--verify", "--hash", DATA_REF]),
    ).toBe(candidate);
    await deleteRecoveryCandidate(config, DATASET_ID, candidate);
    expect(await readRecoveryCandidateHead(config, DATASET_ID)).toBeNull();
  });

  it("returns no merge base for unrelated histories and refuses a stale local-ref CAS", async () => {
    const root = await repository();
    const config = { repository_path: root } as const;
    await ensurePortableData(config, DATASET_ID);
    const base = await readCurrentPortableSnapshot(config, DATASET_ID);
    if (base === null) throw new Error("expected initial portable head");
    const tree = await requireGit(root, [
      "show",
      "-s",
      "--format=%T",
      base.head,
    ]);
    const local = await childCommit(
      root,
      tree,
      base.head,
      "Local",
      1_700_000_030,
    );
    const unrelated = await childCommit(
      root,
      tree,
      null,
      "Unrelated",
      1_700_000_040,
    );
    await requireGit(root, [
      "update-ref",
      DATA_REF,
      local,
      base.head,
    ]);

    expect(
      await uniqueRecoveryMergeBase(config, local, unrelated),
    ).toBeNull();
    await expect(
      compareAndSetPortableHead(config, base.head, unrelated),
    ).rejects.toThrow(/changed concurrently/i);
    expect(
      await requireGit(root, ["show-ref", "--verify", "--hash", DATA_REF]),
    ).toBe(local);
  });
});
