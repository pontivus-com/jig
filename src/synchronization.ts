import type { CanonicalState } from "./protocol";
import {
  assertRecurrenceState,
} from "./core/recurrence-planning";
import {
  validateRecurrenceSeries,
  type RecurrencePattern,
  type RecurrenceSeries,
} from "./core/recurrence";
import {
  validateTask,
  type Task,
} from "./core/task";

export const SYNCHRONIZATION_RETRY_SECONDS = [
  5,
  10,
  20,
  40,
  80,
  160,
  300,
] as const;

export const SYNCHRONIZATION_HEALTHY_POLL_MS = 60_000;

export function synchronizationRetryDelayMs(
  failureCount: number,
): number {
  if (!Number.isInteger(failureCount) || failureCount < 1) {
    throw new Error("failureCount must be a positive integer");
  }
  const index = Math.min(
    failureCount - 1,
    SYNCHRONIZATION_RETRY_SECONDS.length - 1,
  );
  return (
    SYNCHRONIZATION_RETRY_SECONDS[index] ??
    SYNCHRONIZATION_RETRY_SECONDS[
      SYNCHRONIZATION_RETRY_SECONDS.length - 1
    ] ??
    300
  ) * 1000;
}

export type GitLineage =
  | "equal"
  | "remote-ahead"
  | "local-ahead"
  | "diverged"
  | "unknown";

export type SynchronizationDecision =
  | "local-only"
  | "initialize-remote"
  | "synchronized"
  | "export-and-push"
  | "adopt-remote"
  | "reconcile"
  | "normalize-to-remote"
  | "needs-attention";

export interface SynchronizationFacts {
  readonly remote:
    | "absent"
    | "present"
    | "ambiguous";
  readonly previously_observed_remote: boolean;
  readonly remote_rewritten: boolean;
  readonly lineage: GitLineage;
  readonly local_pending: boolean;
  readonly canonical_matches_remote: boolean;
  readonly base_available: boolean;
}

export function decideSynchronization(
  facts: SynchronizationFacts,
): SynchronizationDecision {
  if (facts.remote === "ambiguous") {
    return "needs-attention";
  }
  if (facts.remote === "absent") {
    return facts.previously_observed_remote
      ? "needs-attention"
      : "local-only";
  }
  if (facts.remote_rewritten) {
    return facts.canonical_matches_remote
      ? "normalize-to-remote"
      : "needs-attention";
  }
  if (facts.lineage === "unknown") {
    return "needs-attention";
  }
  if (facts.lineage === "equal") {
    return facts.local_pending
      ? "export-and-push"
      : "synchronized";
  }
  if (facts.lineage === "remote-ahead") {
    if (facts.canonical_matches_remote) {
      return "normalize-to-remote";
    }
    if (!facts.local_pending) {
      return "adopt-remote";
    }
    return facts.base_available
      ? "reconcile"
      : "needs-attention";
  }
  if (facts.lineage === "local-ahead") {
    return "export-and-push";
  }
  return facts.base_available
    ? "reconcile"
    : "needs-attention";
}

export interface CanonicalPlanning {
  readonly tasks: readonly Task[];
  readonly recurrences: readonly RecurrenceSeries[];
}

export type CanonicalReconciliation =
  | {
      readonly state: "merged";
      readonly planning: CanonicalPlanning;
    }
  | {
      readonly state: "conflict";
      readonly reason: string;
    };

type TaskSemanticField =
  | "title"
  | "scheduled_date"
  | "priority"
  | "context"
  | "reference"
  | "note"
  | "reminder_time"
  | "recurrence_series_id"
  | "recurrence_occurrence_date"
  | "completed_at";

const TASK_FIELDS: readonly TaskSemanticField[] = [
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
];

type RecurrenceSemanticField =
  | "effective_from"
  | "end_date"
  | "pattern";

const RECURRENCE_FIELDS: readonly RecurrenceSemanticField[] = [
  "effective_from",
  "end_date",
  "pattern",
];

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function latestInstant(...values: readonly string[]): string {
  return [...values].sort((left, right) =>
    left.localeCompare(right),
  )[values.length - 1] ?? values[0] ?? "";
}

