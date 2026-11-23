import { describe, expect, it } from "vitest";
import {
  add,
  checkout,
  commit,
  init,
  readCommit,
  writeCommit,
  writeRef,
} from "isomorphic-git";
import type { CanonicalState } from "../../src/protocol/runtime";
import { serializeSnapshot } from "../../src/core/portable";
import { recoveryCommitSpec } from "../../src/core/synchronization-recovery";
import type { Task } from "../../src/core/task";
import {
  androidPortableHead,
  androidRecoveryCandidateParents,
  androidRecoveryCommitterTimestampSeconds,
  commitAndroidPortableSnapshot,
  compareAndSetAndroidPortableHead,
  deleteAndroidRecoveryCandidate,
  readAndroidPortableSnapshot,
  readAndroidRecoveryCandidateHead,
  readAndroidSnapshotAtOid,
  reopenAndroidPortableRepository,
  uniqueAndroidRecoveryMergeBase,
  writeAndroidRecoveryCandidate,
  cloneAndroidPortableRepository,
  type AndroidGitEffects,
} from "../../ui/src/native/git";
import {
  createAndroidGitFilesystem,
} from "../../ui/src/native/git-filesystem";
import type { IsomorphicGitHttpClient } from "../../ui/src/native/git-http";
import { fakeFilesystem } from "./fake-filesystem";

const DATASET_ID =
  "018f47f0-7b5c-7d4d-8e2b-9c3aa11f3001";
const WORKTREE = "repository/.jig/git";
const IDENTITY = {
  name: "Jig",
  email: "jig@local.invalid",
};

function noNetwork(): IsomorphicGitHttpClient {
  return {
    async request() {
      throw new Error("Network must not be used by local Git proof");
    },
  };
}

async function createLocalEffects(): Promise<{
  readonly effects: AndroidGitEffects;
  readonly port: ReturnType<typeof fakeFilesystem>["port"];
}> {
  const { port } = fakeFilesystem();
  const fs = createAndroidGitFilesystem(port);

  await fs.promises.mkdir("repository");
  await fs.promises.mkdir("repository/.jig");
  await fs.promises.mkdir(WORKTREE);
  await init({
    fs,
    dir: WORKTREE,
    defaultBranch: "jig-data",
  });

  const initial = serializeSnapshot([], DATASET_ID);
  const format = initial.files.get("format.json");
  if (format === undefined) {
    throw new Error("Initial portable snapshot missing format.json");
  }
  await fs.promises.writeFile(
    `${WORKTREE}/format.json`,
    format,
    "utf8",
  );
  await add({
    fs,
    dir: WORKTREE,
    filepath: "format.json",
  });
  await commit({
    fs,
    dir: WORKTREE,
    message: "Initialize Jig data",
    author: IDENTITY,
    committer: IDENTITY,
  });

  return {
    port,
    effects: {
      fs,
      http: noNetwork(),
      dir: WORKTREE,
    },
  };
}

function canonicalTask(): Task {
  return {
    id: "018f47f0-7b5c-7d4d-8e2b-9c3aa11f3002",
    title: "Native Git integration",
    scheduled_date: "2026-11-18",
    position: 0,
    priority: "NORMAL",
    context: "Android",
    reference: null,
    note: "Portable through isomorphic-git",
    reminder_time: "09:15",
    recurrence_series_id: null,
    recurrence_occurrence_date: null,
    completed_at: null,
    created_at: "2026-11-18T01:00:00.000Z",
    updated_at: "2026-11-18T01:00:00.000Z",
  };
}

