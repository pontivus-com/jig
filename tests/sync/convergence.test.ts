import { describe, expect, it } from "vitest";
import type { RecurrenceSeries } from "../../src/core/recurrence";
import type { Task } from "../../src/core/task";
import {
  decideSynchronization,
  reconcileCanonicalPlanning,
} from "../../src/synchronization";

function task(
  suffix: string,
  title: string,
  position: number,
  overrides: Partial<Task> = {},
): Task {
  return {
    id: `018f47f0-7b5c-7d4d-8e2b-${suffix.padStart(12, "0")}`,
    title,
    scheduled_date: "2026-11-19",
    position,
    priority: "NORMAL",
    context: null,
    reference: null,
    note: null,
    reminder_time: null,
    recurrence_series_id: null,
    recurrence_occurrence_date: null,
    completed_at: null,
    created_at: "2026-11-19T01:00:00.000Z",
    updated_at: "2026-11-19T01:00:00.000Z",
    ...overrides,
  };
}

describe("synchronization decision semantics", () => {
  it("distinguishes ordinary stale-client convergence from conflict", () => {
    expect(
      decideSynchronization({
        remote: "present",
        previously_observed_remote: true,
        remote_rewritten: false,
        lineage: "remote-ahead",
        local_pending: false,
        canonical_matches_remote: false,
        base_available: true,
      }),
    ).toBe("adopt-remote");

    expect(
      decideSynchronization({
        remote: "present",
        previously_observed_remote: true,
        remote_rewritten: false,
        lineage: "remote-ahead",
        local_pending: true,
        canonical_matches_remote: false,
        base_available: true,
      }),
    ).toBe("reconcile");

    expect(
      decideSynchronization({
        remote: "present",
        previously_observed_remote: true,
        remote_rewritten: false,
        lineage: "diverged",
        local_pending: true,
        canonical_matches_remote: true,
        base_available: true,
      }),
    ).toBe("normalize-to-remote");
  });

  it("fails safely for unknown ancestry and incompatible rewrites", () => {
    expect(
      decideSynchronization({
        remote: "present",
        previously_observed_remote: true,
        remote_rewritten: false,
        lineage: "unknown",
        local_pending: false,
        canonical_matches_remote: true,
        base_available: false,
      }),
    ).toBe("needs-attention");

    expect(
      decideSynchronization({
        remote: "present",
        previously_observed_remote: true,
        remote_rewritten: true,
        lineage: "diverged",
        local_pending: false,
        canonical_matches_remote: false,
        base_available: true,
      }),
    ).toBe("needs-attention");
  });
});

