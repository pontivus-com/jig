import { describe, expect, it } from "vitest";
import type {
  RepositorySynchronizationStatus,
  ServiceStatus,
} from "../../src/protocol";
import {
  localGitStatusPresentation,
  remoteGitStatusPresentation,
  repositoryStatusPresentation,
} from "../../ui/src/repository-status";

function status(
  repository_status: RepositorySynchronizationStatus,
): ServiceStatus {
  return {
    ready: true,
    repository_path: "/tmp/jig",
    repository_status,
  };
}

function configured(
  remoteState: "pending" | "retrying" | "synchronized" | "sync-issue",
  localGit: "pending" | "committed" | "issue" = "committed",
): ServiceStatus {
  return status({
    local_git: localGit,
    remote: {
      state: remoteState,
      remote_name: "origin",
      remote_location: "https://github.com/example/planning.git",
    },
  });
}

function localOnly(
  localGit: "pending" | "committed" | "issue" = "committed",
): ServiceStatus {
  return status({
    local_git: localGit,
    remote: {
      state: "not-configured",
      remote_name: null,
      remote_location: null,
    },
  });
}

describe("repository status presentation", () => {
  it("treats committed local-only and synchronized as healthy but distinct", () => {
    const local = repositoryStatusPresentation(localOnly());
    const synced = repositoryStatusPresentation(
      configured("synchronized"),
    );

    expect(local).toMatchObject({
      key: "local-only",
      label: "Local only",
      icon: "success",
      iconColor: "success",
    });
    expect(synced).toMatchObject({
      key: "synchronized",
      label: "Synced",
      icon: "success",
      iconColor: "success",
    });
  });

  it("keeps local Git and remote synchronization meanings independent", () => {
    expect(localGitStatusPresentation(configured("sync-issue"))).toMatchObject({
      label: "Committed",
    });
    expect(remoteGitStatusPresentation(configured("sync-issue"))).toMatchObject({
      label: "Sync issue",
      remoteName: "origin",
      remoteLocation: "https://github.com/example/planning.git",
    });
    expect(repositoryStatusPresentation(configured("sync-issue"))).toMatchObject({
      key: "sync-issue",
      label: "Sync issue",
    });
  });

  it("makes a local Git commit failure stronger than remote state", () => {
    expect(repositoryStatusPresentation(configured("pending", "issue")))
      .toMatchObject({
        key: "sync-issue",
        label: "Git issue",
        iconColor: "error",
      });
    expect(localGitStatusPresentation(configured("pending", "issue")))
      .toMatchObject({
        label: "Local Git issue",
      });
  });

  it("keeps pending retry error and unknown operational meanings distinct", () => {
    expect(repositoryStatusPresentation(configured("pending")).iconColor)
      .toBe("warning");
    expect(repositoryStatusPresentation(configured("retrying")).iconColor)
      .toBe("warning");
    expect(repositoryStatusPresentation(configured("sync-issue")).iconColor)
      .toBe("error");
    expect(repositoryStatusPresentation(null)).toMatchObject({
      key: "unknown",
      label: "Status",
      iconColor: "secondary",
    });
  });

  it("renders no remote as an explicit healthy local-only fact", () => {
    expect(remoteGitStatusPresentation(localOnly())).toStrictEqual({
      label: "No remote configured",
      message:
        "This repository is operating locally without a synchronization remote.",
      remoteName: null,
      remoteLocation: null,
    });
  });
});
