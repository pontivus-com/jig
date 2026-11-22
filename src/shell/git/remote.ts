import type { SynchronizationLineage } from "../../core/synchronization";
import {
  SnapshotDatasetMismatchError,
  type PortableSnapshot,
} from "../../core/portable";
import type {
  SynchronizationUnsafeReason,
} from "../../core/synchronization";
import { GitAdapterError, requireGit, runGit } from "./process";
import {
  assertAdapterPaths,
  type GitAdapterConfig,
} from "./repository";
import {
  DATA_REF,
  isLegacyEmptyBootstrap,
  readCurrentPortableSnapshot,
  readSnapshotAtRef,
  type PortableSnapshotCandidate,
} from "./portable-store";

const REMOTE_GIT_TIMEOUT_MS = 60_000;

export interface RepositorySynchronizationResult {
  readonly status: "synchronized" | "sync-issue";
  readonly retryable: boolean;
}

export interface SynchronizationRemote {
  readonly name: string;
  readonly location: string;
}

export type SynchronizationAuthority =
  | { readonly state: "none" }
  | { readonly state: "ambiguous" }
  | {
      readonly state: "selected";
      readonly remote: SynchronizationRemote;
    };

export type PortableRemoteObservation =
  | {
      readonly state: "none";
      readonly local_head: string | null;
    }
  | {
      readonly state: "ambiguous";
      readonly local_head: string | null;
    }
  | {
      readonly state: "absent";
      readonly remote: SynchronizationRemote;
      readonly local_head: string | null;
      readonly previously_synchronized: boolean;
    }
  | {
      readonly state: "unsafe";
      readonly remote: SynchronizationRemote;
      readonly local_head: string | null;
      readonly unsafe_reason: SynchronizationUnsafeReason;
    }
  | {
      readonly state: "present";
      readonly remote: SynchronizationRemote;
      readonly local_head: string | null;
      readonly remote_head: string;
      readonly remote_rewritten: boolean;
      readonly lineage: SynchronizationLineage;
      readonly remote_snapshot: PortableSnapshot;
    };

async function selectedRemoteName(
  repositoryPath: string,
): Promise<string | null | "ambiguous"> {
  const result = await runGit(repositoryPath, ["remote"]);
  if (result.exit_code !== 0) {
    throw new GitAdapterError(
      `Unable to inspect repository remotes: ${result.stderr || result.stdout}`,
    );
  }
  const remotes = result.stdout.split("\n").filter(Boolean);
  if (remotes.length === 0) {
    return null;
  }

  const pushDefault = await runGit(repositoryPath, [
    "config",
    "--get",
    "remote.pushDefault",
  ]);
  if (
    pushDefault.exit_code === 0 &&
    remotes.includes(pushDefault.stdout)
  ) {
    return pushDefault.stdout;
  }

  const branchName = await runGit(repositoryPath, [
    "symbolic-ref",
    "--quiet",
    "--short",
    "HEAD",
  ]);
  if (branchName.exit_code === 0 && branchName.stdout.length > 0) {
    const branchRemote = await runGit(repositoryPath, [
      "config",
      "--get",
      `branch.${branchName.stdout}.remote`,
    ]);
    if (
      branchRemote.exit_code === 0 &&
      remotes.includes(branchRemote.stdout)
    ) {
      return branchRemote.stdout;
    }
  }

  return remotes.length === 1
    ? remotes[0] ?? null
    : "ambiguous";
}

export async function discoverSynchronizationRemote(
  repositoryPath: string,
): Promise<string | null> {
  const selected = await selectedRemoteName(repositoryPath);
  return selected === "ambiguous" ? null : selected;
}