describe("canonical planning reconciliation", () => {
  it("combines non-conflicting fields on the same Task", () => {
    const baseTask = task("101", "Base", 0);
    const result = reconcileCanonicalPlanning(
      { tasks: [baseTask], recurrences: [] },
      {
        tasks: [{
          ...baseTask,
          title: "Local title",
          updated_at: "2026-11-19T02:00:00.000Z",
        }],
        recurrences: [],
      },
      {
        tasks: [{
          ...baseTask,
          note: "remote note",
          updated_at: "2026-11-19T03:00:00.000Z",
        }],
        recurrences: [],
      },
    );

    expect(result).toMatchObject({ state: "merged" });
    if (result.state !== "merged") {
      throw new Error(result.reason);
    }
    expect(result.planning.tasks[0]).toMatchObject({
      title: "Local title",
      note: "remote note",
      updated_at: "2026-11-19T03:00:00.000Z",
    });
  });

  it("rejects contradictory changes to one semantic field", () => {
    const baseTask = task("102", "Base", 0);
    const result = reconcileCanonicalPlanning(
      { tasks: [baseTask], recurrences: [] },
      {
        tasks: [{
          ...baseTask,
          title: "Local",
          updated_at: "2026-11-19T02:00:00.000Z",
        }],
        recurrences: [],
      },
      {
        tasks: [{
          ...baseTask,
          title: "Remote",
          updated_at: "2026-11-19T03:00:00.000Z",
        }],
        recurrences: [],
      },
    );

    expect(result).toMatchObject({
      state: "conflict",
      reason: expect.stringContaining("conflicting title"),
    });
  });

  it("handles deletion without using last-writer-wins", () => {
    const baseTask = task("103", "Delete candidate", 0);
    const deletion = reconcileCanonicalPlanning(
      { tasks: [baseTask], recurrences: [] },
      { tasks: [], recurrences: [] },
      { tasks: [baseTask], recurrences: [] },
    );
    expect(deletion).toStrictEqual({
      state: "merged",
      planning: { tasks: [], recurrences: [] },
    });

    const conflict = reconcileCanonicalPlanning(
      { tasks: [baseTask], recurrences: [] },
      { tasks: [], recurrences: [] },
      {
        tasks: [{
          ...baseTask,
          note: "modified remotely",
          updated_at: "2026-11-19T02:00:00.000Z",
        }],
        recurrences: [],
      },
    );
    expect(conflict).toMatchObject({
      state: "conflict",
      reason: expect.stringContaining(
        "deleted locally and modified remotely",
      ),
    });
  });

  it("preserves independently created Tasks and orders unconstrained peers deterministically", () => {
    const existing = task("104", "Existing", 0);
    const local = task("105", "Local new", 1, {
      created_at: "2026-11-19T02:00:00.000Z",
      updated_at: "2026-11-19T02:00:00.000Z",
    });
    const remote = task("106", "Remote new", 1, {
      created_at: "2026-11-19T03:00:00.000Z",
      updated_at: "2026-11-19T03:00:00.000Z",
    });
    const result = reconcileCanonicalPlanning(
      { tasks: [existing], recurrences: [] },
      { tasks: [existing, local], recurrences: [] },
      { tasks: [existing, remote], recurrences: [] },
    );

    if (result.state !== "merged") {
      throw new Error(result.reason);
    }
    expect(
      [...result.planning.tasks]
        .sort(
          (left, right) =>
            (left.position ?? 0) - (right.position ?? 0),
        )
        .map((candidate) => candidate.title),
    ).toEqual(["Existing", "Local new", "Remote new"]);
  });

  it("rejects incompatible ordering constraints instead of inventing an order", () => {
    const a = task("107", "A", 0);
    const b = task("108", "B", 1);
    const c = task("109", "C", 2);
    const local = [
      { ...b, position: 0 },
      { ...a, position: 1 },
      { ...c, position: 2 },
    ];
    const remote = [
      { ...a, position: 0 },
      { ...c, position: 1 },
      { ...b, position: 2 },
    ];

    expect(
      reconcileCanonicalPlanning(
        { tasks: [a, b, c], recurrences: [] },
        { tasks: local, recurrences: [] },
        { tasks: remote, recurrences: [] },
      ),
    ).toMatchObject({
      state: "conflict",
      reason: expect.stringContaining("Ordering conflict"),
    });
  });

  it("rejects incompatible recurrence-series changes after record-level merge", () => {
    const seriesId =
      "018f47f0-7b5c-7d4d-8e2b-9c3aa11f2001";
    const series: RecurrenceSeries = {
      id: seriesId,
      effective_from: "2026-11-19",
      end_date: "2026-11-30",
      pattern: {
        kind: "weekly",
        interval_weeks: 1,
        weekdays: ["THU"],
      },
      created_at: "2026-11-19T01:00:00.000Z",
      updated_at: "2026-11-19T01:00:00.000Z",
    };
    const linked = task("110", "Recurring", 0, {
      recurrence_series_id: seriesId,
      recurrence_occurrence_date: "2026-11-19",
    });

    expect(
      reconcileCanonicalPlanning(
        { tasks: [linked], recurrences: [series] },
        {
          tasks: [linked],
          recurrences: [{
            ...series,
            end_date: "2026-12-07",
            updated_at: "2026-11-19T02:00:00.000Z",
          }],
        },
        {
          tasks: [linked],
          recurrences: [{
            ...series,
            end_date: "2026-12-14",
            updated_at: "2026-11-19T03:00:00.000Z",
          }],
        },
      ),
    ).toMatchObject({
      state: "conflict",
      reason: expect.stringContaining("end_date"),
    });
  });
});
