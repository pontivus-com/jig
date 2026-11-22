import "./buffer-polyfill";
import {
  add,
  addRemote,
  checkout,
  clone,
  commit,
  currentBranch,
  deleteRef,
  fetch,
  findMergeBase,
  getConfig,
  init,
  isDescendent,
  listFiles,
  merge,
  listServerRefs,
  push,
  readBlob,
  readCommit,
  readTree,
  remove,
  resolveRef,
  statusMatrix,
  writeBlob,
  writeCommit,
  writeRef,
  writeTree,
} from "isomorphic-git";
import {
  serializeSnapshot,
  SnapshotDatasetMismatchError,
  validateSnapshot,
  type PortableSnapshot,
} from "../../../src/core/portable";
import type {
  SynchronizationLineage,
  SynchronizationUnsafeReason,
} from "../../../src/core/synchronization";
import {
  recoveryPrivateRef,
  type RecoveryCommitSpec,
} from "../../../src/core/synchronization-recovery";
import {
  AndroidFsError,
  createAndroidGitFilesystem,
  type IsomorphicGitPromiseFs,
} from "./git-filesystem";
import {
  createAndroidGitHttpClient,
  type IsomorphicGitHttpClient,
} from "./git-http";
import { bytesToBase64 } from "./binary";
import { ANDROID_GIT_WORKTREE } from "./paths";

export const ANDROID_DATA_BRANCH = "jig-data";
const ANDROID_REMOTE = "origin";

export interface GitCredentialProvider {
  (): Promise<string>;
  readonly onAuthFailure?: () => void | Promise<void>;
  readonly onAuthSuccess?: () => void | Promise<void>;
}

export interface AndroidGitEffects {
  readonly fs: IsomorphicGitPromiseFs;
  readonly http: IsomorphicGitHttpClient;
  readonly dir: string;
}

export class AndroidGitAdapterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AndroidGitAdapterError";
  }
}

function isPortablePath(path: string): boolean {
  return (
    path === "format.json" ||
    /^tasks\/[0-9a-f-]+\.json$/i.test(path) ||
    /^recurrences\/[0-9a-f-]+\.json$/i.test(path)
  );
}

function assertCredentialFreeHttpsRemote(remoteUrl: string): void {
  let parsed: URL;
  try {
    parsed = new URL(remoteUrl);
  } catch {
    throw new AndroidGitAdapterError(
      "Android Git remote must be a valid HTTPS URL",
    );
  }
  if (parsed.protocol !== "https:") {
    throw new AndroidGitAdapterError(
      "Android Git remote must use HTTPS",
    );
  }
  if (parsed.username.length > 0 || parsed.password.length > 0) {
    throw new AndroidGitAdapterError(
      "Android Git remote URL must not contain credentials",
    );
  }
}

function authenticationCallbacks(
  provider: GitCredentialProvider,
) {
  return {
    onAuth: async (): Promise<
      Readonly<{ username: string; password: string }>
    > => {
      const token = (await provider()).trim();
      if (token.length === 0) {
        throw new AndroidGitAdapterError(
          "Android Git credential provider returned an empty token",
        );
      }
      return { username: "x-access-token", password: token };
    },
    onAuthFailure: async (): Promise<void> => {
      await provider.onAuthFailure?.();
    },
    onAuthSuccess: async (): Promise<void> => {
      await provider.onAuthSuccess?.();
    },
  };
}

async function authenticatedHeaders(
  provider: GitCredentialProvider,
): Promise<Readonly<Record<string, string>>> {
  const token = (await provider()).trim();
  if (token.length === 0) {
    throw new AndroidGitAdapterError(
      "Android Git credential provider returned an empty token",
    );
  }
  return {
    Authorization: `Basic ${bytesToBase64(
      new TextEncoder().encode(`x-access-token:${token}`),
    )}`,
  };
}

async function ensureDirectory(
  fs: IsomorphicGitPromiseFs,
  path: string,
): Promise<void> {
  try {
    await fs.promises.mkdir(path);
  } catch (error) {
    if (
      error instanceof AndroidFsError &&
      error.code === "EEXIST"
    ) {
      return;
    }
    throw error;
  }
}