function taskSemanticallyEqual(
  left: Task,
  right: Task,
): boolean {
  if (
    left.id !== right.id ||
    left.created_at !== right.created_at
  ) {
    return false;
  }
  return TASK_FIELDS.every((field) =>
    sameValue(left[field], right[field]),
  );
}

function recurrenceSemanticallyEqual(
  left: RecurrenceSeries,
  right: RecurrenceSeries,
): boolean {
  if (
    left.id !== right.id ||
    left.created_at !== right.created_at
  ) {
    return false;
  }
  return RECURRENCE_FIELDS.every((field) =>
    sameValue(left[field], right[field]),
  );
}

function mergeTask(
  base: Task | undefined,
  local: Task | undefined,
  remote: Task | undefined,
): Task | null | string {
  if (base === undefined) {
    if (local === undefined) {
      return remote ?? null;
    }
    if (remote === undefined) {
      return local;
    }
    return taskSemanticallyEqual(local, remote)
      ? validateTask({
          ...local,
          updated_at: latestInstant(
            local.updated_at,
            remote.updated_at,
          ),
        })
      : `Task ${local.id} was independently created with different content`;
  }

  if (local === undefined && remote === undefined) {
    return null;
  }
  if (local === undefined) {
    return remote !== undefined &&
      taskSemanticallyEqual(base, remote)
      ? null
      : `Task ${base.id} was deleted locally and modified remotely`;
  }
  if (remote === undefined) {
    return taskSemanticallyEqual(base, local)
      ? null
      : `Task ${base.id} was deleted remotely and modified locally`;
  }

  if (
    local.created_at !== base.created_at ||
    remote.created_at !== base.created_at
  ) {
    return `Task ${base.id} changed immutable created_at metadata`;
  }

  const merged: {
    id: string;
    title: string;
    scheduled_date: string;
    position: number | null;
    priority: Task["priority"];
    context: string | null;
    reference: string | null;
    note: string | null;
    reminder_time: string | null;
    recurrence_series_id: string | null;
    recurrence_occurrence_date: string | null;
    completed_at: string | null;
    created_at: string;
    updated_at: string;
  } = {
    id: base.id,
    title: base.title,
    scheduled_date: base.scheduled_date,
    position: base.position,
    priority: base.priority,
    context: base.context,
    reference: base.reference,
    note: base.note,
    reminder_time: base.reminder_time,
    recurrence_series_id: base.recurrence_series_id,
    recurrence_occurrence_date: base.recurrence_occurrence_date,
    completed_at: base.completed_at,
    created_at: base.created_at,
    updated_at: latestInstant(
      base.updated_at,
      local.updated_at,
      remote.updated_at,
    ),
  };

  for (const field of TASK_FIELDS) {
    const baseValue = base[field];
    const localValue = local[field];
    const remoteValue = remote[field];
    const localChanged = !sameValue(localValue, baseValue);
    const remoteChanged = !sameValue(remoteValue, baseValue);

    if (
      localChanged &&
      remoteChanged &&
      !sameValue(localValue, remoteValue)
    ) {
      return `Task ${base.id} has conflicting ${field} changes`;
    }

    const value = localChanged
      ? localValue
      : remoteChanged
        ? remoteValue
        : baseValue;

    switch (field) {
      case "title":
        merged.title = value as string;
        break;
      case "scheduled_date":
        merged.scheduled_date = value as string;
        break;
      case "priority":
        merged.priority = value as Task["priority"];
        break;
      case "context":
        merged.context = value as string | null;
        break;
      case "reference":
        merged.reference = value as string | null;
        break;
      case "note":
        merged.note = value as string | null;
        break;
      case "reminder_time":
        merged.reminder_time = value as string | null;
        break;
      case "recurrence_series_id":
        merged.recurrence_series_id = value as string | null;
        break;
      case "recurrence_occurrence_date":
        merged.recurrence_occurrence_date = value as string | null;
        break;
      case "completed_at":
        merged.completed_at = value as string | null;
        break;
    }
  }

  merged.position =
    merged.completed_at === null
      ? base.position ?? local.position ?? remote.position ?? 0
      : null;
  return validateTask(merged);
}

