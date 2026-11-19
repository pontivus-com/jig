import type { IconColor, IconName } from "@astryxdesign/core/Icon";
import type { ServiceStatus } from "../../src/protocol";

export type RepositoryStatusKey =
  | "local-only"
  | "pending"
  | "retrying"
  | "synchronized"
  | "sync-issue"
  | "unknown";

export interface RepositoryStatusPresentation {
  readonly key: RepositoryStatusKey;
  readonly label: string;
  readonly message: string;
  readonly icon: IconName;
  readonly iconColor: IconColor;
}

export interface RepositoryDetailPresentation {
  readonly label: string;
  readonly message: string;
}

export interface RemoteRepositoryPresentation
  extends RepositoryDetailPresentation {
  readonly remoteName: string | null;
  readonly remoteLocation: string | null;
}

export interface PlanningDataHomePresentation {
  readonly label: string;
  readonly detail: string;
}

export function localGitStatusPresentation(
  status: ServiceStatus | null,
): RepositoryDetailPresentation {
  switch (status?.repository_status.local_git) {
    case "pending":
      return {
        label: "Pending commit",
        message:
          "The current Jig revision has not yet reached the local Git snapshot.",
      };
    case "committed":
      return {
        label: "Committed",
        message: "The current Jig snapshot is committed to local Git.",
      };
    case "issue":
      return {
        label: "Local Git issue",
        message: "Jig could not commit the current snapshot to local Git.",
      };
    default:
      return {
        label: "Unavailable",
        message: "Local Git status is unavailable.",
      };
  }
}

export function remoteGitStatusPresentation(
  status: ServiceStatus | null,
): RemoteRepositoryPresentation {
  const remote = status?.repository_status.remote;
  switch (remote?.state) {
    case "not-configured":
      return {
        label: "No remote configured",
        message:
          "This repository is operating locally without a synchronization remote.",
        remoteName: null,
        remoteLocation: null,
      };
    case "pending":
      return {
        label: "Pending",
        message:
          "The local Git snapshot is waiting to synchronize with the configured remote.",
        remoteName: remote.remote_name,
        remoteLocation: remote.remote_location,
      };
    case "retrying":
      return {
        label: "Retrying",
        message:
          "Remote synchronization is retrying while local Git remains committed.",
        remoteName: remote.remote_name,
        remoteLocation: remote.remote_location,
      };
    case "synchronized":
      return {
        label: "Synchronized",
        message:
          "The current local Git snapshot is synchronized with the configured remote.",
        remoteName: remote.remote_name,
        remoteLocation: remote.remote_location,
      };
    case "sync-issue":
      return {
        label: "Sync issue",
        message:
          "Remote synchronization has an operational issue; local Git remains committed.",
        remoteName: remote.remote_name,
        remoteLocation: remote.remote_location,
      };
    default:
      return {
        label: "Unavailable",
        message: "Remote synchronization status is unavailable.",
        remoteName: null,
        remoteLocation: null,
      };
  }
}

function humanRepositoryIdentity(location: string): string {
  const githubPrefix = "https://github.com/";
  if (location.toLowerCase().startsWith(githubPrefix)) {
    return location
      .slice(githubPrefix.length)
      .replace(/\.git$/i, "");
  }
  return location;
}

export function planningDataHomePresentation(
  status: ServiceStatus | null,
): PlanningDataHomePresentation {
  if (status === null) {
    return {
      label: "Unavailable",
      detail: "Jig could not read the current planning-data home.",
    };
  }

  const remote = status.repository_status.remote;
  if (
    remote.state !== "not-configured" &&
    remote.remote_location !== null
  ) {
    return {
      label: humanRepositoryIdentity(remote.remote_location),
      detail: "Repository used for cross-device continuity.",
    };
  }

  return {
    label: "Local only",
    detail: "Planning data is stored in the selected local repository.",
  };
}

export function repositoryStatusPresentation(
  status: ServiceStatus | null,
): RepositoryStatusPresentation {
  if (status === null) {
    return {
      key: "unknown",
      label: "Status",
      message: "Synchronization status is unavailable.",
      icon: "info",
      iconColor: "secondary",
    };
  }

  if (status.repository_status.local_git === "issue") {
    return {
      key: "sync-issue",
      label: "Needs attention",
      message:
        "Your current work is saved in Jig, but repository continuity needs attention.",
      icon: "error",
      iconColor: "error",
    };
  }

  if (status.repository_status.local_git === "pending") {
    return {
      key: "pending",
      label: "Syncing",
      message: "Saved locally. Repository continuity is updating.",
      icon: "warning",
      iconColor: "warning",
    };
  }

  switch (status.repository_status.remote.state) {
    case "not-configured":
      return {
        key: "local-only",
        label: "Local only",
        message: "Saved locally. No remote synchronization is configured.",
        icon: "success",
        iconColor: "success",
      };
    case "pending":
      return {
        key: "pending",
        label: "Syncing",
        message: "Saved locally. Remote continuity is updating.",
        icon: "warning",
        iconColor: "warning",
      };
    case "retrying":
      return {
        key: "retrying",
        label: "Syncing",
        message: "Saved locally. Remote continuity is retrying automatically.",
        icon: "warning",
        iconColor: "warning",
      };
    case "synchronized":
      return {
        key: "synchronized",
        label: "Up to date",
        message: "Saved locally and up to date remotely.",
        icon: "success",
        iconColor: "success",
      };
    case "sync-issue":
      return {
        key: "sync-issue",
        label: "Needs attention",
        message: "Saved locally · Sync needs attention.",
        icon: "error",
        iconColor: "error",
      };
  }
}