async function ensureWorktreeParents(
  effects: AndroidGitEffects,
): Promise<void> {
  await ensureDirectory(effects.fs, "repository");
  await ensureDirectory(effects.fs, "repository/.jig");
}

async function pathExists(
  effects: AndroidGitEffects,
  path: string,
): Promise<boolean> {
  try {
    await effects.fs.promises.stat(path);
    return true;
  } catch (error) {
    if (
      error instanceof AndroidFsError &&
      error.code === "ENOENT"
    ) {
      return false;
    }
    throw error;
  }
}

export async function removeAndroidManagedCheckout(
  effects: AndroidGitEffects,
): Promise<void> {
  try {
    await effects.fs.promises.rmdir(
      effects.dir,
      { recursive: true },
    );
  } catch (error) {
    if (
      !(error instanceof AndroidFsError) ||
      error.code !== "ENOENT"
    ) {
      throw error;
    }
  }
}

async function assertDataBranch(
  effects: AndroidGitEffects,
): Promise<void> {
  const branch = await currentBranch({
    fs: effects.fs,
    dir: effects.dir,
    fullname: false,
  });
  if (branch !== ANDROID_DATA_BRANCH) {
    throw new AndroidGitAdapterError(
      `Android Git worktree must be on ${ANDROID_DATA_BRANCH}; found ${branch ?? "detached HEAD"}`,
    );
  }
}

async function trackedPortablePaths(
  effects: AndroidGitEffects,
): Promise<readonly string[]> {
  const tracked = await listFiles({
    fs: effects.fs,
    dir: effects.dir,
    ref: "HEAD",
  });
  for (const path of tracked) {
    if (!isPortablePath(path)) {
      throw new AndroidGitAdapterError(
        `Refusing Android jig-data repository containing non-Jig path ${path}`,
      );
    }
  }
  return tracked;
}

async function readUtf8(
  effects: AndroidGitEffects,
  relativePath: string,
): Promise<string> {
  const value = await effects.fs.promises.readFile(
    `${effects.dir}/${relativePath}`,
    "utf8",
  );
  if (typeof value !== "string") {
    throw new AndroidGitAdapterError(
      `Portable path ${relativePath} was not readable using UTF-8`,
    );
  }
  return value;
}

export function createAndroidGitEffects(): AndroidGitEffects {
  return {
    fs: createAndroidGitFilesystem(),
    http: createAndroidGitHttpClient(),
    dir: ANDROID_GIT_WORKTREE,
  };
}

export async function acquireAndroidPortableRepository(
  effects: AndroidGitEffects,
  remoteUrl: string,
  credential: GitCredentialProvider,
  createDatasetId: () => string = () => crypto.randomUUID(),
): Promise<PortableSnapshot> {
  assertCredentialFreeHttpsRemote(remoteUrl);
  if (await pathExists(effects, effects.dir)) {
    throw new AndroidGitAdapterError(
      "Android managed repository checkout already exists",
    );
  }

  const headers = await authenticatedHeaders(credential);
  const refs = await listServerRefs({
    http: effects.http,
    url: remoteUrl,
    forPush: false,
    headers,
    ...authenticationCallbacks(credential),
  });
  const hasDataBranch = refs.some(
    (candidate) =>
      candidate.ref === `refs/heads/${ANDROID_DATA_BRANCH}`,
  );

  if (hasDataBranch) {
    try {
      return await cloneAndroidPortableRepository(
        effects,
        remoteUrl,
        credential,
      );
    } catch (error) {
      await removeAndroidManagedCheckout(effects);
      throw error;
    }
  }

  try {
    await ensureWorktreeParents(effects);
    await init({
      fs: effects.fs,
      dir: effects.dir,
      defaultBranch: ANDROID_DATA_BRANCH,
    });
    await addRemote({
      fs: effects.fs,
      dir: effects.dir,
      remote: ANDROID_REMOTE,
      url: remoteUrl,
      force: false,
    });

    const snapshot = serializeSnapshot(
      [],
      createDatasetId(),
      [],
    );
    await writeAndroidPortableFiles(effects, snapshot);
    const paths = [...snapshot.files.keys()].sort(
      (left, right) => left.localeCompare(right),
    );
    await add({
      fs: effects.fs,
      dir: effects.dir,
      filepath: paths,
    });
    const identity = {
      name: "Jig",
      email: "jig@local.invalid",
    };
    await commit({
      fs: effects.fs,
      dir: effects.dir,
      message: "Initialize Jig portable data",
      author: identity,
      committer: identity,
      disallowEmpty: true,
    });
    await pushAndroidPortableRepository(
      effects,
      credential,
    );
    return snapshot;
  } catch (error) {
    await removeAndroidManagedCheckout(effects);
    throw error;
  }
}