function mergePattern(
  base: RecurrencePattern,
  local: RecurrencePattern,
  remote: RecurrencePattern,
): RecurrencePattern | string {
  const localChanged = !sameValue(local, base);
  const remoteChanged = !sameValue(remote, base);
  if (
    localChanged &&
    remoteChanged &&
    !sameValue(local, remote)
  ) {
    return "recurrence pattern changed differently";
  }
  return localChanged ? local : remoteChanged ? remote : base;
}

function mergeRecurrence(
  base: RecurrenceSeries | undefined,
  local: RecurrenceSeries | undefined,
  remote: RecurrenceSeries | undefined,
): RecurrenceSeries | null | string {
  if (base === undefined) {
    if (local === undefined) {
      return remote ?? null;
    }
    if (remote === undefined) {
      return local;
    }
    return recurrenceSemanticallyEqual(local, remote)
      ? validateRecurrenceSeries({
          ...local,
          updated_at: latestInstant(
            local.updated_at,
            remote.updated_at,
          ),
        })
      : `Recurrence series ${local.id} was independently created with different content`;
  }

  if (local === undefined && remote === undefined) {
    return null;
  }
  if (local === undefined) {
    return remote !== undefined &&
      recurrenceSemanticallyEqual(base, remote)
      ? null
      : `Recurrence series ${base.id} was deleted locally and modified remotely`;
  }
  if (remote === undefined) {
    return recurrenceSemanticallyEqual(base, local)
      ? null
      : `Recurrence series ${base.id} was deleted remotely and modified locally`;
  }

  if (
    local.created_at !== base.created_at ||
    remote.created_at !== base.created_at
  ) {
    return `Recurrence series ${base.id} changed immutable created_at metadata`;
  }

  let effectiveFrom = base.effective_from;
  let endDate = base.end_date;
  let pattern: RecurrencePattern = base.pattern;

  for (const field of RECURRENCE_FIELDS) {
    if (field === "pattern") {
      const mergedPattern = mergePattern(
        base.pattern,
        local.pattern,
        remote.pattern,
      );
      if (typeof mergedPattern === "string") {
        return `Recurrence series ${base.id} ${mergedPattern}`;
      }
      pattern = mergedPattern;
      continue;
    }

    const baseValue = base[field];
    const localValue = local[field];
    const remoteValue = remote[field];
    const localChanged = localValue !== baseValue;
    const remoteChanged = remoteValue !== baseValue;
    if (
      localChanged &&
      remoteChanged &&
      localValue !== remoteValue
    ) {
      return `Recurrence series ${base.id} has conflicting ${field} changes`;
    }
    const value = localChanged
      ? localValue
      : remoteChanged
        ? remoteValue
        : baseValue;
    if (field === "effective_from") {
      effectiveFrom = value;
    } else {
      endDate = value;
    }
  }

  return validateRecurrenceSeries({
    id: base.id,
    effective_from: effectiveFrom,
    end_date: endDate,
    pattern,
    created_at: base.created_at,
    updated_at: latestInstant(
      base.updated_at,
      local.updated_at,
      remote.updated_at,
    ),
  });
}

function taskMap(
  tasks: readonly Task[],
): ReadonlyMap<string, Task> {
  return new Map(tasks.map((task) => [task.id, task] as const));
}

function recurrenceMap(
  recurrences: readonly RecurrenceSeries[],
): ReadonlyMap<string, RecurrenceSeries> {
  return new Map(
    recurrences.map((series) => [series.id, series] as const),
  );
}

type RelativeOrder = -1 | 1;

function orderRelation(
  sequence: readonly string[],
  left: string,
  right: string,
): RelativeOrder | null {
  const leftIndex = sequence.indexOf(left);
  const rightIndex = sequence.indexOf(right);
  if (leftIndex < 0 || rightIndex < 0) {
    return null;
  }
  return leftIndex < rightIndex ? -1 : 1;
}

