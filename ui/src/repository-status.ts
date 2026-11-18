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

export function localGitStatusPresentation(
  status: ServiceStatus | null,
): RepositoryDetailPresentation {
  switch (status?.repository_status.local_git) {
    case "pending":
      return {
        label: "Pending commit",
        message: "The current Jig revision has not yet reached the local Git snapshot.",
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
        message: "This repository is operating locally without a synchronization remote.",
        remoteName: null,
        remoteLocation: null,
      };
    case "pending":
      return {
        label: "Pending",
        message: "The local Git snapshot is waiting to synchronize with the configured remote.",
        remoteName: remote.remote_name,
        remoteLocation: remote.remote_location,
      };
    case "retrying":
      return {
        label: "Retrying",
        message: "Remote synchronization is retrying while local Git remains committed.",
        remoteName: remote.remote_name,
        remoteLocation: remote.remote_location,
      };
    case "synchronized":
      return {
        label: "Synchronized",
        message: "The current local Git snapshot is synchronized with the configured remote.",
        remoteName: remote.remote_name,
        remoteLocation: remote.remote_location,
      };
    case "sync-issue":
      return {
        label: "Sync issue",
        message: "Remote synchronization has an operational issue; local Git remains committed.",
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

export function repositoryStatusPresentation(
  status: ServiceStatus | null,
): RepositoryStatusPresentation {
  if (status === null) {
    return {
      key: "unknown",
      label: "Status",
      message: "Repository status is unavailable.",
      icon: "info",
      iconColor: "secondary",
    };
  }

  if (status.repository_status.local_git === "issue") {
    return {
      key: "sync-issue",
      label: "Git issue",
      message: "The current Jig snapshot could not be committed to local Git.",
      icon: "error",
      iconColor: "error",
    };
  }

  if (status.repository_status.local_git === "pending") {
    return {
      key: "pending",
      label: "Sync pending",
      message: "Saved locally. The current Jig snapshot is waiting for its local Git commit.",
      icon: "warning",
      iconColor: "warning",
    };
  }

  switch (status.repository_status.remote.state) {
    case "not-configured":
      return {
        key: "local-only",
        label: "Local only",
        message: "Committed to local Git. No synchronization remote is configured.",
        icon: "success",
        iconColor: "success",
      };
    case "pending":
      return {
        key: "pending",
        label: "Sync pending",
        message: "Committed to local Git. Remote synchronization is pending.",
        icon: "warning",
        iconColor: "warning",
      };
    case "retrying":
      return {
        key: "retrying",
        label: "Retrying",
        message: "Committed to local Git. Remote synchronization is retrying.",
        icon: "warning",
        iconColor: "warning",
      };
    case "synchronized":
      return {
        key: "synchronized",
        label: "Synced",
        message: "The current Jig snapshot is committed locally and synchronized remotely.",
        icon: "success",
        iconColor: "success",
      };
    case "sync-issue":
      return {
        key: "sync-issue",
        label: "Sync issue",
        message: "Committed to local Git. Remote synchronization currently has an operational issue.",
        icon: "error",
        iconColor: "error",
      };
  }
}
