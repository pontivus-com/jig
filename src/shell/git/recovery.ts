import type { PortableSnapshot } from "../../core/portable";
import {
  recoveryPrivateRef,
  type RecoveryCommitSpec,
} from "../../core/synchronization-recovery";
import { GitAdapterError, requireGit, runGit } from "./process";
import {
  assertAdapterPaths,
  type GitAdapterConfig,
} from "./repository";
import {
  DATA_REF,
  resetPortableDataWorktree,
} from "./portable-store";

const OBJECT_ID_PATTERN = /^[0-9a-f]{40}$/;
const ZERO_OBJECT_ID = "0".repeat(40);

function validateObjectId(value: string, field: string): string {
  if (!OBJECT_ID_PATTERN.test(value)) {
    throw new GitAdapterError(
      `${field} must be a 40-character lowercase Git object id`,
    );
  }
  return value;
}

async function optionalRefHead(
  repositoryPath: string,
  ref: string,
): Promise<string | null> {
  const result = await runGit(repositoryPath, [
    "show-ref",
    "--verify",
    "--hash",
    ref,
  ]);
  if (result.exit_code !== 0 || result.stdout.length === 0) {
    return null;
  }
  return validateObjectId(result.stdout, ref);
}

export async function readRecoveryCandidateHead(
  config: GitAdapterConfig,
  datasetId: string,
): Promise<string | null> {
  assertAdapterPaths(config);
  return optionalRefHead(
    config.repository_path,
    recoveryPrivateRef(datasetId),
  );
}

export async function uniqueRecoveryMergeBase(
  config: GitAdapterConfig,
  localHead: string,
  remoteHead: string,
): Promise<string | null> {
  assertAdapterPaths(config);
  validateObjectId(localHead, "localHead");
  validateObjectId(remoteHead, "remoteHead");
  const result = await runGit(config.repository_path, [
    "merge-base",
    "--all",
    localHead,
    remoteHead,
  ]);
  if (result.exit_code !== 0) return null;
  const heads = result.stdout.split("\n").filter(Boolean);
  if (heads.length !== 1) return null;
  const head = heads[0];
  return head === undefined
    ? null
    : validateObjectId(head, "merge base");
}

export async function recoveryCommitterTimestampSeconds(
  config: GitAdapterConfig,
  head: string,
): Promise<number> {
  assertAdapterPaths(config);
  validateObjectId(head, "head");
  const value = await requireGit(config.repository_path, [
    "show",
    "-s",
    "--format=%ct",
    head,
  ]);
  const timestamp = Number(value);
  if (
    !Number.isInteger(timestamp) ||
    timestamp < 0 ||
    String(timestamp) !== value
  ) {
    throw new GitAdapterError(
      "Git commit has an invalid committer timestamp",
    );
  }
  return timestamp;
}

function assertCanonicalSnapshotPaths(snapshot: PortableSnapshot): void {
  if (!snapshot.files.has("format.json")) {
    throw new GitAdapterError(
      "Recovery snapshot is missing canonical format.json",
    );
  }
  for (const path of snapshot.files.keys()) {
    if (
      path !== "format.json" &&
      !/^tasks\/[0-9a-f-]+\.json$/i.test(path) &&
      !/^recurrences\/[0-9a-f-]+\.json$/i.test(path)
    ) {
      throw new GitAdapterError(
        `Recovery snapshot contains non-canonical path ${path}`,
      );
    }
  }
}

async function writeBlob(
  repositoryPath: string,
  content: string,
): Promise<string> {
  const oid = await requireGit(
    repositoryPath,
    ["hash-object", "-w", "--stdin"],
    content,
  );
  return validateObjectId(oid, "blob");
}

async function writeSubtree(
  repositoryPath: string,
  entries: readonly {
    readonly name: string;
    readonly oid: string;
  }[],
): Promise<string | null> {
  if (entries.length === 0) return null;
  const input = [...entries]
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((entry) => {
      if (
        entry.name.length === 0 ||
        entry.name.includes("/") ||
        entry.name.includes("\t") ||
        entry.name.includes("\n")
      ) {
        throw new GitAdapterError(
          "Recovery snapshot contains an invalid tree entry name",
        );
      }
      return `100644 blob ${validateObjectId(entry.oid, "blob")}\t${entry.name}\n`;
    })
    .join("");
  const tree = await requireGit(
    repositoryPath,
    ["mktree"],
    input,
  );
  return validateObjectId(tree, "tree");
}

