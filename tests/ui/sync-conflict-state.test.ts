import { describe, expect, it } from "vitest";

import { serializeSnapshot } from "../../src/core/portable";
import { validateTask, type Task } from "../../src/core/task";
import {
  buildJigDataConflictCase,
  jigDataConflictKey,
} from "../../src/core/synchronization-recovery";
import {
  createSyncConflictDraft,
  reduceSyncConflictDraft,
  syncConflictPreview,
  syncConflictResolution,
} from "../../ui/src/sync-conflict-state";

const DATASET_ID = "018f47f0-7b5c-7d4d-8e2b-000000009998";
const DATE = "2026-11-22";
const A = "018f47f0-7b5c-7d4d-8e2b-000000000201";
const B = "018f47f0-7b5c-7d4d-8e2b-000000000202";

function task(
  id: string,
  title: string,
  position: number,
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

function conflictCase() {
  const baseA = task(A, "Base A", 0);
  const baseB = task(B, "B", 1);
  const value = buildJigDataConflictCase(
    "a".repeat(40),
    "b".repeat(40),
    "c".repeat(40),
    11,
    serializeSnapshot([baseA, baseB], DATASET_ID),
    serializeSnapshot([
      task(A, "Local A", 0, {
        updated_at: "2026-11-22T01:00:00.000Z",
      }),
      baseB,
    ], DATASET_ID),
    serializeSnapshot([
      task(A, "Remote A", 0, {
        note: "remote",
        updated_at: "2026-11-22T02:00:00.000Z",
      }),
      baseB,
    ], DATASET_ID),
  );
  if (value === null) {
    throw new Error("Expected conflict case");
  }
  return value;
}

describe("synchronization conflict draft state", () => {
  it("owns the active case and delegates preview semantics to the core", () => {
    const conflict = conflictCase();
    const key = jigDataConflictKey(conflict.conflicts[0]!);
    const initial = createSyncConflictDraft(conflict);

    expect(initial.conflict_case).toBe(conflict);
    expect(initial.step).toBe("choices");
    expect(syncConflictPreview(initial)).toBeNull();

    const chosen = reduceSyncConflictDraft(initial, {
      type: "select-side",
      conflict_key: key,
      side: "local",
    });
    expect(chosen.step).toBe("order-review");
    expect(syncConflictPreview(chosen)?.tasks).toMatchObject([
      { id: A, title: "Local A" },
      { id: B, title: "B" },
    ]);
  });

  it("keeps order edits ephemeral and requires explicit review", () => {
    const conflict = conflictCase();
    const key = jigDataConflictKey(conflict.conflicts[0]!);
    const chosen = reduceSyncConflictDraft(
      createSyncConflictDraft(conflict),
      {
        type: "select-side",
        conflict_key: key,
        side: "local",
      },
    );
    expect(chosen.date_orders.get(DATE)).toEqual([A, B]);
    expect(syncConflictResolution(chosen)).toBeNull();

    const moved = reduceSyncConflictDraft(chosen, {
      type: "move-date-task",
      date: DATE,
      task_id: B,
      direction: "up",
    });
    expect(moved.date_orders.get(DATE)).toEqual([B, A]);
    expect(syncConflictResolution(moved)).toBeNull();

    const confirmed = reduceSyncConflictDraft(moved, {
      type: "confirm-date-order",
      date: DATE,
    });
    expect(confirmed.step).toBe("confirm");
    expect(syncConflictResolution(confirmed)).toMatchObject({
      ancestor_head: conflict.ancestor_head,
      local_head: conflict.local_head,
      remote_head: conflict.remote_head,
      expected_revision: 11,
      choices: [{ conflict_key: key, side: "local" }],
      date_orders: [{ date: DATE, task_ids: [B, A] }],
    });
    expect(syncConflictPreview(confirmed)?.tasks).toMatchObject([
      { id: A, position: 1 },
      { id: B, position: 0 },
    ]);
  });

  it("drops stale order confirmation when a whole-side choice changes", () => {
    const conflict = conflictCase();
    const key = jigDataConflictKey(conflict.conflicts[0]!);
    const confirmed = reduceSyncConflictDraft(
      reduceSyncConflictDraft(
        createSyncConflictDraft(conflict),
        {
          type: "select-side",
          conflict_key: key,
          side: "local",
        },
      ),
      {
        type: "confirm-date-order",
        date: DATE,
      },
    );
    expect(confirmed.step).toBe("confirm");

    const changed = reduceSyncConflictDraft(confirmed, {
      type: "select-side",
      conflict_key: key,
      side: "remote",
    });
    expect(changed.step).toBe("order-review");
    expect(changed.confirmed_date_orders.size).toBe(0);
    expect(syncConflictResolution(changed)).toBeNull();
    expect(syncConflictPreview(changed)?.tasks[0]).toMatchObject({
      id: A,
      title: "Remote A",
      note: "remote",
    });
  });

  it("preserves technical disclosure independently from semantic choices", () => {
    const conflict = conflictCase();
    const key = jigDataConflictKey(conflict.conflicts[0]!);
    const initial = createSyncConflictDraft(conflict);
    const opened = reduceSyncConflictDraft(initial, {
      type: "toggle-technical-details",
      conflict_key: key,
    });
    expect(opened.technical_details.has(key)).toBe(true);

    const chosen = reduceSyncConflictDraft(opened, {
      type: "select-side",
      conflict_key: key,
      side: "local",
    });
    expect(chosen.technical_details.has(key)).toBe(true);
  });
});