function sequenceForDate(
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

function mergedOrder(
  date: string,
  ids: readonly string[],
  baseTasks: readonly Task[],
  localTasks: readonly Task[],
  remoteTasks: readonly Task[],
  mergedById: ReadonlyMap<string, Task>,
): readonly string[] | string {
  const base = sequenceForDate(baseTasks, date);
  const local = sequenceForDate(localTasks, date);
  const remote = sequenceForDate(remoteTasks, date);
  const edges = new Map<string, Set<string>>();
  const indegree = new Map(ids.map((id) => [id, 0] as const));

  const add = (before: string, after: string): void => {
    const targets = edges.get(before) ?? new Set<string>();
    if (!targets.has(after)) {
      targets.add(after);
      edges.set(before, targets);
      indegree.set(after, (indegree.get(after) ?? 0) + 1);
    }
  };

  for (let leftIndex = 0; leftIndex < ids.length; leftIndex += 1) {
    const left = ids[leftIndex];
    if (left === undefined) {
      continue;
    }
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < ids.length;
      rightIndex += 1
    ) {
      const right = ids[rightIndex];
      if (right === undefined) {
        continue;
      }
      const baseRelation = orderRelation(base, left, right);
      const localRelation = orderRelation(local, left, right);
      const remoteRelation = orderRelation(remote, left, right);

      let relation: RelativeOrder | null = null;
      if (baseRelation === null) {
        if (
          localRelation !== null &&
          remoteRelation !== null &&
          localRelation !== remoteRelation
        ) {
          return `Ordering conflict on ${date}: ${left} and ${right}`;
        }
        relation = localRelation ?? remoteRelation;
      } else {
        const localChanged =
          localRelation !== null &&
          localRelation !== baseRelation;
        const remoteChanged =
          remoteRelation !== null &&
          remoteRelation !== baseRelation;
        if (
          localChanged &&
          remoteChanged &&
          localRelation !== remoteRelation
        ) {
          return `Ordering conflict on ${date}: ${left} and ${right}`;
        }
        relation = localChanged
          ? localRelation
          : remoteChanged
            ? remoteRelation
            : baseRelation;
      }

      if (relation === -1) {
        add(left, right);
      } else if (relation === 1) {
        add(right, left);
      }
    }
  }

  const baseRank = new Map(
    base.map((id, index) => [id, index] as const),
  );
  const compare = (left: string, right: string): number => {
    const leftBase = baseRank.get(left);
    const rightBase = baseRank.get(right);
    if (leftBase !== undefined || rightBase !== undefined) {
      if (leftBase === undefined) {
        return 1;
      }
      if (rightBase === undefined) {
        return -1;
      }
      if (leftBase !== rightBase) {
        return leftBase - rightBase;
      }
    }
    const leftTask = mergedById.get(left);
    const rightTask = mergedById.get(right);
    if (leftTask === undefined || rightTask === undefined) {
      return left.localeCompare(right);
    }
    const created = leftTask.created_at.localeCompare(
      rightTask.created_at,
    );
    return created !== 0 ? created : left.localeCompare(right);
  };

  const ready = ids
    .filter((id) => (indegree.get(id) ?? 0) === 0)
    .sort(compare);
  const ordered: string[] = [];

  while (ready.length > 0) {
    const next = ready.shift();
    if (next === undefined) {
      break;
    }
    ordered.push(next);
    for (const target of edges.get(next) ?? []) {
      const nextDegree = (indegree.get(target) ?? 0) - 1;
      indegree.set(target, nextDegree);
      if (nextDegree === 0) {
        ready.push(target);
        ready.sort(compare);
      }
    }
  }

  return ordered.length === ids.length
    ? ordered
    : `Ordering conflict on ${date}: constraints form a cycle`;
}