export async function inspectPortableCandidate(
  config: GitAdapterConfig,
): Promise<PortableSnapshotCandidate | null> {
  assertAdapterPaths(config);

  let local: PortableSnapshotCandidate | null;
  try {
    local = await readCurrentPortableSnapshot(config);
  } catch (error) {
    if ((await isLegacyEmptyBootstrap(config.repository_path)) === null) {
      throw error;
    }
    local = null;
  }
  if (local !== null) {
    return local;
  }

  const remoteName = await discoverSynchronizationRemote(
    config.repository_path,
  );
  if (remoteName === null) {
    return null;
  }

  const trackingRef = `refs/remotes/${remoteName}/jig-data`;
  const trackedHead = await runGit(config.repository_path, [
    "show-ref",
    "--verify",
    "--hash",
    trackingRef,
  ]);
  if (trackedHead.exit_code === 0 && trackedHead.stdout.length > 0) {
    const tracked = {
      head: trackedHead.stdout,
      snapshot: await readSnapshotAtRef(
        config.repository_path,
        trackingRef,
      ),
    };
    await requireGit(config.repository_path, [
      "update-ref",
      DATA_REF,
      tracked.head,
    ]);
    return tracked;
  }

  const advertised = await runGit(config.repository_path, [
    "ls-remote",
    "--exit-code",
    remoteName,
    "refs/heads/jig-data",
  ]);
  if (
    advertised.exit_code !== 0 ||
    advertised.stdout.length === 0
  ) {
    return null;
  }

  const fetched = await runGit(config.repository_path, [
    "fetch",
    "--no-tags",
    remoteName,
    `refs/heads/jig-data:${trackingRef}`,
  ]);
  if (fetched.exit_code !== 0) {
    return null;
  }

  const head = await requireGit(config.repository_path, [
    "rev-parse",
    trackingRef,
  ]);
  const remote = {
    head,
    snapshot: await readSnapshotAtRef(
      config.repository_path,
      trackingRef,
    ),
  };
  await requireGit(config.repository_path, [
    "update-ref",
    DATA_REF,
    remote.head,
  ]);
  return remote;
}

