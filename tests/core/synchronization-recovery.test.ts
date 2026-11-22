import { describe, expect, it } from "vitest";

import {
  serializeSnapshot,
  type PortableSnapshot,
} from "../../src/core/portable";
import {
  type RecurrenceSeries,
  validateRecurrenceSeries,
} from "../../src/core/recurrence";
import {
  type Task,
  validateTask,
} from "../../src/core/task";
import {
  applyJigDataResolution,
  buildJigDataConflictCase,
  deriveJigDataDateOrders,
  jigDataConflictKey,
  reconcileRelatedPortableSnapshots,
  recoveryCommitSpec,
  validateJigDataConflictCase,
  validateJigDataResolution,
  type JigDataConflict,
  type JigDataConflictChoice,
  type JigDataResolution,
} from "../../src/core/synchronization-recovery";

const DATASET_ID = "018f47f0-7b5c-7d4d-8e2b-000000009999";
const DATE = "2026-11-22";
const NEXT_DATE = "2026-11-23";

const A = "018f47f0-7b5c-7d4d-8e2b-000000000001";
const B = "018f47f0-7b5c-7d4d-8e2b-000000000002";
const C = "018f47f0-7b5c-7d4d-8e2b-000000000003";
const T = "018f47f0-7b5c-7d4d-8e2b-000000000004";
const U = "018f47f0-7b5c-7d4d-8e2b-000000000005";
const S1 = "018f47f0-7b5c-7d4d-8e2b-000000000101";
const S2 = "018f47f0-7b5c-7d4d-8e2b-000000000102";

const ANCESTOR_HEAD = "a".repeat(40);
const LOCAL_HEAD = "b".repeat(40);
const REMOTE_HEAD = "c".repeat(40);

function task(
  id: string,
  title: string,
  position: number | null,
  changes: Partial<Task> = {},
): Task {
  return validateTask({
    id,
    title,
    scheduled_date: DATE,
    position,
    priority: "NORMAL",
    context: null,
    reference: null,
    note: null,
    reminder_time: null,
    recurrence_series_id: null,
    recurrence_occurrence_date: null,
    completed_at: null,
    created_at: "2026-11-22T00:00:00.000Z",
    updated_at: "2026-11-22T00:00:00.000Z",
    ...changes,
  });
}

function recurrence(
  id: string,
  changes: Partial<RecurrenceSeries> = {},
): RecurrenceSeries {
  return validateRecurrenceSeries({
    id,
    effective_from: DATE,
    end_date: "2026-12-31",
    pattern: {
      kind: "weekly",
      interval_weeks: 1,
      weekdays: ["SUN"],
    },
    created_at: "2026-11-22T00:00:00.000Z",
    updated_at: "2026-11-22T00:00:00.000Z",
    ...changes,
  });
}

function snapshot(
  tasks: readonly Task[],
  recurrences: readonly RecurrenceSeries[] = [],
): PortableSnapshot {
  return serializeSnapshot(tasks, DATASET_ID, recurrences);
}

function conflictCase(
  ancestor: PortableSnapshot,
  local: PortableSnapshot,
  remote: PortableSnapshot,
) {
  const value = buildJigDataConflictCase(
    ANCESTOR_HEAD,
    LOCAL_HEAD,
    REMOTE_HEAD,
    7,
    ancestor,
    local,
    remote,
  );
  if (value === null) {
    throw new Error("Expected a Jig data conflict case");
  }
  return value;
}

function onlyConflict(
  conflicts: readonly JigDataConflict[],
): JigDataConflict {
  const conflict = conflicts[0];
  if (conflicts.length !== 1 || conflict === undefined) {
    throw new Error("Expected exactly one Jig data conflict");
  }
  return conflict;
}

function resolution(
  choices: readonly JigDataConflictChoice[],
  dateOrders: readonly {
    readonly date: string;
    readonly task_ids: readonly string[];
  }[],
): JigDataResolution {
  return {
    ancestor_head: ANCESTOR_HEAD,
    local_head: LOCAL_HEAD,
    remote_head: REMOTE_HEAD,
    expected_revision: 7,
    choices,
    date_orders: dateOrders,
  };
}

