import { describe, expect, it } from "vitest";
import {
  decideSynchronization,
  type SynchronizationFacts,
} from "../../src/core/synchronization";

function decide(facts: SynchronizationFacts): string {
  return decideSynchronization(facts).kind;
}

describe("synchronization decision core", () => {
  it("keeps an unconfigured repository local-only", () => {
    expect(decide({
      kind: "no-remote",
      local_pending: false,
    })).toBe("local-only");
    expect(decide({
      kind: "no-remote",
      local_pending: true,
    })).toBe("local-only");
  });

  it("publishes an initially absent remote branch but never recreates a previously synchronized one", () => {
    expect(decide({
      kind: "remote-absent",
      local_pending: false,
      previously_synchronized: false,
    })).toBe("push-local");
    expect(decide({
      kind: "remote-absent",
      local_pending: true,
      previously_synchronized: false,
    })).toBe("push-local");
    expect(decide({
      kind: "remote-absent",
      local_pending: false,
      previously_synchronized: true,
    })).toBe("attention");
  });

  it("handles equal, remote-ahead and local-ahead histories exactly once", () => {
    expect(decide({
      kind: "remote-present",
      local_pending: false,
      remote_rewritten: false,
      lineage: "equal",
    })).toBe("synchronized");
    expect(decide({
      kind: "remote-present",
      local_pending: true,
      remote_rewritten: false,
      lineage: "equal",
    })).toBe("push-local");
    expect(decide({
      kind: "remote-present",
      local_pending: false,
      remote_rewritten: false,
      lineage: "remote-ahead",
    })).toBe("adopt-remote");
    expect(decide({
      kind: "remote-present",
      local_pending: true,
      remote_rewritten: false,
      lineage: "remote-ahead",
    })).toBe("attention");
    expect(decide({
      kind: "remote-present",
      local_pending: false,
      remote_rewritten: false,
      lineage: "local-ahead",
    })).toBe("push-local");
  });

  it("stops on rewritten, divergent, unknown or otherwise unsafe remote state", () => {
    expect(decide({ kind: "unsafe-remote" })).toBe("attention");
    expect(decide({
      kind: "remote-present",
      local_pending: false,
      remote_rewritten: true,
      lineage: "equal",
    })).toBe("attention");
    expect(decide({
      kind: "remote-present",
      local_pending: false,
      remote_rewritten: false,
      lineage: "diverged",
    })).toBe("attention");
    expect(decide({
      kind: "remote-present",
      local_pending: false,
      remote_rewritten: false,
      lineage: "unknown",
    })).toBe("attention");
  });
});
