import { describe, expect, it } from "vitest";
import type {
  RepositorySynchronizationStatus,
  ServiceStatus,
} from "../../src/protocol";
import {
  localGitStatusPresentation,
  planningDataHomePresentation,
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
  it("projects healthy repository continuity into user-level states", () => {
    expect(repositoryStatusPresentation(localOnly())).toMatchObject({
      key: "local-only",
      label: "Local only",
      icon: "success",
      iconColor: "success",
    });
    expect(
      repositoryStatusPresentation(configured("synchronized")),
    ).toMatchObject({
      key: "synchronized",
      label: "Up to date",
      icon: "success",
      iconColor: "success",
    });
  });

  it("keeps exact local and remote Git facts available for diagnostics", () => {
    expect(
      localGitStatusPresentation(configured("sync-issue")),
    ).toMatchObject({
      label: "Committed",
    });
    expect(
      remoteGitStatusPresentation(configured("sync-issue")),
    ).toMatchObject({
      label: "Sync issue",
      remoteName: "origin",
      remoteLocation: "https://github.com/example/planning.git",
    });
    expect(
      repositoryStatusPresentation(configured("sync-issue")),
    ).toMatchObject({
      key: "sync-issue",
      label: "Needs attention",
      message: "Saved locally · Sync needs attention.",
    });
  });

  it("projects local repository snapshot failure without Git vocabulary", () => {
    expect(
      repositoryStatusPresentation(configured("pending", "issue")),
    ).toMatchObject({
      key: "sync-issue",
      label: "Needs attention",
      iconColor: "error",
    });
    expect(
      localGitStatusPresentation(configured("pending", "issue")),
    ).toMatchObject({
      label: "Local Git issue",
    });
  });

  it("uses one Syncing state while retaining exact pending/retrying diagnostics", () => {
    expect(repositoryStatusPresentation(configured("pending"))).toMatchObject({
      key: "pending",
      label: "Syncing",
    });
    expect(repositoryStatusPresentation(configured("retrying"))).toMatchObject({
      key: "retrying",
      label: "Syncing",
    });
    expect(remoteGitStatusPresentation(configured("retrying"))).toMatchObject({
      label: "Retrying",
    });
    expect(repositoryStatusPresentation(null)).toMatchObject({
      key: "unknown",
      label: "Status",
      iconColor: "secondary",
    });
  });

  it("derives a human-readable planning-data home separately from diagnostics", () => {
    expect(planningDataHomePresentation(configured("synchronized")))
      .toStrictEqual({
        label: "example/planning",
        detail: "Repository used for cross-device continuity.",
      });
    expect(planningDataHomePresentation(localOnly())).toStrictEqual({
      label: "Local only",
      detail: "Planning data is stored in the selected local repository.",
    });
    expect(remoteGitStatusPresentation(localOnly())).toMatchObject({
      label: "No remote configured",
      remoteName: null,
      remoteLocation: null,
    });
  });
});
