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
  if (
    localChanged &&
    remoteChanged &&
    !same(local, remote)
  ) {
    return { ok: false };
  }
  return {
    ok: true,
    value: localChanged ? local : remoteChanged ? remote : base,
  };
}

function latest(...values: readonly string[]): string {
  return [...values].sort().at(-1) ?? "";
}

function taskEquivalent(left: Task, right: Task): boolean {
  return same(
    { ...left, updated_at: "" },
    { ...right, updated_at: "" },
  );
}

function recurrenceEquivalent(
  left: RecurrenceSeries,
  right: RecurrenceSeries,
): boolean {
  return same(
    { ...left, updated_at: "" },
    { ...right, updated_at: "" },
  );
}

function conflict(
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

function mergeTask(
  base: Task | undefined,
  local: Task | undefined,
  remote: Task | undefined,
): Task | ReconciliationConflict | null {
  if (base === undefined) {
    if (local === undefined || remote === undefined) {
      return local ?? remote ?? null;
    }
    return taskEquivalent(local, remote)
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
    if (survivor === undefined || taskEquivalent(base, survivor)) {
      return null;
    }
    return {
      kind: "task",
      id: base.id,
      field: null,
      reason: "Task deletion conflicts with modification",
    };
  }

  const fields = {
    title: mergeValue(base.title, local.title, remote.title),
    scheduled_date: mergeValue(
      base.scheduled_date,
      local.scheduled_date,
      remote.scheduled_date,
    ),
    priority: mergeValue(base.priority, local.priority, remote.priority),
    context: mergeValue(base.context, local.context, remote.context),
    reference: mergeValue(
      base.reference,
      local.reference,
      remote.reference,
    ),
    note: mergeValue(base.note, local.note, remote.note),
    reminder_time: mergeValue(
      base.reminder_time,
      local.reminder_time,
      remote.reminder_time,
    ),
    recurrence_series_id: mergeValue(
      base.recurrence_series_id,
      local.recurrence_series_id,
      remote.recurrence_series_id,
    ),
    recurrence_occurrence_date: mergeValue(
      base.recurrence_occurrence_date,
      local.recurrence_occurrence_date,
      remote.recurrence_occurrence_date,
    ),
    completed_at: mergeValue(
      base.completed_at,
      local.completed_at,
      remote.completed_at,
    ),
  };

  for (const [field, result] of Object.entries(fields)) {
    if (!result.ok) {
      return {
        kind: "task",
        id: base.id,
        field,
        reason: `Task ${base.id} has conflicting ${field} changes`,
      };
    }
  }

  if (
    !fields.title.ok ||
    !fields.scheduled_date.ok ||
    !fields.priority.ok ||
    !fields.context.ok ||
    !fields.reference.ok ||
    !fields.note.ok ||
    !fields.reminder_time.ok ||
    !fields.recurrence_series_id.ok ||
    !fields.recurrence_occurrence_date.ok ||
    !fields.completed_at.ok
  ) {
    throw new Error("Unreachable Task reconciliation state");
  }

  return validateTask({
    id: base.id,
    title: fields.title.value,
    scheduled_date: fields.scheduled_date.value,
    position:
      fields.completed_at.value === null
        ? base.position ?? local.position ?? remote.position ?? 0
        : null,
    priority: fields.priority.value,
    context: fields.context.value,
    reference: fields.reference.value,
    note: fields.note.value,
    reminder_time: fields.reminder_time.value,
    recurrence_series_id: fields.recurrence_series_id.value,
    recurrence_occurrence_date:
      fields.recurrence_occurrence_date.value,
    completed_at: fields.completed_at.value,
    created_at: base.created_at,
    updated_at: latest(
      base.updated_at,
      local.updated_at,
      remote.updated_at,
    ),
  });
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
    return recurrenceEquivalent(local, remote)
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
    if (
      survivor === undefined ||
      recurrenceEquivalent(base, survivor)
    ) {
      return null;
    }
    return {
      kind: "recurrence",
      id: base.id,
      field: null,
      reason: "Recurrence deletion conflicts with modification",
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

  if (!effectiveFrom.ok) {
    return {
      kind: "recurrence",
      id: base.id,
      field: "effective_from",
      reason: `Recurrence ${base.id} has conflicting effective_from changes`,
    };
  }
  if (!endDate.ok) {
    return {
      kind: "recurrence",
      id: base.id,
      field: "end_date",
      reason: `Recurrence ${base.id} has conflicting end_date changes`,
    };
  }
  if (!pattern.ok) {
    return {
      kind: "recurrence",
      id: base.id,
      field: "pattern",
      reason: `Recurrence ${base.id} has conflicting pattern changes`,
    };
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

function indexById<T extends { readonly id: string }>(
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
      (left, right) =>
        (left.position ?? 0) - (right.position ?? 0),
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

function mergedOrder(
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
    const targets = edges.get(before) ?? new Set<string>();
    if (targets.has(after)) return;
    targets.add(after);
    edges.set(before, targets);
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

      if (b === null && l !== null && r !== null && l !== r) {
        return null;
      }
      if (lChanged && rChanged && l !== r) {
        return null;
      }

      const chosen =
        b === null
          ? l ?? r
          : lChanged
            ? l
            : rChanged
              ? r
              : b;
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
    if (x === undefined || y === undefined) {
      return left.localeCompare(right);
    }
    return (
      x.created_at.localeCompare(y.created_at) ||
      left.localeCompare(right)
    );
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
  const byId = indexById(tasks);
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
    const order = mergedOrder(
      date,
      ids,
      base,
      local,
      remote,
      byId,
    );
    if (order === null) return null;
    order.forEach((id, position) => positions.set(id, position));
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
  const tasks = (values: readonly Task[]) =>
    [...values].sort((a, b) => a.id.localeCompare(b.id));
  const recurrences = (values: readonly RecurrenceSeries[]) =>
    [...values].sort((a, b) => a.id.localeCompare(b.id));
  return (
    same(tasks(left.tasks), tasks(right.tasks)) &&
    same(
      recurrences(left.recurrences),
      recurrences(right.recurrences),
    )
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
    const baseTasks = indexById(base.tasks);
    const localTasks = indexById(local.tasks);
    const remoteTasks = indexById(remote.tasks);
    const taskIds = new Set([
      ...baseTasks.keys(),
      ...localTasks.keys(),
      ...remoteTasks.keys(),
    ]);

    for (const id of taskIds) {
      const result = mergeTask(
        baseTasks.get(id),
        localTasks.get(id),
        remoteTasks.get(id),
      );
      if (
        result !== null &&
        "kind" in result
      ) {
        return conflict(
          result.kind,
          result.reason,
          result.id,
          result.field,
        );
      }
      if (result !== null) mergedTasks.push(result);
    }

    const mergedRecurrences: RecurrenceSeries[] = [];
    const baseRecurrences = indexById(base.recurrences);
    const localRecurrences = indexById(local.recurrences);
    const remoteRecurrences = indexById(remote.recurrences);
    const recurrenceIds = new Set([
      ...baseRecurrences.keys(),
      ...localRecurrences.keys(),
      ...remoteRecurrences.keys(),
    ]);

    for (const id of recurrenceIds) {
      const result = mergeRecurrence(
        baseRecurrences.get(id),
        localRecurrences.get(id),
        remoteRecurrences.get(id),
      );
      if (
        result !== null &&
        "kind" in result
      ) {
        return conflict(
          result.kind,
          result.reason,
          result.id,
          result.field,
        );
      }
      if (result !== null) mergedRecurrences.push(result);
    }

    const ordered = orderTasks(
      mergedTasks,
      base.tasks,
      local.tasks,
      remote.tasks,
    );
    if (ordered === null) {
      return conflict(
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
    const reason =
      error instanceof Error
        ? error.message
        : "Canonical reconciliation failed validation";
    return conflict("validation", reason);
  }
}
