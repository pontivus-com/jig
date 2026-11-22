import { describe, expect, it } from "vitest";

import {
  formatSynchronizationDiagnostics,
  sanitizeSynchronizationErrorSummary,
  synchronizationHeadPrefix,
  type SynchronizationDiagnostics,
} from "../../src/protocol/runtime";

describe("synchronization diagnostics contract", () => {
  it("projects the exact stable support text in contract order", () => {
    const value: SynchronizationDiagnostics = {
      phase: "verify-remote",
      reason: "transport",
      retryable: true,
      attempt_count: 2,
      last_attempt_at: "2026-11-22T12:00:00.000Z",
      next_retry_at: "2026-11-22T12:00:10.000Z",
      local_head: "aaaaaaaaaaaa",
      remote_head: "bbbbbbbbbbbb",
      last_adopted_head: "cccccccccccc",
      lineage: "diverged",
      remote_name: "origin",
      remote_location: "https://example.invalid/team/jig.git",
      recovery_attempted: false,
      recovery_outcome: null,
      error_summary: "transport failed",
    };

    expect(formatSynchronizationDiagnostics(value)).toBe(
      [
        "phase: verify-remote",
        "reason: transport",
        "retryable: true",
        "attempt_count: 2",
        "last_attempt_at: 2026-11-22T12:00:00.000Z",
        "next_retry_at: 2026-11-22T12:00:10.000Z",
        "local_head: aaaaaaaaaaaa",
        "remote_head: bbbbbbbbbbbb",
        "last_adopted_head: cccccccccccc",
        "lineage: diverged",
        "remote_name: origin",
        "remote_location: https://example.invalid/team/jig.git",
        "recovery_attempted: false",
        "recovery_outcome: -",
        "error_summary: transport failed",
      ].join("\n"),
    );
  });

  it("normalizes safe head prefixes and refuses malformed object ids", () => {
    expect(
      synchronizationHeadPrefix("ABCDEF0123456789ABCDEF0123456789ABCDEF01"),
    ).toBe("abcdef012345");
    expect(synchronizationHeadPrefix("not-a-head")).toBeNull();
    expect(synchronizationHeadPrefix(null)).toBeNull();
  });

  it("redacts credential material, URL userinfo/query/fragment and planning-field values", () => {
    const summary = sanitizeSynchronizationErrorSummary(
      new Error(
        [
          "fetch https://alice:secret@example.invalid/team/jig.git?access_token=url-secret#fragment",
          "Authorization: Bearer header-secret",
          "access_token=access-secret",
          "refresh_token=refresh-secret",
          "client_secret=client-secret",
          "GIT_ASKPASS=/tmp/private-helper",
          "title=PrivateTask",
          "note='Private note'",
          "reference=https://example.invalid/private?token=reference-secret",
        ].join(" "),
      ),
    );

    for (const prohibited of [
      "alice",
      "secret@",
      "url-secret",
      "fragment",
      "header-secret",
      "access-secret",
      "refresh-secret",
      "client-secret",
      "/tmp/private-helper",
      "PrivateTask",
      "Private note",
      "reference-secret",
    ]) {
      expect(summary).not.toContain(prohibited);
    }
    expect(summary).toContain("https://example.invalid/team/jig.git");
    expect(summary).toContain("[redacted]");
  });
});
