import { describe, expect, it } from "vitest";
import type { ServiceStatus } from "../../src/protocol";
import { repositoryStatusPresentation } from "../../ui/src/repository-status";

function status(
  repository_status: ServiceStatus["repository_status"],
): ServiceStatus {
  return {
    ready: true,
    repository_path: "/tmp/jig",
    repository_status,
  };
}

describe("repository status presentation", () => {
  it("treats local-only and synchronized as healthy but keeps their labels distinct", () => {
    const local = repositoryStatusPresentation(status("local-only"));
    const synced = repositoryStatusPresentation(status("synchronized"));

    expect(local.label).toBe("Local only");
    expect(local.icon).toBe("success");
    expect(local.iconColor).toBe("success");

    expect(synced.label).toBe("Synced");
    expect(synced.icon).toBe("success");
    expect(synced.iconColor).toBe("success");
  });

  it("keeps warning error and unknown operational meanings distinct", () => {
    expect(repositoryStatusPresentation(status("pending")).iconColor).toBe(
      "warning",
    );
    expect(repositoryStatusPresentation(status("retrying")).iconColor).toBe(
      "warning",
    );
    expect(repositoryStatusPresentation(status("sync-issue")).iconColor).toBe(
      "error",
    );
    expect(repositoryStatusPresentation(null)).toMatchObject({
      key: "unknown",
      label: "Status",
      iconColor: "secondary",
    });
  });
});