export async function cloneAndroidPortableRepository(
  effects: AndroidGitEffects,
  remoteUrl: string,
  credential: GitCredentialProvider,
): Promise<PortableSnapshot> {
  assertCredentialFreeHttpsRemote(remoteUrl);
  await ensureWorktreeParents(effects);
  const headers = await authenticatedHeaders(credential);

  await clone({
    fs: effects.fs,
    http: effects.http,
    dir: effects.dir,
    url: remoteUrl,
    ref: ANDROID_DATA_BRANCH,
    remote: ANDROID_REMOTE,
    singleBranch: true,
    noTags: true,
    headers,
    ...authenticationCallbacks(credential),
  });

  await assertDataBranch(effects);
  return readAndroidPortableSnapshot(effects);
}

export async function androidPortableHead(
  effects: AndroidGitEffects,
): Promise<string> {
  await assertDataBranch(effects);
  return resolveRef({
    fs: effects.fs,
    dir: effects.dir,
    ref: "HEAD",
  });
}

export async function reopenAndroidPortableRepository(
  effects: AndroidGitEffects,
  expectedDatasetId?: string,
): Promise<PortableSnapshot> {
  await assertDataBranch(effects);
  return readAndroidPortableSnapshot(
    effects,
    expectedDatasetId,
  );
}

export async function fetchAndroidPortableRepository(
  effects: AndroidGitEffects,
  credential: GitCredentialProvider,
): Promise<string> {
  await assertDataBranch(effects);
  const headers = await authenticatedHeaders(credential);
  await fetch({
    fs: effects.fs,
    http: effects.http,
    dir: effects.dir,
    remote: ANDROID_REMOTE,
    ref: ANDROID_DATA_BRANCH,
    singleBranch: true,
    tags: false,
    headers,
    ...authenticationCallbacks(credential),
  });
  return resolveRef({
    fs: effects.fs,
    dir: effects.dir,
    ref: `refs/remotes/${ANDROID_REMOTE}/${ANDROID_DATA_BRANCH}`,
  });
}

export async function readAndroidSnapshotAtOid(
  effects: AndroidGitEffects,
  oid: string,
  expectedDatasetId: string,
): Promise<PortableSnapshot> {
  const files = new Map<string, string>();
  const decode = new TextDecoder("utf-8", { fatal: true });

  const visit = async (
    treeOid: string,
    prefix: string,
  ): Promise<void> => {
    const tree = await readTree({
      fs: effects.fs,
      dir: effects.dir,
      oid: treeOid,
    });

    for (const entry of tree.tree) {
      const path =
        prefix.length === 0
          ? entry.path
          : `${prefix}/${entry.path}`;
      if (entry.type === "tree") {
        if (path !== "tasks" && path !== "recurrences") {
          throw new AndroidGitAdapterError(
            `Refusing non-Jig directory ${path} on jig-data`,
          );
        }
        await visit(entry.oid, path);
        continue;
      }
      if (
        entry.type !== "blob" ||
        entry.mode !== "100644" ||
        !isPortablePath(path)
      ) {
        throw new AndroidGitAdapterError(
          `Refusing non-canonical jig-data tree entry ${path}`,
        );
      }

      const blob = await readBlob({
        fs: effects.fs,
        dir: effects.dir,
        oid: entry.oid,
      });
      files.set(path, decode.decode(blob.blob));
    }
  };

  await visit(oid, "");
  return validateSnapshot(files, expectedDatasetId);
}

async function optionalAndroidRef(
  effects: AndroidGitEffects,
  ref: string,
): Promise<string | null> {
  try {
    return await resolveRef({
      fs: effects.fs,
      dir: effects.dir,
      ref,
    });
  } catch {
    return null;
  }
}

