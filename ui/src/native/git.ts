import {
  add,
  addRemote,
  clone,
  commit,
  currentBranch,
  fetch,
  getConfig,
  init,
  isDescendent,
  listFiles,
  merge,
  listServerRefs,
  push,
  remove,
  resolveRef,
  statusMatrix,
} from "isomorphic-git";
import {
  serializeSnapshot,
  validateSnapshot,
  type PortableSnapshot,
} from "../../../src/portable";
import type { CanonicalState } from "../../../src/protocol";
import {
  AndroidFsError,
  createAndroidGitFilesystem,
  type IsomorphicGitPromiseFs,
} from "./git-filesystem";
import {
  createAndroidGitHttpClient,
  type IsomorphicGitHttpClient,
} from "./git-http";
import { ANDROID_GIT_WORKTREE } from "./paths";

export const ANDROID_DATA_BRANCH = "jig-data";
const ANDROID_REMOTE = "origin";

export type GitCredentialProvider = () => Promise<string>;

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

function authCallback(provider: GitCredentialProvider) {
  return async (): Promise<Readonly<{ username: string }>> => {
    const token = (await provider()).trim();
    if (token.length === 0) {
      throw new AndroidGitAdapterError(
        "Android Git credential provider returned an empty token",
      );
    }
    return { username: token };
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

async function removeCreatedWorktree(
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
  createDatasetId: () => string = crypto.randomUUID,
): Promise<PortableSnapshot> {
  assertCredentialFreeHttpsRemote(remoteUrl);
  if (await pathExists(effects, effects.dir)) {
    throw new AndroidGitAdapterError(
      "Android managed repository checkout already exists",
    );
  }

  const refs = await listServerRefs({
    http: effects.http,
    url: remoteUrl,
    forPush: false,
    onAuth: authCallback(credential),
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
      await removeCreatedWorktree(effects);
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
    await removeCreatedWorktree(effects);
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

  await clone({
    fs: effects.fs,
    http: effects.http,
    dir: effects.dir,
    url: remoteUrl,
    ref: ANDROID_DATA_BRANCH,
    remote: ANDROID_REMOTE,
    singleBranch: true,
    noTags: true,
    onAuth: authCallback(credential),
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
  await fetch({
    fs: effects.fs,
    http: effects.http,
    dir: effects.dir,
    remote: ANDROID_REMOTE,
    ref: ANDROID_DATA_BRANCH,
    singleBranch: true,
    tags: false,
    onAuth: authCallback(credential),
  });
  return resolveRef({
    fs: effects.fs,
    dir: effects.dir,
    ref: `refs/remotes/${ANDROID_REMOTE}/${ANDROID_DATA_BRANCH}`,
  });
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
  await writeAndroidPortableFiles(effects, snapshot);
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

export async function commitAndroidCanonicalState(
  effects: AndroidGitEffects,
  state: CanonicalState,
  datasetId: string,
): Promise<string> {
  return commitAndroidPortableSnapshot(
    effects,
    serializeSnapshot(
      state.tasks,
      datasetId,
      state.recurrences,
    ),
    state.revision,
  );
}

export interface AndroidGitSynchronizationResult {
  readonly state:
    | "unchanged"
    | "remote-adopted"
    | "local-pushed"
    | "diverged";
  readonly head: string;
  readonly snapshot: PortableSnapshot | null;
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

export async function synchronizeAndroidPortableRepository(
  effects: AndroidGitEffects,
  expectedDatasetId: string,
  credential: GitCredentialProvider,
): Promise<AndroidGitSynchronizationResult> {
  const localHead = await androidPortableHead(effects);
  const remoteHead = await fetchAndroidPortableRepository(
    effects,
    credential,
  );
  if (remoteHead === localHead) {
    return {
      state: "unchanged",
      head: localHead,
      snapshot: null,
    };
  }

  const remoteDescendsFromLocal = await isDescendent({
    fs: effects.fs,
    dir: effects.dir,
    oid: remoteHead,
    ancestor: localHead,
  });
  if (remoteDescendsFromLocal) {
    await merge({
      fs: effects.fs,
      dir: effects.dir,
      ours: ANDROID_DATA_BRANCH,
      theirs: `refs/remotes/${ANDROID_REMOTE}/${ANDROID_DATA_BRANCH}`,
      fastForwardOnly: true,
    });
    return {
      state: "remote-adopted",
      head: remoteHead,
      snapshot: await readAndroidPortableSnapshot(
        effects,
        expectedDatasetId,
      ),
    };
  }

  const localDescendsFromRemote = await isDescendent({
    fs: effects.fs,
    dir: effects.dir,
    oid: localHead,
    ancestor: remoteHead,
  });
  if (localDescendsFromRemote) {
    await pushAndroidPortableRepository(
      effects,
      credential,
    );
    return {
      state: "local-pushed",
      head: localHead,
      snapshot: null,
    };
  }

  return {
    state: "diverged",
    head: localHead,
    snapshot: null,
  };
}

export async function pushAndroidPortableRepository(
  effects: AndroidGitEffects,
  credential: GitCredentialProvider,
): Promise<void> {
  await assertDataBranch(effects);
  const result = await push({
    fs: effects.fs,
    http: effects.http,
    dir: effects.dir,
    remote: ANDROID_REMOTE,
    ref: ANDROID_DATA_BRANCH,
    remoteRef: ANDROID_DATA_BRANCH,
    onAuth: authCallback(credential),
  });
  if (!result.ok) {
    throw new AndroidGitAdapterError(
      result.error ?? "Android jig-data push failed",
    );
  }
}