export function sanitizeSynchronizationRemoteLocation(
  value: string,
): string {
  const trimmed = value.trim();
  try {
    const parsed = new URL(trimmed);
    parsed.username = "";
    parsed.password = "";
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    const scpLike = /^(?:[^@\s]+@)?([^:\s]+):(.+)$/.exec(trimmed);
    const host = scpLike?.[1];
    const path = scpLike?.[2];
    if (host !== undefined && path !== undefined) {
      const cleanPath = path.split(/[?#]/, 1)[0] ?? "";
      return `${host}:${cleanPath}`;
    }
    return trimmed.split(/[?#]/, 1)[0] ?? trimmed;
  }
}

export async function inspectSynchronizationAuthority(
  config: GitAdapterConfig,
): Promise<SynchronizationAuthority> {
  assertAdapterPaths(config);
  const name = await selectedRemoteName(config.repository_path);
  if (name === null) {
    return { state: "none" };
  }
  if (name === "ambiguous") {
    return { state: "ambiguous" };
  }

  const urls = await runGit(config.repository_path, [
    "remote",
    "get-url",
    "--push",
    "--all",
    name,
  ]);
  const pushUrls = urls.stdout.split("\n").filter(Boolean);
  if (
    urls.exit_code !== 0 ||
    pushUrls.length !== 1 ||
    pushUrls[0] === undefined
  ) {
    return { state: "ambiguous" };
  }

  return {
    state: "selected",
    remote: {
      name,
      location: sanitizeSynchronizationRemoteLocation(
        pushUrls[0],
      ),
    },
  };
}

export async function inspectSynchronizationRemote(
  config: GitAdapterConfig,
): Promise<SynchronizationRemote | null> {
  const authority = await inspectSynchronizationAuthority(config);
  return authority.state === "selected"
    ? authority.remote
    : null;
}

export async function repositorySynchronizationMode(
  config: GitAdapterConfig,
): Promise<"local-only" | "remote" | "ambiguous"> {
  const authority = await inspectSynchronizationAuthority(config);
  if (authority.state === "none") {
    return "local-only";
  }
  return authority.state === "selected"
    ? "remote"
    : "ambiguous";
}


async function refHead(
  repositoryPath: string,
  ref: string,
): Promise<string | null> {
  const result = await runGit(repositoryPath, [
    "show-ref",
    "--verify",
    "--hash",
    ref,
  ]);
  return result.exit_code === 0 && result.stdout.length > 0
    ? result.stdout
    : null;
}

async function ancestor(
  repositoryPath: string,
  older: string,
  newer: string,
): Promise<boolean | null> {
  const result = await runGit(repositoryPath, [
    "merge-base",
    "--is-ancestor",
    older,
    newer,
  ]);
  return result.exit_code === 0
    ? true
    : result.exit_code === 1
      ? false
      : null;
}


export async function observePortableRemote(
  config: GitAdapterConfig,
  expectedDatasetId: string,
  lastAdoptedHead: string | null,
  environment: Readonly<Record<string, string>> = {},
): Promise<PortableRemoteObservation> {
  const authority = await inspectSynchronizationAuthority(config);
  const localHead = await refHead(config.repository_path, DATA_REF);
  if (authority.state === "none") {
    return { state: "none", local_head: localHead };
  }
  if (authority.state === "ambiguous") {
    return { state: "ambiguous", local_head: localHead };
  }

  const trackingRef =
    `refs/remotes/${authority.remote.name}/jig-data`;
  const previousRemoteHead = await refHead(
    config.repository_path,
    trackingRef,
  );

  const advertised = await runGit(
    config.repository_path,
    [
      "ls-remote",
      "--heads",
      authority.remote.name,
      "refs/heads/jig-data",
    ],
    undefined,
    environment,
    REMOTE_GIT_TIMEOUT_MS,
  );
  if (advertised.exit_code !== 0) {
    throw new GitAdapterError(
      advertised.stderr || "Unable to observe remote jig-data",
    );
  }
  if (advertised.stdout.length === 0) {
    return {
      state: "absent",
      remote: authority.remote,
      local_head: localHead,
      previously_synchronized:
        previousRemoteHead !== null ||
        lastAdoptedHead !== null,
    };
  }

  const remoteHead = advertised.stdout.split(/\s+/, 1)[0];
  if (remoteHead === undefined || remoteHead.length === 0) {
    throw new GitAdapterError(
      "Malformed remote jig-data advertisement",
    );
  }

  const fetched = await runGit(
    config.repository_path,
    [
      "fetch",
      "--no-tags",
      "--refmap=",
      authority.remote.name,
      "refs/heads/jig-data",
    ],
    undefined,
    environment,
    REMOTE_GIT_TIMEOUT_MS,
  );
  if (fetched.exit_code !== 0) {
    throw new GitAdapterError(
      fetched.stderr || "Unable to fetch remote jig-data",
    );
  }

  const fetchedHead = await runGit(
    config.repository_path,
    ["rev-parse", "FETCH_HEAD"],
  );
  if (
    fetchedHead.exit_code !== 0 ||
    fetchedHead.stdout !== remoteHead
  ) {
    throw new GitAdapterError(
      "Remote jig-data changed during observation",
    );
  }

  let remoteSnapshot: PortableSnapshot;
  try {
    remoteSnapshot = await readSnapshotAtRef(
      config.repository_path,
      remoteHead,
      expectedDatasetId,
    );
  } catch (error) {
    return {
      state: "unsafe",
      remote: authority.remote,
      local_head: localHead,
      unsafe_reason:
        error instanceof SnapshotDatasetMismatchError
          ? "dataset-mismatch"
          : "invalid-snapshot",
    };
  }

  const priorRemoteHead =
    previousRemoteHead ?? lastAdoptedHead;
  const remoteRewritten =
    priorRemoteHead !== null &&
    priorRemoteHead !== remoteHead &&
    (await ancestor(
      config.repository_path,
      priorRemoteHead,
      remoteHead,
    )) !== true;

  let lineage: SynchronizationLineage = "unknown";
  if (localHead !== null) {
    if (localHead === remoteHead) {
      lineage = "equal";
    } else {
      const remoteAhead = await ancestor(
        config.repository_path,
        localHead,
        remoteHead,
      );
      const localAhead = await ancestor(
        config.repository_path,
        remoteHead,
        localHead,
      );
      if (remoteAhead === true) {
        lineage = "remote-ahead";
      } else if (localAhead === true) {
        lineage = "local-ahead";
      } else if (
        remoteAhead === false &&
        localAhead === false
      ) {
        lineage = "diverged";
      }
    }
  }

  if (!remoteRewritten) {
    const updated = await runGit(config.repository_path, [
      "update-ref",
      trackingRef,
      remoteHead,
      previousRemoteHead ?? "0".repeat(40),
    ]);
    if (updated.exit_code !== 0) {
      throw new GitAdapterError(
        "Remote-tracking evidence changed concurrently",
      );
    }
  }

  return {
    state: "present",
    remote: authority.remote,
    local_head: localHead,
    remote_head: remoteHead,
    remote_rewritten: remoteRewritten,
    lineage,
    remote_snapshot: remoteSnapshot,
  };
}


export async function pushPortableDataRef(
  config: GitAdapterConfig,
  expectedRemote: SynchronizationRemote,
  environment: Readonly<Record<string, string>> = {},
): Promise<RepositorySynchronizationResult> {
  const authority = await inspectSynchronizationAuthority(config);
  if (
    authority.state !== "selected" ||
    authority.remote.name !== expectedRemote.name ||
    authority.remote.location !== expectedRemote.location
  ) {
    return { status: "sync-issue", retryable: false };
  }

  const result = await runGit(
    config.repository_path,
    [
      "push",
      authority.remote.name,
      `${DATA_REF}:refs/heads/jig-data`,
    ],
    undefined,
    environment,
    REMOTE_GIT_TIMEOUT_MS,
  );
  return {
    status:
      result.exit_code === 0
        ? "synchronized"
        : "sync-issue",
    retryable: result.exit_code !== 0,
  };
}