describe("related Jig-data reconciliation", () => {
  it("merges independent canonical-record changes without field synthesis", () => {
    const baseA = task(A, "A", 0);
    const baseB = task(B, "B", 1);
    const ancestor = snapshot([baseA, baseB]);
    const local = snapshot([
      task(A, "Local A", 0, {
        updated_at: "2026-11-22T01:00:00.000Z",
      }),
      baseB,
    ]);
    const remote = snapshot([
      baseA,
      task(B, "B", 1, {
        note: "Remote note",
        updated_at: "2026-11-22T02:00:00.000Z",
      }),
    ]);

    const result = reconcileRelatedPortableSnapshots(
      ancestor,
      local,
      remote,
    );
    expect(result.kind).toBe("resolved");
    if (result.kind !== "resolved") return;

    expect(result.snapshot.tasks).toMatchObject([
      {
        id: A,
        title: "Local A",
        note: null,
      },
      {
        id: B,
        title: "B",
        note: "Remote note",
      },
    ]);
  });

  it("classifies modify-versus-delete as one standalone Task conflict", () => {
    const base = task(A, "Base", 0);
    const ancestor = snapshot([base]);
    const local = snapshot([]);
    const remote = snapshot([
      task(A, "Remote edit", 0, {
        updated_at: "2026-11-22T02:00:00.000Z",
      }),
    ]);

    const result = reconcileRelatedPortableSnapshots(
      ancestor,
      local,
      remote,
    );
    expect(result.kind).toBe("semantic-conflict");
    if (result.kind !== "semantic-conflict") return;
    expect(result.conflicts).toHaveLength(1);
    const conflict = onlyConflict(result.conflicts);
    expect(conflict).toMatchObject({
      kind: "task",
      task_id: A,
      local: null,
    });
    expect(jigDataConflictKey(conflict)).toBe(`task:${A}`);
  });

  it("groups recurrence reassociation and connected Tasks into one family conflict", () => {
    const series1 = recurrence(S1);
    const series2 = recurrence(S2, {
      created_at: "2026-11-22T01:00:00.000Z",
      updated_at: "2026-11-22T01:00:00.000Z",
    });
    const baseT = task(T, "Recurring T", 0, {
      recurrence_series_id: S1,
      recurrence_occurrence_date: DATE,
    });
    const baseU = task(U, "Recurring U", 0, {
      scheduled_date: NEXT_DATE,
      recurrence_series_id: S1,
      recurrence_occurrence_date: NEXT_DATE,
    });
    const ancestor = snapshot([baseT, baseU], [series1]);
    const local = snapshot([
      task(T, "Recurring T", 0, {
        recurrence_series_id: S2,
        recurrence_occurrence_date: DATE,
        updated_at: "2026-11-22T02:00:00.000Z",
      }),
      baseU,
    ], [series1, series2]);
    const remote = snapshot([
      task(T, "Remote T", 0, {
        recurrence_series_id: S1,
        recurrence_occurrence_date: DATE,
        updated_at: "2026-11-22T03:00:00.000Z",
      }),
      baseU,
    ], [series1]);

    const value = conflictCase(ancestor, local, remote);
    expect(value.conflicts).toHaveLength(1);
    const conflict = onlyConflict(value.conflicts);
    expect(conflict).toMatchObject({
      kind: "recurrence-family",
      recurrence_series_ids: [S1, S2],
    });
    if (conflict?.kind !== "recurrence-family") return;
    expect(conflict.local.tasks.map((candidate) => candidate.id)).toEqual([
      T,
      U,
    ]);
    expect(conflict.remote.tasks.map((candidate) => candidate.id)).toEqual([
      T,
      U,
    ]);
    expect(jigDataConflictKey(conflict)).toBe(
      `recurrence:${S1}+${S2}`,
    );
  });

  it("keeps completed Tasks out of affected-date ordering and preserves position null", () => {
    const baseA = task(A, "A", 0);
    const baseB = task(B, "B", 1);
    const ancestor = snapshot([baseA, baseB]);
    const local = snapshot([
      task(A, "A", null, {
        completed_at: "2026-11-22T02:00:00.000Z",
        updated_at: "2026-11-22T02:00:00.000Z",
      }),
      task(B, "B", 0, {
        updated_at: "2026-11-22T02:00:00.000Z",
      }),
    ]);
    const remote = snapshot([
      task(A, "Remote A", 0, {
        updated_at: "2026-11-22T03:00:00.000Z",
      }),
      baseB,
    ]);
    const value = conflictCase(ancestor, local, remote);
    const key = jigDataConflictKey(onlyConflict(value.conflicts));
    const choices = [{ conflict_key: key, side: "local" }] as const;
    const orders = deriveJigDataDateOrders(value, choices);

    expect(orders).toStrictEqual([
      {
        date: DATE,
        task_ids: [B],
      },
    ]);
    if (orders === null) return;

    const result = applyJigDataResolution(
      value,
      resolution(choices, orders),
    );
    expect(result.kind).toBe("resolved");
    if (result.kind !== "resolved") return;
    expect(
      result.snapshot.tasks.find((candidate) => candidate.id === A),
    ).toMatchObject({
      completed_at: "2026-11-22T02:00:00.000Z",
      position: null,
    });
    expect(
      result.snapshot.tasks.find((candidate) => candidate.id === B),
    ).toMatchObject({
      completed_at: null,
      position: 0,
    });
  });

  it("does not expose a resolver for an unresolvable combined recurrence invariant", () => {
    const series = recurrence(S1);
    const baseT = task(T, "T", 0, {
      recurrence_series_id: S1,
      recurrence_occurrence_date: DATE,
    });
    const baseU = task(U, "U", 1, {
      recurrence_series_id: S1,
      recurrence_occurrence_date: DATE,
    });
    const ancestor = snapshot([baseT, baseU], [series]);
    const local = snapshot([
      task(T, "T", 0, {
        recurrence_series_id: null,
        recurrence_occurrence_date: null,
        updated_at: "2026-11-22T01:00:00.000Z",
      }),
      baseU,
    ], [series]);
    const remote = snapshot([baseT], [series]);

    const automatic = reconcileRelatedPortableSnapshots(
      ancestor,
      local,
      remote,
    );
    expect(automatic).toStrictEqual({
      kind: "semantic-conflict",
      conflicts: [],
    });
    expect(
      buildJigDataConflictCase(
        ANCESTOR_HEAD,
        LOCAL_HEAD,
        REMOTE_HEAD,
        7,
        ancestor,
        local,
        remote,
      ),
    ).toBeNull();
  });

  it("repairs only user-confirmed ordering when independent additions collide on position", () => {
    const baseA = task(A, "A", 0);
    const ancestor = snapshot([baseA]);
    const local = snapshot([
      baseA,
      task(B, "Local addition", 1, {
        created_at: "2026-11-22T01:00:00.000Z",
        updated_at: "2026-11-22T01:00:00.000Z",
      }),
    ]);
    const remote = snapshot([
      baseA,
      task(C, "Remote addition", 1, {
        created_at: "2026-11-22T02:00:00.000Z",
        updated_at: "2026-11-22T02:00:00.000Z",
      }),
    ]);

    const automatic = reconcileRelatedPortableSnapshots(
      ancestor,
      local,
      remote,
    );
    expect(automatic).toStrictEqual({
      kind: "semantic-conflict",
      conflicts: [],
    });

    const value = conflictCase(ancestor, local, remote);
    expect(value.conflicts).toEqual([]);
    const orders = deriveJigDataDateOrders(value, []);
    expect(orders).toStrictEqual([
      {
        date: DATE,
        task_ids: [A, B, C],
      },
    ]);
    if (orders === null) return;

    const result = applyJigDataResolution(
      value,
      resolution([], orders),
    );
    expect(result.kind).toBe("resolved");
    if (result.kind !== "resolved") return;
    expect(
      result.snapshot.tasks.map((candidate) => [
        candidate.id,
        candidate.position,
      ]),
    ).toEqual([
      [A, 0],
      [B, 1],
      [C, 2],
    ]);
  });
});