const ANDROID_OBJECT_ID_PATTERN = /^[0-9a-f]{40}$/;

function validateAndroidObjectId(
  value: string,
  field: string,
): string {
  if (!ANDROID_OBJECT_ID_PATTERN.test(value)) {
    throw new AndroidGitAdapterError(
      `${field} must be a 40-character lowercase Git object id`,
    );
  }
  return value;
}

export async function readAndroidRecoveryCandidateHead(
  effects: AndroidGitEffects,
  datasetId: string,
): Promise<string | null> {
  return optionalAndroidRef(effects, recoveryPrivateRef(datasetId));
}

export async function uniqueAndroidRecoveryMergeBase(
  effects: AndroidGitEffects,
  localHead: string,
  remoteHead: string,
): Promise<string | null> {
  validateAndroidObjectId(localHead, "localHead");
  validateAndroidObjectId(remoteHead, "remoteHead");
  const bases = await findMergeBase({
    fs: effects.fs,
    dir: effects.dir,
    oids: [localHead, remoteHead],
  });
  if (bases.length !== 1) return null;
  const base = bases[0];
  return base === undefined
    ? null
    : validateAndroidObjectId(base, "merge base");
}

export async function androidRecoveryCommitterTimestampSeconds(
  effects: AndroidGitEffects,
  head: string,
): Promise<number> {
  validateAndroidObjectId(head, "head");
  const value = await readCommit({
    fs: effects.fs,
    dir: effects.dir,
    oid: head,
  });
  const timestamp = value.commit.committer.timestamp;
  if (!Number.isInteger(timestamp) || timestamp < 0) {
    throw new AndroidGitAdapterError(
      "Android Git commit has an invalid committer timestamp",
    );
  }
  return timestamp;
}

function assertAndroidRecoverySnapshotPaths(
  snapshot: PortableSnapshot,
): void {
  if (!snapshot.files.has("format.json")) {
    throw new AndroidGitAdapterError(
      "Recovery snapshot is missing canonical format.json",
    );
  }
  for (const path of snapshot.files.keys()) {
    if (
      path !== "format.json" &&
      !/^tasks\/[0-9a-f-]+\.json$/i.test(path) &&
      !/^recurrences\/[0-9a-f-]+\.json$/i.test(path)
    ) {
      throw new AndroidGitAdapterError(
        `Recovery snapshot contains non-canonical path ${path}`,
      );
    }
  }
}

async function writeAndroidRecoveryTree(
  effects: AndroidGitEffects,
  snapshot: PortableSnapshot,
): Promise<string> {
  assertAndroidRecoverySnapshotPaths(snapshot);
  const encoder = new TextEncoder();
  const directories = new Map<
    "tasks" | "recurrences",
    { readonly path: string; readonly oid: string }[]
  >([
    ["tasks", []],
    ["recurrences", []],
  ]);
  const format = snapshot.files.get("format.json");
  if (format === undefined) {
    throw new AndroidGitAdapterError(
      "Recovery snapshot is missing canonical format.json",
    );
  }
  const formatOid = await writeBlob({
    fs: effects.fs,
    dir: effects.dir,
    blob: encoder.encode(format),
  });

  for (const [path, value] of snapshot.files) {
    if (path === "format.json") continue;
    const slash = path.indexOf("/");
    if (slash <= 0 || slash === path.length - 1) {
      throw new AndroidGitAdapterError(
        `Recovery snapshot contains malformed path ${path}`,
      );
    }
    const directory = path.slice(0, slash);
    const name = path.slice(slash + 1);
    if (
      (directory !== "tasks" && directory !== "recurrences") ||
      name.includes("/") ||
      name.includes("\n") ||
      name.includes("\t")
    ) {
      throw new AndroidGitAdapterError(
        `Recovery snapshot contains invalid path ${path}`,
      );
    }
    const oid = await writeBlob({
      fs: effects.fs,
      dir: effects.dir,
      blob: encoder.encode(value),
    });
    directories.get(directory)?.push({ path: name, oid });
  }

  const rootEntries: {
    readonly mode: string;
    readonly path: string;
    readonly oid: string;
    readonly type: "blob" | "tree";
  }[] = [
    {
      mode: "100644",
      path: "format.json",
      oid: formatOid,
      type: "blob",
    },
  ];
  for (const directory of ["tasks", "recurrences"] as const) {
    const entries = directories.get(directory) ?? [];
    if (entries.length === 0) continue;
    const treeOid = await writeTree({
      fs: effects.fs,
      dir: effects.dir,
      tree: [...entries]
        .sort((left, right) => left.path.localeCompare(right.path))
        .map((entry) => ({
          mode: "100644",
          path: entry.path,
          oid: entry.oid,
          type: "blob" as const,
        })),
    });
    rootEntries.push({
      mode: "040000",
      path: directory,
      oid: treeOid,
      type: "tree",
    });
  }
  return writeTree({
    fs: effects.fs,
    dir: effects.dir,
    tree: rootEntries,
  });
}

