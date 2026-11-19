import {
  assertRecurrenceState,
} from "./recurrence-planning";
import {
  validateRecurrenceSeries,
  type RecurrenceSeries,
} from "./recurrence";
import {
  validateTask,
  type Task,
} from "./task";

export interface CanonicalPlanning {
  readonly tasks: readonly Task[];
  readonly recurrences: readonly RecurrenceSeries[];
}

export interface ReconciliationConflict {
  readonly kind:
    | "task"
    | "recurrence"
    | "ordering"
    | "validation";
  readonly id: string | null;
  readonly field: string | null;
  readonly reason: string;
}

export type CanonicalReconciliation =
  | { readonly state: "merged"; readonly planning: CanonicalPlanning }
  | {
      readonly state: "conflict";
      readonly conflict: ReconciliationConflict;
      readonly reason: string;
    };

type Merge<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false };

const TASK_FIELDS = [
  "title",
  "scheduled_date",
  "priority",
  "context",
  "reference",
  "note",
  "reminder_time",
  "recurrence_series_id",
  "recurrence_occurrence_date",
  "completed_at",
] as const;

function same(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function mergeValue<T>(
  base: T,
  local: T,
  remote: T,
): Merge<T> {
  const localChanged = !same(local, base);
  const remoteChanged = !same(remote, base);
  return localChanged && remoteChanged && !same(local, remote)
    ? { ok: false }
    : {
        ok: true,
        value: localChanged ? local : remoteChanged ? remote : base,
      };
}

function latest(...values: readonly string[]): string {
  return [...values].sort().at(-1) ?? "";
}

function resultConflict(
  kind: ReconciliationConflict["kind"],
  reason: string,
  id: string | null = null,
  field: string | null = null,
): CanonicalReconciliation {
  return {
    state: "conflict",
    conflict: { kind, id, field, reason },
    reason,
  };
}

function equivalent(
  left: object,
  right: object,
): boolean {
  return same(
    { ...left, updated_at: "" },
    { ...right, updated_at: "" },
  );
}

function mergeTask(
  base: Task | undefined,
  local: Task | undefined,
  remote: Task | undefined,
): Task | ReconciliationConflict | null {
  if (base === undefined) {
    if (local === undefined || remote === undefined) {
      return local ?? remote ?? null;
    }
    return equivalent(local, remote)
      ? validateTask({
          ...local,
          updated_at: latest(local.updated_at, remote.updated_at),
        })
      : {
          kind: "task",
          id: local.id,
          field: null,
          reason: "UUID collision with different Task content",
        };
  }

  if (local === undefined || remote === undefined) {
    const survivor = local ?? remote;
    return survivor === undefined || equivalent(base, survivor)
      ? null
      : {
          kind: "task",
          id: base.id,
          field: null,
          reason: "Task deletion conflicts with modification",
        };
  }

  if (
    local.created_at !== base.created_at ||
    remote.created_at !== base.created_at
  ) {
    return {
      kind: "task",
      id: base.id,
      field: "created_at",
      reason: "Task immutable created_at changed",
    };
  }

  const baseValues: Readonly<Record<string, unknown>> = {
    ...base,
  };
  const localValues: Readonly<Record<string, unknown>> = {
    ...local,
  };
  const remoteValues: Readonly<Record<string, unknown>> = {
    ...remote,
  };
  const merged: Record<string, unknown> = {
    ...base,
    updated_at: latest(
      base.updated_at,
      local.updated_at,
      remote.updated_at,
    ),
  };

  for (const field of TASK_FIELDS) {
    const value = mergeValue(
      baseValues[field],
      localValues[field],
      remoteValues[field],
    );
    if (!value.ok) {
      return {
        kind: "task",
        id: base.id,
        field,
        reason: `Task ${base.id} has conflicting ${field} changes`,
      };
    }
    merged[field] = value.value;
  }

  merged.position =
    merged.completed_at === null
      ? base.position ?? local.position ?? remote.position ?? 0
      : null;
  return validateTask(merged);
}

function mergeRecurrence(
  base: RecurrenceSeries | undefined,
  local: RecurrenceSeries | undefined,
  remote: RecurrenceSeries | undefined,
): RecurrenceSeries | ReconciliationConflict | null {
  if (base === undefined) {
    if (local === undefined || remote === undefined) {
      return local ?? remote ?? null;
    }
    return equivalent(local, remote)
      ? validateRecurrenceSeries({
          ...local,
          updated_at: latest(local.updated_at, remote.updated_at),
        })
      : {
          kind: "recurrence",
          id: local.id,
          field: null,
          reason: "UUID collision with different recurrence content",
        };
  }

  if (local === undefined || remote === undefined) {
    const survivor = local ?? remote;
    return survivor === undefined || equivalent(base, survivor)
      ? null
      : {
          kind: "recurrence",
          id: base.id,
          field: null,
          reason: "Recurrence deletion conflicts with modification",
        };
  }

  if (
    local.created_at !== base.created_at ||
    remote.created_at !== base.created_at
  ) {
    return {
      kind: "recurrence",
      id: base.id,
      field: "created_at",
      reason: "Recurrence immutable created_at changed",
    };
  }

  const effectiveFrom = mergeValue(
    base.effective_from,
    local.effective_from,
    remote.effective_from,
  );
  const endDate = mergeValue(
    base.end_date,
    local.end_date,
    remote.end_date,
  );
  const pattern = mergeValue(
    base.pattern,
    local.pattern,
    remote.pattern,
  );

  for (const [field, value] of [
    ["effective_from", effectiveFrom],
    ["end_date", endDate],
    ["pattern", pattern],
  ] as const) {
    if (!value.ok) {
      return {
        kind: "recurrence",
        id: base.id,
        field,
        reason: `Recurrence ${base.id} has conflicting ${field} changes`,
      };
    }
  }

  if (!effectiveFrom.ok || !endDate.ok || !pattern.ok) {
    throw new Error("Unreachable recurrence reconciliation state");
  }
  return validateRecurrenceSeries({
    id: base.id,
    effective_from: effectiveFrom.value,
    end_date: endDate.value,
    pattern: pattern.value,
    created_at: base.created_at,
    updated_at: latest(
      base.updated_at,
      local.updated_at,
      remote.updated_at,
    ),
  });
}

function byId<T extends { readonly id: string }>(
  values: readonly T[],
): ReadonlyMap<string, T> {
  return new Map(values.map((value) => [value.id, value]));
}

function sequence(
  tasks: readonly Task[],
  date: string,
): readonly string[] {
  return tasks
    .filter(
      (task) =>
        task.completed_at === null &&
        task.scheduled_date === date,
    )
    .sort(
      (a, b) => (a.position ?? 0) - (b.position ?? 0),
    )
    .map((task) => task.id);
}

function relation(
  ids: readonly string[],
  left: string,
  right: string,
): -1 | 1 | null {
  const a = ids.indexOf(left);
  const b = ids.indexOf(right);
  return a < 0 || b < 0 ? null : a < b ? -1 : 1;
}

function mergeOrder(
  date: string,
  ids: readonly string[],
  baseTasks: readonly Task[],
  localTasks: readonly Task[],
  remoteTasks: readonly Task[],
  tasks: ReadonlyMap<string, Task>,
): readonly string[] | null {
  const base = sequence(baseTasks, date);
  const local = sequence(localTasks, date);
  const remote = sequence(remoteTasks, date);
  const edges = new Map<string, Set<string>>();
  const degree = new Map(ids.map((id) => [id, 0]));

  const add = (before: string, after: string): void => {
    const next = edges.get(before) ?? new Set<string>();
    if (next.has(after)) return;
    next.add(after);
    edges.set(before, next);
    degree.set(after, (degree.get(after) ?? 0) + 1);
  };

  for (let i = 0; i < ids.length; i += 1) {
    const left = ids[i];
    if (left === undefined) continue;
    for (let j = i + 1; j < ids.length; j += 1) {
      const right = ids[j];
      if (right === undefined) continue;
      const b = relation(base, left, right);
      const l = relation(local, left, right);
      const r = relation(remote, left, right);
      const lChanged = b !== null && l !== null && l !== b;
      const rChanged = b !== null && r !== null && r !== b;

      if (
        (b === null && l !== null && r !== null && l !== r) ||
        (lChanged && rChanged && l !== r)
      ) {
        return null;
      }

      const chosen =
        b === null ? l ?? r : lChanged ? l : rChanged ? r : b;
      if (chosen === -1) add(left, right);
      if (chosen === 1) add(right, left);
    }
  }

  const baseRank = new Map(base.map((id, i) => [id, i]));
  const compare = (left: string, right: string): number => {
    const a = baseRank.get(left);
    const b = baseRank.get(right);
    if (a !== undefined || b !== undefined) {
      if (a === undefined) return 1;
      if (b === undefined) return -1;
      if (a !== b) return a - b;
    }
    const x = tasks.get(left);
    const y = tasks.get(right);
    return x === undefined || y === undefined
      ? left.localeCompare(right)
      : x.created_at.localeCompare(y.created_at) ||
          left.localeCompare(right);
  };

  const ready = ids
    .filter((id) => (degree.get(id) ?? 0) === 0)
    .sort(compare);
  const result: string[] = [];
  while (ready.length > 0) {
    const id = ready.shift();
    if (id === undefined) break;
    result.push(id);
    for (const next of edges.get(id) ?? []) {
      degree.set(next, (degree.get(next) ?? 0) - 1);
      if (degree.get(next) === 0) {
        ready.push(next);
        ready.sort(compare);
      }
    }
  }
  return result.length === ids.length ? result : null;
}

function orderTasks(
  tasks: readonly Task[],
  base: readonly Task[],
  local: readonly Task[],
  remote: readonly Task[],
): readonly Task[] | null {
  const taskById = byId(tasks);
  const positions = new Map<string, number>();
  const dates = new Set(
    tasks
      .filter((task) => task.completed_at === null)
      .map((task) => task.scheduled_date),
  );

  for (const date of dates) {
    const ids = tasks
      .filter(
        (task) =>
          task.completed_at === null &&
          task.scheduled_date === date,
      )
      .map((task) => task.id);
    const merged = mergeOrder(
      date,
      ids,
      base,
      local,
      remote,
      taskById,
    );
    if (merged === null) return null;
    merged.forEach((id, position) => positions.set(id, position));
  }

  return tasks.map((task) =>
    validateTask({
      ...task,
      position:
        task.completed_at === null
          ? positions.get(task.id) ?? 0
          : null,
    }),
  );
}

export function canonicalPlanningEqual(
  left: CanonicalPlanning,
  right: CanonicalPlanning,
): boolean {
  return same(
    {
      tasks: [...left.tasks].sort((a, b) =>
        a.id.localeCompare(b.id),
      ),
      recurrences: [...left.recurrences].sort((a, b) =>
        a.id.localeCompare(b.id),
      ),
    },
    {
      tasks: [...right.tasks].sort((a, b) =>
        a.id.localeCompare(b.id),
      ),
      recurrences: [...right.recurrences].sort((a, b) =>
        a.id.localeCompare(b.id),
      ),
    },
  );
}

export function reconcileCanonicalPlanning(
  base: CanonicalPlanning,
  local: CanonicalPlanning,
  remote: CanonicalPlanning,
): CanonicalReconciliation {
  try {
    for (const state of [base, local, remote]) {
      assertRecurrenceState(state.tasks, state.recurrences);
    }

    const mergedTasks: Task[] = [];
    const baseTasks = byId(base.tasks);
    const localTasks = byId(local.tasks);
    const remoteTasks = byId(remote.tasks);
    for (
      const id of new Set([
        ...baseTasks.keys(),
        ...localTasks.keys(),
        ...remoteTasks.keys(),
      ])
    ) {
      const merged = mergeTask(
        baseTasks.get(id),
        localTasks.get(id),
        remoteTasks.get(id),
      );
      if (merged !== null && "kind" in merged) {
        return resultConflict(
          merged.kind,
          merged.reason,
          merged.id,
          merged.field,
        );
      }
      if (merged !== null) mergedTasks.push(merged);
    }

    const mergedRecurrences: RecurrenceSeries[] = [];
    const baseRecurrences = byId(base.recurrences);
    const localRecurrences = byId(local.recurrences);
    const remoteRecurrences = byId(remote.recurrences);
    for (
      const id of new Set([
        ...baseRecurrences.keys(),
        ...localRecurrences.keys(),
        ...remoteRecurrences.keys(),
      ])
    ) {
      const merged = mergeRecurrence(
        baseRecurrences.get(id),
        localRecurrences.get(id),
        remoteRecurrences.get(id),
      );
      if (merged !== null && "kind" in merged) {
        return resultConflict(
          merged.kind,
          merged.reason,
          merged.id,
          merged.field,
        );
      }
      if (merged !== null) mergedRecurrences.push(merged);
    }

    const ordered = orderTasks(
      mergedTasks,
      base.tasks,
      local.tasks,
      remote.tasks,
    );
    if (ordered === null) {
      return resultConflict(
        "ordering",
        "Combined Task ordering constraints conflict",
      );
    }
    assertRecurrenceState(ordered, mergedRecurrences);
    return {
      state: "merged",
      planning: {
        tasks: ordered,
        recurrences: mergedRecurrences,
      },
    };
  } catch (error) {
    return resultConflict(
      "validation",
      error instanceof Error
        ? error.message
        : "Canonical reconciliation failed validation",
    );
  }
}
