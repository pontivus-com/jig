import type { IconColor, IconName } from "@astryxdesign/core/Icon";
import type { ServiceStatus } from "../../src/protocol";

export type RepositoryStatusKey =
  | ServiceStatus["repository_status"]
  | "unknown";

export interface RepositoryStatusPresentation {
  readonly key: RepositoryStatusKey;
  readonly label: string;
  readonly message: string;
  readonly icon: IconName;
  readonly iconColor: IconColor;
}

export function repositoryStatusPresentation(
  status: ServiceStatus | null,
): RepositoryStatusPresentation {
  switch (status?.repository_status) {
    case "local-only":
      return {
        key: "local-only",
        label: "Local only",
        message: "Saved locally. Repository synchronization is not currently available.",
        icon: "success",
        iconColor: "success",
      };
    case "pending":
      return {
        key: "pending",
        label: "Sync pending",
        message: "Saved locally. Repository synchronization is pending.",
        icon: "warning",
        iconColor: "warning",
      };
    case "retrying":
      return {
        key: "retrying",
        label: "Retrying",
        message: "Saved locally. Repository synchronization is retrying.",
        icon: "warning",
        iconColor: "warning",
      };
    case "synchronized":
      return {
        key: "synchronized",
        label: "Synced",
        message: "Local planning data and the configured repository are synchronized.",
        icon: "success",
        iconColor: "success",
      };
    case "sync-issue":
      return {
        key: "sync-issue",
        label: "Sync issue",
        message: "Local planning data is safe. Repository synchronization currently has an operational issue.",
        icon: "error",
        iconColor: "error",
      };
    default:
      return {
        key: "unknown",
        label: "Status",
        message: "Repository status is unavailable.",
        icon: "info",
        iconColor: "secondary",
      };
  }
}