export async function writeAndroidRecoveryCandidate(
  effects: AndroidGitEffects,
  datasetId: string,
  snapshot: PortableSnapshot,
  spec: RecoveryCommitSpec,
): Promise<string> {
  if (snapshot.dataset_id !== datasetId) {
    throw new AndroidGitAdapterError(
      "Recovery snapshot dataset does not match the configured dataset",
    );
  }
  const [firstParent, secondParent] = spec.parents;
  validateAndroidObjectId(firstParent, "first recovery parent");
  validateAndroidObjectId(secondParent, "second recovery parent");
  const tree = await writeAndroidRecoveryTree(effects, snapshot);
  const identity = {
    name: spec.name,
    email: spec.email,
    timestamp: spec.timestamp_seconds,
    timezoneOffset: spec.timezone_offset_minutes,
  };
  const candidate = validateAndroidObjectId(
    await writeCommit({
      fs: effects.fs,
      dir: effects.dir,
      commit: {
        message: `${spec.message}\n`,
        tree,
        parent: [firstParent, secondParent],
        author: identity,
        committer: identity,
      },
    }),
    "recovery candidate",
  );
  const privateRef = recoveryPrivateRef(datasetId);
  const current = await optionalAndroidRef(effects, privateRef);
  if (current === candidate) return candidate;
  if (current !== null) {
    throw new AndroidGitAdapterError(
      "Recovery private ref already points to another candidate",
    );
  }
  await writeRef({
    fs: effects.fs,
    dir: effects.dir,
    ref: privateRef,
    value: candidate,
    force: true,
  });
  return candidate;
}

export async function androidRecoveryCandidateParents(
  effects: AndroidGitEffects,
  candidateHead: string,
): Promise<readonly [string, string]> {
  validateAndroidObjectId(candidateHead, "candidateHead");
  const value = await readCommit({
    fs: effects.fs,
    dir: effects.dir,
    oid: candidateHead,
  });
  if (value.commit.parent.length !== 2) {
    throw new AndroidGitAdapterError(
      "Recovery candidate must have exactly two parents",
    );
  }
  const first = value.commit.parent[0];
  const second = value.commit.parent[1];
  if (first === undefined || second === undefined) {
    throw new AndroidGitAdapterError(
      "Recovery candidate parent evidence is incomplete",
    );
  }
  return [
    validateAndroidObjectId(first, "first recovery parent"),
    validateAndroidObjectId(second, "second recovery parent"),
  ];
}

export async function deleteAndroidRecoveryCandidate(
  effects: AndroidGitEffects,
  datasetId: string,
  expectedCandidate: string,
): Promise<void> {
  validateAndroidObjectId(expectedCandidate, "expectedCandidate");
  const privateRef = recoveryPrivateRef(datasetId);
  const current = await optionalAndroidRef(effects, privateRef);
  if (current !== expectedCandidate) {
    throw new AndroidGitAdapterError(
      "Recovery private ref changed concurrently",
    );
  }
  await deleteRef({
    fs: effects.fs,
    dir: effects.dir,
    ref: privateRef,
  });
}