describe("Android isomorphic-git integration", () => {
  it("commits and reopens the same portable snapshot through the Capacitor filesystem adapter", async () => {
    const { effects, port } = await createLocalEffects();

    const initial = await readAndroidPortableSnapshot(
      effects,
      DATASET_ID,
    );
    expect(initial).toMatchObject({
      dataset_id: DATASET_ID,
      tasks: [],
      recurrences: [],
    });

    const state: CanonicalState = {
      revision: 1,
      tasks: [canonicalTask()],
      recurrences: [],
    };
    const firstHead = await commitAndroidPortableSnapshot(
      effects,
      serializeSnapshot(
        state.tasks,
        DATASET_ID,
        state.recurrences,
      ),
      state.revision,
    );

    const afterCommit = await readAndroidPortableSnapshot(
      effects,
      DATASET_ID,
    );
    expect(afterCommit.tasks).toStrictEqual(state.tasks);
    expect(afterCommit.recurrences).toStrictEqual([]);

    const restarted: AndroidGitEffects = {
      fs: createAndroidGitFilesystem(port),
      http: noNetwork(),
      dir: WORKTREE,
    };
    const reopened = await reopenAndroidPortableRepository(
      restarted,
      DATASET_ID,
    );
    expect(reopened.tasks).toStrictEqual(state.tasks);

    const unchangedHead = await commitAndroidPortableSnapshot(
      restarted,
      serializeSnapshot(
        state.tasks,
        DATASET_ID,
        state.recurrences,
      ),
      state.revision,
    );
    expect(unchangedHead).toBe(firstHead);
  });

  it("constructs and accepts a deterministic isolated Android recovery candidate", async () => {
    const { effects } = await createLocalEffects();
    const base = await androidPortableHead(effects);
    const baseCommit = await readCommit({
      fs: effects.fs,
      dir: effects.dir,
      oid: base,
    });
    const parent = (
      message: string,
      timestamp: number,
    ): Promise<string> =>
      writeCommit({
        fs: effects.fs,
        dir: effects.dir,
        commit: {
          message: `${message}\n`,
          tree: baseCommit.commit.tree,
          parent: [base],
          author: {
            ...IDENTITY,
            timestamp,
            timezoneOffset: 0,
          },
          committer: {
            ...IDENTITY,
            timestamp,
            timezoneOffset: 0,
          },
        },
      });
    const local = await parent("Local parent", 1_700_000_010);
    const remote = await parent("Remote parent", 1_700_000_020);
    await writeRef({
      fs: effects.fs,
      dir: effects.dir,
      ref: "refs/heads/jig-data",
      value: local,
      force: true,
    });
    await checkout({
      fs: effects.fs,
      dir: effects.dir,
      ref: "jig-data",
      force: true,
    });

    expect(
      await uniqueAndroidRecoveryMergeBase(
        effects,
        local,
        remote,
      ),
    ).toBe(base);
    const localTimestamp =
      await androidRecoveryCommitterTimestampSeconds(
        effects,
        local,
      );
    const remoteTimestamp =
      await androidRecoveryCommitterTimestampSeconds(
        effects,
        remote,
      );
    const snapshot = serializeSnapshot(
      [canonicalTask()],
      DATASET_ID,
    );
    const spec = recoveryCommitSpec(
      "automatic",
      local,
      localTimestamp,
      remote,
      remoteTimestamp,
    );
    const candidate = await writeAndroidRecoveryCandidate(
      effects,
      DATASET_ID,
      snapshot,
      spec,
    );

    expect(
      await readAndroidRecoveryCandidateHead(
        effects,
        DATASET_ID,
      ),
    ).toBe(candidate);
    expect(
      await androidRecoveryCandidateParents(
        effects,
        candidate,
      ),
    ).toEqual(spec.parents);
    expect(
      await readAndroidSnapshotAtOid(
        effects,
        candidate,
        DATASET_ID,
      ),
    ).toMatchObject({
      dataset_id: DATASET_ID,
      tasks: [{ id: canonicalTask().id }],
    });
    const candidateCommit = await readCommit({
      fs: effects.fs,
      dir: effects.dir,
      oid: candidate,
    });
    expect(candidateCommit.commit).toMatchObject({
      message: "Reconcile Jig data\n",
      parent: spec.parents,
      author: {
        name: "Jig",
        email: "jig@local.invalid",
        timestamp: 1_700_000_021,
        timezoneOffset: 0,
      },
      committer: {
        name: "Jig",
        email: "jig@local.invalid",
        timestamp: 1_700_000_021,
        timezoneOffset: 0,
      },
    });
    expect(
      await writeAndroidRecoveryCandidate(
        effects,
        DATASET_ID,
        snapshot,
        spec,
      ),
    ).toBe(candidate);

    await compareAndSetAndroidPortableHead(
      effects,
      local,
      candidate,
    );
    expect(await androidPortableHead(effects)).toBe(candidate);
    expect(
      (await readAndroidPortableSnapshot(effects, DATASET_ID))
        .tasks[0]?.id,
    ).toBe(canonicalTask().id);
    await deleteAndroidRecoveryCandidate(
      effects,
      DATASET_ID,
      candidate,
    );
    expect(
      await readAndroidRecoveryCandidateHead(
        effects,
        DATASET_ID,
      ),
    ).toBeNull();
  });

  it("refuses a jig-data branch containing any tracked non-Jig path", async () => {
    const { effects } = await createLocalEffects();

    await effects.fs.promises.writeFile(
      `${WORKTREE}/README.md`,
      "not portable Jig data\n",
      "utf8",
    );
    await add({
      fs: effects.fs,
      dir: WORKTREE,
      filepath: "README.md",
    });
    await commit({
      fs: effects.fs,
      dir: WORKTREE,
      message: "Pollute portable branch",
      author: IDENTITY,
      committer: IDENTITY,
    });

    await expect(
      readAndroidPortableSnapshot(effects, DATASET_ID),
    ).rejects.toThrow(/non-Jig path README\.md/);
  });

  it("rejects credential-bearing or non-HTTPS remote URLs before native network I/O", async () => {
    const { effects } = await createLocalEffects();
    let credentialReads = 0;
    const credential = async (): Promise<string> => {
      credentialReads += 1;
      return "secret";
    };

    await expect(
      cloneAndroidPortableRepository(
        effects,
        "https://token@example.invalid/private.git",
        credential,
      ),
    ).rejects.toThrow(/must not contain credentials/);
    await expect(
      cloneAndroidPortableRepository(
        effects,
        "ssh://git@example.invalid/private.git",
        credential,
      ),
    ).rejects.toThrow(/must use HTTPS/);
    expect(credentialReads).toBe(0);
  });
});