function applyMergedOrdering(
  tasks: readonly Task[],
  baseTasks: readonly Task[],
  localTasks: readonly Task[],
  remoteTasks: readonly Task[],
): readonly Task[] | string {
  const byId = taskMap(tasks);
  const dates = new Set(
    tasks
      .filter((task) => task.completed_at === null)
      .map((task) => task.scheduled_date),
  );
  const positions = new Map<string, number>();

  for (const date of [...dates].sort()) {
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
      baseTasks,
      localTasks,
      remoteTasks,
      byId,
    );
    if (typeof order === "string") {
      return order;
    }
    order.forEach((id, position) => {
      positions.set(id, position);
    });
  }

  return tasks.map((task) =>
    task.completed_at === null
      ? validateTask({
          ...task,
          position: positions.get(task.id) ?? 0,
        })
      : validateTask({
          ...task,
          position: null,
        }),
  );
}

export function canonicalPlanningEqual(
  left: CanonicalPlanning,
  right: CanonicalPlanning,
): boolean {
  const normalizeTasks = (tasks: readonly Task[]): readonly Task[] =>
    [...tasks].sort((a, b) => a.id.localeCompare(b.id));
  const normalizeRecurrences = (
    recurrences: readonly RecurrenceSeries[],
  ): readonly RecurrenceSeries[] =>
    [...recurrences].sort((a, b) => a.id.localeCompare(b.id));
  return (
    JSON.stringify(normalizeTasks(left.tasks)) ===
      JSON.stringify(normalizeTasks(right.tasks)) &&
    JSON.stringify(normalizeRecurrences(left.recurrences)) ===
      JSON.stringify(normalizeRecurrences(right.recurrences))
  );
}

export function reconcileCanonicalPlanning(
  base: CanonicalPlanning,
  local: CanonicalPlanning,
  remote: CanonicalPlanning,
): CanonicalReconciliation {
  try {
    assertRecurrenceState(base.tasks, base.recurrences);
    assertRecurrenceState(local.tasks, local.recurrences);
    assertRecurrenceState(remote.tasks, remote.recurrences);

    const baseTasks = taskMap(base.tasks);
    const localTasks = taskMap(local.tasks);
    const remoteTasks = taskMap(remote.tasks);
    const taskIds = new Set([
      ...baseTasks.keys(),
      ...localTasks.keys(),
      ...remoteTasks.keys(),
    ]);
    const mergedTasks: Task[] = [];

    for (const id of [...taskIds].sort()) {
      const merged = mergeTask(
        baseTasks.get(id),
        localTasks.get(id),
        remoteTasks.get(id),
      );
      if (typeof merged === "string") {
        return { state: "conflict", reason: merged };
      }
      if (merged !== null) {
        mergedTasks.push(merged);
      }
    }

    const baseRecurrences = recurrenceMap(base.recurrences);
    const localRecurrences = recurrenceMap(local.recurrences);
    const remoteRecurrences = recurrenceMap(remote.recurrences);
    const recurrenceIds = new Set([
      ...baseRecurrences.keys(),
      ...localRecurrences.keys(),
      ...remoteRecurrences.keys(),
    ]);
    const mergedRecurrences: RecurrenceSeries[] = [];

    for (const id of [...recurrenceIds].sort()) {
      const merged = mergeRecurrence(
        baseRecurrences.get(id),
        localRecurrences.get(id),
        remoteRecurrences.get(id),
      );
      if (typeof merged === "string") {
        return { state: "conflict", reason: merged };
      }
      if (merged !== null) {
        mergedRecurrences.push(merged);
      }
    }

    const ordered = applyMergedOrdering(
      mergedTasks,
      base.tasks,
      local.tasks,
      remote.tasks,
    );
    if (typeof ordered === "string") {
      return { state: "conflict", reason: ordered };
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
    return {
      state: "conflict",
      reason:
        error instanceof Error
          ? error.message
          : "Canonical reconciliation failed validation",
    };
  }
}

export function planningFromState(
  state: Pick<CanonicalState, "tasks" | "recurrences">,
): CanonicalPlanning {
  return {
    tasks: state.tasks,
    recurrences: state.recurrences,
  };
}