export async function compareAndSetAndroidPortableHead(
  effects: AndroidGitEffects,
  expectedLocalHead: string,
  candidateHead: string,
): Promise<void> {
  validateAndroidObjectId(expectedLocalHead, "expectedLocalHead");
  validateAndroidObjectId(candidateHead, "candidateHead");
  const current = await androidPortableHead(effects);
  if (current !== expectedLocalHead) {
    throw new AndroidGitAdapterError(
      "Android jig-data head changed concurrently; retry required",
    );
  }
  await writeRef({
    fs: effects.fs,
    dir: effects.dir,
    ref: `refs/heads/${ANDROID_DATA_BRANCH}`,
    value: candidateHead,
    force: true,
  });
  await checkout({
    fs: effects.fs,
    dir: effects.dir,
    ref: ANDROID_DATA_BRANCH,
    force: true,
  });
  if ((await androidPortableHead(effects)) !== candidateHead) {
    throw new AndroidGitAdapterError(
      "Android jig-data head does not match recovery target",
    );
  }
}

export async function readAndroidPortableSnapshot(
  effects: AndroidGitEffects,
  expectedDatasetId?: string,
): Promise<PortableSnapshot> {
  await assertDataBranch(effects);
  const tracked = await trackedPortablePaths(effects);
  const files = new Map<string, string>();

  for (const path of tracked) {
    files.set(path, await readUtf8(effects, path));
  }

  return validateSnapshot(files, expectedDatasetId);
}

async function writeAndroidPortableFiles(
  effects: AndroidGitEffects,
  snapshot: PortableSnapshot,
): Promise<void> {
  await ensureDirectory(effects.fs, `${effects.dir}/tasks`);
  await ensureDirectory(
    effects.fs,
    `${effects.dir}/recurrences`,
  );

  for (const [path, value] of snapshot.files) {
    if (!isPortablePath(path)) {
      throw new AndroidGitAdapterError(
        `Refusing to write non-Jig portable path ${path}`,
      );
    }
    await effects.fs.promises.writeFile(
      `${effects.dir}/${path}`,
      value,
      "utf8",
    );
  }
}

export async function commitAndroidPortableSnapshot(
  effects: AndroidGitEffects,
  snapshot: PortableSnapshot,
  revision: number,
): Promise<string> {
  if (!Number.isInteger(revision) || revision < 0) {
    throw new AndroidGitAdapterError(
      "Portable snapshot revision must be a non-negative integer",
    );
  }
  await assertDataBranch(effects);
  const tracked = await trackedPortablePaths(effects);
  const expected = new Set(snapshot.files.keys());

  await ensureDirectory(effects.fs, `${effects.dir}/tasks`);
  await ensureDirectory(
    effects.fs,
    `${effects.dir}/recurrences`,
  );

  for (const [path, value] of snapshot.files) {
    if (!isPortablePath(path)) {
      throw new AndroidGitAdapterError(
        `Refusing to write non-Jig portable path ${path}`,
      );
    }
    await effects.fs.promises.writeFile(
      `${effects.dir}/${path}`,
      value,
      "utf8",
    );
  }

  const stale = tracked.filter((path) => !expected.has(path));
  for (const path of stale) {
    try {
      await effects.fs.promises.unlink(
        `${effects.dir}/${path}`,
      );
    } catch (error) {
      if (
        !(error instanceof AndroidFsError) ||
        error.code !== "ENOENT"
      ) {
        throw error;
      }
    }
  }

  const expectedPaths = [...expected].sort((left, right) =>
    left.localeCompare(right),
  );
  if (expectedPaths.length > 0) {
    await add({
      fs: effects.fs,
      dir: effects.dir,
      filepath: expectedPaths,
    });
  }
  if (stale.length > 0) {
    await remove({
      fs: effects.fs,
      dir: effects.dir,
      filepath: stale,
    });
  }

  const matrix = await statusMatrix({
    fs: effects.fs,
    dir: effects.dir,
  });
  const hasStagedChange = matrix.some(
    ([, head, , stage]) => head !== stage,
  );
  if (!hasStagedChange) {
    return resolveRef({
      fs: effects.fs,
      dir: effects.dir,
      ref: "HEAD",
    });
  }

  const identity = {
    name: "Jig",
    email: "jig@local.invalid",
  };
  const oid = await commit({
    fs: effects.fs,
    dir: effects.dir,
    message: `Jig snapshot revision ${revision}`,
    author: identity,
    committer: identity,
    disallowEmpty: true,
  });

  await trackedPortablePaths(effects);
  return oid;
}