async function writeSnapshotTree(
  repositoryPath: string,
  snapshot: PortableSnapshot,
): Promise<string> {
  assertCanonicalSnapshotPaths(snapshot);
  const format = snapshot.files.get("format.json");
  if (format === undefined) {
    throw new GitAdapterError(
      "Recovery snapshot is missing canonical format.json",
    );
  }
  const formatBlob = await writeBlob(repositoryPath, format);
  const tasks: {
    readonly name: string;
    readonly oid: string;
  }[] = [];
  const recurrences: {
    readonly name: string;
    readonly oid: string;
  }[] = [];

  for (const [path, value] of snapshot.files) {
    if (path === "format.json") continue;
    const slash = path.indexOf("/");
    if (slash <= 0 || slash === path.length - 1) {
      throw new GitAdapterError(
        `Recovery snapshot contains malformed path ${path}`,
      );
    }
    const directory = path.slice(0, slash);
    const name = path.slice(slash + 1);
    const entry = {
      name,
      oid: await writeBlob(repositoryPath, value),
    };
    if (directory === "tasks") {
      tasks.push(entry);
    } else if (directory === "recurrences") {
      recurrences.push(entry);
    } else {
      throw new GitAdapterError(
        `Recovery snapshot contains unsupported directory ${directory}`,
      );
    }
  }

  const tasksTree = await writeSubtree(repositoryPath, tasks);
  const recurrencesTree = await writeSubtree(
    repositoryPath,
    recurrences,
  );
  const rootEntries = [
    `100644 blob ${formatBlob}\tformat.json\n`,
    ...(tasksTree === null
      ? []
      : [`040000 tree ${tasksTree}\ttasks\n`]),
    ...(recurrencesTree === null
      ? []
      : [`040000 tree ${recurrencesTree}\trecurrences\n`]),
  ].join("");
  const root = await requireGit(
    repositoryPath,
    ["mktree"],
    rootEntries,
  );
  return validateObjectId(root, "tree");
}

export async function writeRecoveryCandidate(
  config: GitAdapterConfig,
  datasetId: string,
  snapshot: PortableSnapshot,
  spec: RecoveryCommitSpec,
): Promise<string> {
  assertAdapterPaths(config);
  if (snapshot.dataset_id !== datasetId) {
    throw new GitAdapterError(
      "Recovery snapshot dataset does not match the configured dataset",
    );
  }
  const [firstParent, secondParent] = spec.parents;
  validateObjectId(firstParent, "first recovery parent");
  validateObjectId(secondParent, "second recovery parent");
  const tree = await writeSnapshotTree(
    config.repository_path,
    snapshot,
  );
  const commit = await requireGit(
    config.repository_path,
    [
      "-c",
      "commit.gpgSign=false",
      "commit-tree",
      tree,
      "-p",
      firstParent,
      "-p",
      secondParent,
      "-F",
      "-",
    ],
    `${spec.message}\n`,
    {
      GIT_AUTHOR_NAME: spec.name,
      GIT_AUTHOR_EMAIL: spec.email,
      GIT_COMMITTER_NAME: spec.name,
      GIT_COMMITTER_EMAIL: spec.email,
      GIT_AUTHOR_DATE:
        `${spec.timestamp_seconds} +0000`,
      GIT_COMMITTER_DATE:
        `${spec.timestamp_seconds} +0000`,
    },
  );
  const candidate = validateObjectId(commit, "recovery candidate");
  const privateRef = recoveryPrivateRef(datasetId);
  const current = await optionalRefHead(
    config.repository_path,
    privateRef,
  );
  if (current === candidate) return candidate;
  if (current !== null) {
    throw new GitAdapterError(
      "Recovery private ref already points to another candidate",
    );
  }
  const updated = await runGit(config.repository_path, [
    "update-ref",
    privateRef,
    candidate,
    ZERO_OBJECT_ID,
  ]);
  if (updated.exit_code !== 0) {
    throw new GitAdapterError(
      "Recovery private ref changed concurrently",
    );
  }
  return candidate;
}

export async function recoveryCandidateParents(
  config: GitAdapterConfig,
  candidateHead: string,
): Promise<readonly [string, string]> {
  assertAdapterPaths(config);
  validateObjectId(candidateHead, "candidateHead");
  const value = await requireGit(config.repository_path, [
    "show",
    "-s",
    "--format=%P",
    candidateHead,
  ]);
  const parents = value.split(/\s+/).filter(Boolean);
  if (parents.length !== 2) {
    throw new GitAdapterError(
      "Recovery candidate must have exactly two parents",
    );
  }
  const first = parents[0];
  const second = parents[1];
  if (first === undefined || second === undefined) {
    throw new GitAdapterError(
      "Recovery candidate parent evidence is incomplete",
    );
  }
  return [
    validateObjectId(first, "first recovery parent"),
    validateObjectId(second, "second recovery parent"),
  ];
}

export async function deleteRecoveryCandidate(
  config: GitAdapterConfig,
  datasetId: string,
  expectedCandidate: string,
): Promise<void> {
  assertAdapterPaths(config);
  validateObjectId(expectedCandidate, "expectedCandidate");
  const result = await runGit(config.repository_path, [
    "update-ref",
    "-d",
    recoveryPrivateRef(datasetId),
    expectedCandidate,
  ]);
  if (result.exit_code !== 0) {
    throw new GitAdapterError(
      "Recovery private ref changed concurrently",
    );
  }
}

export async function compareAndSetPortableHead(
  config: GitAdapterConfig,
  expectedLocalHead: string,
  candidateHead: string,
): Promise<void> {
  assertAdapterPaths(config);
  validateObjectId(expectedLocalHead, "expectedLocalHead");
  validateObjectId(candidateHead, "candidateHead");
  const result = await runGit(config.repository_path, [
    "update-ref",
    DATA_REF,
    candidateHead,
    expectedLocalHead,
  ]);
  if (result.exit_code !== 0) {
    throw new GitAdapterError(
      "Jig data ref changed concurrently",
    );
  }
  await resetPortableDataWorktree(config);
}
