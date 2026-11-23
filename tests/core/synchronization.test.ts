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
    expect(decide({ kind: "no-remote" })).toBe("local-only");
    expect(decide({ kind: "no-remote" })).toBe("local-only");
  });

  it("publishes an initially absent remote branch but never recreates a previously synchronized one", () => {
    expect(decide({
      kind: "remote-absent",
      previously_synchronized: false,
    })).toBe("push-local");
    expect(decide({
      kind: "remote-absent",
      previously_synchronized: false,
    })).toBe("push-local");
    expect(decide({
      kind: "remote-absent",
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
    expect(decide({
      kind: "unsafe-remote",
      reason: "invalid-snapshot",
    })).toBe("attention");
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
  it("classifies attention reasons in the functional core", () => {
    expect(decideSynchronization({ kind: "remote-ambiguous" })).toStrictEqual({
      kind: "attention",
      reason: "remote-ambiguous",
    });
    expect(decideSynchronization({
      kind: "remote-absent",
      previously_synchronized: true,
    })).toStrictEqual({
      kind: "attention",
      reason: "remote-absent-after-sync",
    });
    expect(decideSynchronization({
      kind: "unsafe-remote",
      reason: "dataset-mismatch",
    })).toStrictEqual({
      kind: "attention",
      reason: "dataset-mismatch",
    });
    expect(decideSynchronization({
      kind: "remote-present",
      local_pending: false,
      remote_rewritten: true,
      lineage: "equal",
    })).toStrictEqual({
      kind: "attention",
      reason: "remote-rewritten",
    });
    expect(decideSynchronization({
      kind: "remote-present",
      local_pending: true,
      remote_rewritten: false,
      lineage: "remote-ahead",
    })).toStrictEqual({
      kind: "attention",
      reason: "diverged",
    });
    expect(decideSynchronization({
      kind: "remote-present",
      local_pending: false,
      remote_rewritten: false,
      lineage: "diverged",
    })).toStrictEqual({
      kind: "attention",
      reason: "diverged",
    });
    expect(decideSynchronization({
      kind: "remote-present",
      local_pending: false,
      remote_rewritten: false,
      lineage: "unknown",
    })).toStrictEqual({
      kind: "attention",
      reason: "ancestry-unknown",
    });
  });

});