export async function androidSynchronizationRemote(
  effects: AndroidGitEffects,
): Promise<{
  readonly name: "origin";
  readonly location: string;
}> {
  const location = await getConfig({
    fs: effects.fs,
    dir: effects.dir,
    path: `remote.${ANDROID_REMOTE}.url`,
  });
  if (location === undefined || location.length === 0) {
    throw new AndroidGitAdapterError(
      "Android managed repository has no origin remote",
    );
  }
  assertCredentialFreeHttpsRemote(location);
  return {
    name: ANDROID_REMOTE,
    location,
  };
}

export type AndroidPortableRemoteObservation =
  | {
      readonly state: "absent";
      readonly local_head: string;
      readonly remote: {
        readonly name: "origin";
        readonly location: string;
      };
      readonly previously_synchronized: boolean;
    }
  | {
      readonly state: "unsafe";
      readonly local_head: string;
      readonly remote?: {
        readonly name: "origin";
        readonly location: string;
      };
      readonly unsafe_reason: SynchronizationUnsafeReason;
    }
  | {
      readonly state: "present";
      readonly local_head: string;
      readonly remote: {
        readonly name: "origin";
        readonly location: string;
      };
      readonly remote_head: string;
      readonly remote_rewritten: boolean;
      readonly lineage: SynchronizationLineage;
      readonly remote_snapshot: PortableSnapshot;
    };

export async function observeAndroidPortableRemote(
  effects: AndroidGitEffects,
  expectedDatasetId: string,
  lastAdoptedHead: string | null,
  credential: GitCredentialProvider,
): Promise<AndroidPortableRemoteObservation> {
  await assertDataBranch(effects);
  const localHead = await androidPortableHead(effects);
  const trackingRef =
    `refs/remotes/${ANDROID_REMOTE}/${ANDROID_DATA_BRANCH}`;
  const previousRemoteHead = await optionalAndroidRef(
    effects,
    trackingRef,
  );

  let location: string;
  try {
    location = (await androidSynchronizationRemote(effects)).location;
  } catch {
    return {
      state: "unsafe",
      local_head: localHead,
      unsafe_reason: "remote-ambiguous",
    };
  }

  const diagnosticLocation = new URL(location);
  diagnosticLocation.search = "";
  diagnosticLocation.hash = "";
  const remote = {
    name: ANDROID_REMOTE,
    location: diagnosticLocation.toString(),
  } as const;
  const headers = await authenticatedHeaders(credential);
  const refs = await listServerRefs({
    http: effects.http,
    url: location,
    forPush: false,
    headers: { ...headers },
    ...authenticationCallbacks(credential),
  });
  const advertised = refs.find(
    (candidate) =>
      candidate.ref ===
      `refs/heads/${ANDROID_DATA_BRANCH}`,
  );
  if (advertised === undefined) {
    return {
      state: "absent",
      local_head: localHead,
      remote,
      previously_synchronized:
        previousRemoteHead !== null ||
        lastAdoptedHead !== null,
    };
  }
  if (advertised.oid === undefined || advertised.oid.length === 0) {
    return {
      state: "unsafe",
      local_head: localHead,
      remote,
      unsafe_reason: "unknown",
    };
  }

  await fetch({
    fs: effects.fs,
    http: effects.http,
    dir: effects.dir,
    remote: ANDROID_REMOTE,
    ref: ANDROID_DATA_BRANCH,
    singleBranch: true,
    tags: false,
    headers: { ...headers },
    ...authenticationCallbacks(credential),
  });
  const remoteHead = await resolveRef({
    fs: effects.fs,
    dir: effects.dir,
    ref: trackingRef,
  });
  if (remoteHead !== advertised.oid) {
    throw new AndroidGitAdapterError(
      "Android remote changed during observation; retry required",
    );
  }

  let remoteSnapshot: PortableSnapshot;
  try {
    remoteSnapshot = await readAndroidSnapshotAtOid(
      effects,
      remoteHead,
      expectedDatasetId,
    );
  } catch (error) {
    if (previousRemoteHead !== null) {
      await writeRef({
        fs: effects.fs,
        dir: effects.dir,
        ref: trackingRef,
        value: previousRemoteHead,
        force: true,
      });
    }
    return {
      state: "unsafe",
      local_head: localHead,
      remote,
      unsafe_reason:
        error instanceof SnapshotDatasetMismatchError
          ? "dataset-mismatch"
          : "invalid-snapshot",
    };
  }

  let remoteRewritten = false;
  if (
    previousRemoteHead !== null &&
    previousRemoteHead !== remoteHead
  ) {
    try {
      remoteRewritten = !(
        await isDescendent({
          fs: effects.fs,
          dir: effects.dir,
          oid: remoteHead,
          ancestor: previousRemoteHead,
        })
      );
    } catch {
      remoteRewritten = true;
    }
  }

  let lineage: SynchronizationLineage = "unknown";
  if (localHead === remoteHead) {
    lineage = "equal";
  } else {
    let remoteAhead: boolean | null = null;
    let localAhead: boolean | null = null;
    try {
      remoteAhead = await isDescendent({
        fs: effects.fs,
        dir: effects.dir,
        oid: remoteHead,
        ancestor: localHead,
      });
      localAhead = await isDescendent({
        fs: effects.fs,
        dir: effects.dir,
        oid: localHead,
        ancestor: remoteHead,
      });
    } catch {
      remoteAhead = null;
      localAhead = null;
    }

    if (remoteAhead === true) {
      lineage = "remote-ahead";
    } else if (localAhead === true) {
      lineage = "local-ahead";
    } else if (remoteAhead === false && localAhead === false) {
      lineage = "diverged";
    }
  }

  if (
    remoteRewritten &&
    previousRemoteHead !== null
  ) {
    await writeRef({
      fs: effects.fs,
      dir: effects.dir,
      ref: trackingRef,
      value: previousRemoteHead,
      force: true,
    });
  }

  return {
    state: "present",
    local_head: localHead,
    remote,
    remote_head: remoteHead,
    remote_rewritten: remoteRewritten,
    lineage,
    remote_snapshot: remoteSnapshot,
  };
}