describe("Jig-data recovery boundaries", () => {
  it("rejects boundary arrays that are not canonically ordered instead of repairing them", () => {
    const ancestor = snapshot([
      task(A, "A", 0),
      task(B, "B", 1),
    ]);
    const local = snapshot([
      task(A, "Local A", 0, {
        updated_at: "2026-11-22T01:00:00.000Z",
      }),
      task(B, "B", 1),
    ]);
    const remote = snapshot([
      task(A, "Remote A", 0, {
        updated_at: "2026-11-22T02:00:00.000Z",
      }),
      task(B, "B", 1),
    ]);
    const value = conflictCase(ancestor, local, remote);

    expect(() =>
      validateJigDataConflictCase({
        ...value,
        local_tasks: [...value.local_tasks].reverse(),
      })
    ).toThrow(/canonically ordered/i);
  });

  it("rejects extra resolution fields and duplicate date-order Tasks", () => {
    const base = task(A, "Base", 0);
    const ancestor = snapshot([base]);
    const local = snapshot([]);
    const remote = snapshot([
      task(A, "Remote edit", 0, {
        updated_at: "2026-11-22T02:00:00.000Z",
      }),
    ]);
    const value = conflictCase(ancestor, local, remote);
    const key = jigDataConflictKey(onlyConflict(value.conflicts));

    expect(() =>
      validateJigDataResolution({
        ...resolution(
          [{ conflict_key: key, side: "remote" }],
          [{ date: DATE, task_ids: [A] }],
        ),
        extra: true,
      })
    ).toThrow(/unexpected fields/i);

    expect(() =>
      validateJigDataResolution(
        resolution(
          [{ conflict_key: key, side: "remote" }],
          [{ date: DATE, task_ids: [A, A] }],
        ),
      )
    ).toThrow(/unique/i);
  });

  it("derives the same deterministic commit spec when local and remote roles reverse", () => {
    const first = recoveryCommitSpec(
      "automatic",
      LOCAL_HEAD,
      10,
      REMOTE_HEAD,
      20,
    );
    const reversed = recoveryCommitSpec(
      "automatic",
      REMOTE_HEAD,
      20,
      LOCAL_HEAD,
      10,
    );
    expect(reversed).toStrictEqual(first);
    expect(first).toStrictEqual({
      parents: [LOCAL_HEAD, REMOTE_HEAD],
      name: "Jig",
      email: "jig@local.invalid",
      timestamp_seconds: 21,
      timezone_offset_minutes: 0,
      message: "Reconcile Jig data",
    });
    expect(
      recoveryCommitSpec(
        "user-resolved",
        LOCAL_HEAD,
        10,
        REMOTE_HEAD,
        20,
      ).message,
    ).toBe("Resolve Jig sync conflict");
  });
});