export async function alignAndroidPortableHead(
  effects: AndroidGitEffects,
  expectedHead: string,
  targetHead: string,
): Promise<void> {
  const current = await androidPortableHead(effects);
  if (current !== expectedHead) {
    throw new AndroidGitAdapterError(
      "Android jig-data head changed concurrently; retry required",
    );
  }

  if (
    expectedHead !== targetHead &&
    !(
      await isDescendent({
        fs: effects.fs,
        dir: effects.dir,
        oid: targetHead,
        ancestor: expectedHead,
      })
    )
  ) {
    throw new AndroidGitAdapterError(
      "Android jig-data alignment must be a fast-forward",
    );
  }

  const result = await merge({
    fs: effects.fs,
    dir: effects.dir,
    ours: ANDROID_DATA_BRANCH,
    theirs:
      `refs/remotes/${ANDROID_REMOTE}/${ANDROID_DATA_BRANCH}`,
    fastForwardOnly: true,
  });
  if (result.fastForward !== true && result.alreadyMerged !== true) {
    throw new AndroidGitAdapterError(
      "Android jig-data fast-forward did not complete",
    );
  }
  await checkout({
    fs: effects.fs,
    dir: effects.dir,
    ref: ANDROID_DATA_BRANCH,
    force: true,
  });
  if ((await androidPortableHead(effects)) !== targetHead) {
    throw new AndroidGitAdapterError(
      "Android jig-data head does not match fast-forward target",
    );
  }
}

export async function pushAndroidPortableRepository(
  effects: AndroidGitEffects,
  credential: GitCredentialProvider,
): Promise<void> {
  await assertDataBranch(effects);
  const headers = await authenticatedHeaders(credential);
  const result = await push({
    fs: effects.fs,
    http: effects.http,
    dir: effects.dir,
    remote: ANDROID_REMOTE,
    ref: ANDROID_DATA_BRANCH,
    remoteRef: ANDROID_DATA_BRANCH,
    headers,
    ...authenticationCallbacks(credential),
  });
  if (!result.ok) {
    throw new AndroidGitAdapterError(
      result.error ?? "Android jig-data push failed",
    );
  }
}
