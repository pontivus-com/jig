import {
  assertTaskSet,
} from "./planning";
import {
  assertRecurrenceState,
} from "./recurrence-planning";
import {
  isWeekday,
  WEEKDAYS,
  type RecurrencePattern,
  type RecurrenceSeries,
  type Weekday,
  validateRecurrenceSeries,
} from "./recurrence";
import {
  assertCivilDate,
  assertUuid,
  type Task,
  validateTask,
} from "./task";
import {
  canonicalRecurrenceRecordJson,
  canonicalTaskRecordJson,
  serializeSnapshot,
  validateSnapshot,
  type PortableSnapshot,
} from "./portable";

export type ReconciliationSide = "local" | "remote";

export interface JigDataConflictFamilySide {
  readonly series: readonly RecurrenceSeries[];
  readonly tasks: readonly Task[];
}

export type JigDataConflict =
  | {
      readonly kind: "task";
      readonly task_id: string;
      readonly ancestor: Task | null;
      readonly local: Task | null;
      readonly remote: Task | null;
    }
  | {
      readonly kind: "recurrence-family";
      readonly recurrence_series_ids: readonly string[];
      readonly ancestor: JigDataConflictFamilySide;
      readonly local: JigDataConflictFamilySide;
      readonly remote: JigDataConflictFamilySide;
    };

export interface JigDataConflictCase {
  readonly dataset_id: string;
  readonly ancestor_head: string;
  readonly local_head: string;
  readonly remote_head: string;
  readonly expected_revision: number;
  readonly ancestor_tasks: readonly Task[];
  readonly local_tasks: readonly Task[];
  readonly remote_tasks: readonly Task[];
  readonly ancestor_recurrences: readonly RecurrenceSeries[];
  readonly local_recurrences: readonly RecurrenceSeries[];
  readonly remote_recurrences: readonly RecurrenceSeries[];
  readonly conflicts: readonly JigDataConflict[];
}

export interface JigDataConflictChoice {
  readonly conflict_key: string;
  readonly side: ReconciliationSide;
}

export interface JigDataDateOrder {
  readonly date: string;
  readonly task_ids: readonly string[];
}

export interface JigDataResolution {
  readonly ancestor_head: string;
  readonly local_head: string;
  readonly remote_head: string;
  readonly expected_revision: number;
  readonly choices: readonly JigDataConflictChoice[];
  readonly date_orders: readonly JigDataDateOrder[];
}

export type RelatedReconciliation =
  | {
      readonly kind: "resolved";
      readonly snapshot: PortableSnapshot;
    }
  | {
      readonly kind: "semantic-conflict";
      readonly conflicts: readonly JigDataConflict[];
    };

export type RecoveryCommitKind = "automatic" | "user-resolved";

export interface RecoveryCommitSpec {
  readonly parents: readonly [string, string];
  readonly name: "Jig";
  readonly email: "jig@local.invalid";
  readonly timestamp_seconds: number;
  readonly timezone_offset_minutes: 0;
  readonly message:
    | "Reconcile Jig data"
    | "Resolve Jig sync conflict";
}

type RecordSelection<T> =
  | {
      readonly kind: "resolved";
      readonly value: T | null;
    }
  | {
      readonly kind: "conflict";
    };

interface ReconciliationAnalysis {
  readonly dataset_id: string;
  readonly ancestor: PortableSnapshot;
  readonly local: PortableSnapshot;
  readonly remote: PortableSnapshot;
  readonly tasks: ReadonlyMap<string, RecordSelection<Task>>;
  readonly recurrences: ReadonlyMap<
    string,
    RecordSelection<RecurrenceSeries>
  >;
  readonly conflicts: readonly JigDataConflict[];
}

interface SelectedRecords {
  readonly tasks: readonly Task[];
  readonly recurrences: readonly RecurrenceSeries[];
}

const OBJECT_ID_PATTERN = /^[0-9a-f]{40}$/;

function exactObject(
  value: unknown,
  expectedKeys: readonly string[],
  label: string,
): Record<string, unknown> {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw new TypeError(`${label} must be an object`);
  }
  const record = Object.fromEntries(Object.entries(value));
  const actual = Object.keys(record).sort();
  const expected = [...expectedKeys].sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) {
    throw new TypeError(`${label} has unexpected fields`);
  }
  return record;
}

function requiredString(
  record: Record<string, unknown>,
  key: string,
  label: string,
): string {
  const value = record[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`${label}.${key} must be a non-empty string`);
  }
  return value;
}

function requiredNonnegativeInteger(
  record: Record<string, unknown>,
  key: string,
  label: string,
): number {
  const value = record[key];
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 0
  ) {
    throw new TypeError(
      `${label}.${key} must be a nonnegative integer`,
    );
  }
  return value;
}

function validateObjectId(value: string, field: string): string {
  if (!OBJECT_ID_PATTERN.test(value)) {
    throw new TypeError(`${field} must be a 40-character lowercase object id`);
  }
  return value;
}

function sortedTasks(tasks: readonly Task[]): readonly Task[] {
  return [...tasks].sort((left, right) =>
    left.id.localeCompare(right.id)
  );
}

function sortedRecurrences(
  recurrences: readonly RecurrenceSeries[],
): readonly RecurrenceSeries[] {
  return [...recurrences].sort((left, right) =>
    left.id.localeCompare(right.id)
  );
}

function validatedSnapshot(
  snapshot: PortableSnapshot,
  expectedDatasetId: string,
): PortableSnapshot {
  return validateSnapshot(snapshot.files, expectedDatasetId);
}

function snapshotFromCanonicalState(
  datasetId: string,
  tasks: readonly Task[],
  recurrences: readonly RecurrenceSeries[],
): PortableSnapshot {
  const snapshot = serializeSnapshot(tasks, datasetId, recurrences);
  const validated = validateSnapshot(snapshot.files, datasetId);
  assertTaskSet(validated.tasks);
  assertRecurrenceState(validated.tasks, validated.recurrences);
  return validated;
}

function nullableTaskEqual(
  left: Task | null,
  right: Task | null,
): boolean {
  if (left === null || right === null) {
    return left === right;
  }
  return canonicalTaskRecordJson(left) === canonicalTaskRecordJson(right);
}

function nullableRecurrenceEqual(
  left: RecurrenceSeries | null,
  right: RecurrenceSeries | null,
): boolean {
  if (left === null || right === null) {
    return left === right;
  }
  return (
    canonicalRecurrenceRecordJson(left) ===
    canonicalRecurrenceRecordJson(right)
  );
}

function selectRecord<T>(
  ancestor: T | null,
  local: T | null,
  remote: T | null,
  equal: (left: T | null, right: T | null) => boolean,
): RecordSelection<T> {
  if (equal(local, remote)) {
    return { kind: "resolved", value: local };
  }
  if (equal(local, ancestor)) {
    return { kind: "resolved", value: remote };
  }
  if (equal(remote, ancestor)) {
    return { kind: "resolved", value: local };
  }
  return { kind: "conflict" };
}

function taskMap(
  tasks: readonly Task[],
): ReadonlyMap<string, Task> {
  return new Map(tasks.map((task) => [task.id, task]));
}

function recurrenceMap(
  recurrences: readonly RecurrenceSeries[],
): ReadonlyMap<string, RecurrenceSeries> {
  return new Map(recurrences.map((series) => [series.id, series]));
}

function unionIds(
  ...maps: readonly ReadonlyMap<string, unknown>[]
): readonly string[] {
  const ids = new Set<string>();
  for (const map of maps) {
    for (const id of map.keys()) ids.add(id);
  }
  return [...ids].sort();
}

function graphNode(kind: "task" | "recurrence", id: string): string {
  return `${kind}:${id}`;
}

function addGraphNode(
  graph: Map<string, Set<string>>,
  graphNodeValue: string,
): void {
  if (!graph.has(graphNodeValue)) {
    graph.set(graphNodeValue, new Set<string>());
  }
}

function addGraphEdge(
  graph: Map<string, Set<string>>,
  left: string,
  right: string,
): void {
  addGraphNode(graph, left);
  addGraphNode(graph, right);
  graph.get(left)?.add(right);
  graph.get(right)?.add(left);
}

function buildConflictGraph(
  ancestor: PortableSnapshot,
  local: PortableSnapshot,
  remote: PortableSnapshot,
): Map<string, Set<string>> {
  const graph = new Map<string, Set<string>>();
  for (const snapshot of [ancestor, local, remote]) {
    for (const series of snapshot.recurrences) {
      addGraphNode(graph, graphNode("recurrence", series.id));
    }
    for (const task of snapshot.tasks) {
      const taskNode = graphNode("task", task.id);
      addGraphNode(graph, taskNode);
      if (task.recurrence_series_id !== null) {
        addGraphEdge(
          graph,
          taskNode,
          graphNode("recurrence", task.recurrence_series_id),
        );
      }
    }
  }
  return graph;
}

function connectedComponent(
  graph: ReadonlyMap<string, ReadonlySet<string>>,
  start: string,
): ReadonlySet<string> {
  const visited = new Set<string>();
  const pending = [start];
  while (pending.length > 0) {
    const node = pending.pop();
    if (node === undefined || visited.has(node)) continue;
    visited.add(node);
    for (const neighbor of graph.get(node) ?? []) {
      if (!visited.has(neighbor)) pending.push(neighbor);
    }
  }
  return visited;
}

function nodeId(graphNodeValue: string, prefix: string): string | null {
  return graphNodeValue.startsWith(prefix)
    ? graphNodeValue.slice(prefix.length)
    : null;
}

function familySide(
  snapshot: PortableSnapshot,
  seriesIds: ReadonlySet<string>,
  taskIds: ReadonlySet<string>,
): JigDataConflictFamilySide {
  return {
    series: sortedRecurrences(
      snapshot.recurrences.filter((series) =>
        seriesIds.has(series.id)
      ),
    ),
    tasks: sortedTasks(
      snapshot.tasks.filter((task) => taskIds.has(task.id)),
    ),
  };
}

function conflictKeyForFamily(
  seriesIds: readonly string[],
): string {
  return `recurrence:${seriesIds.join("+")}`;
}

export function jigDataConflictKey(
  conflict: JigDataConflict,
): string {
  return conflict.kind === "task"
    ? `task:${conflict.task_id}`
    : conflictKeyForFamily(conflict.recurrence_series_ids);
}

function buildConflicts(
  ancestor: PortableSnapshot,
  local: PortableSnapshot,
  remote: PortableSnapshot,
  conflictingTaskIds: ReadonlySet<string>,
  conflictingSeriesIds: ReadonlySet<string>,
): readonly JigDataConflict[] {
  const graph = buildConflictGraph(ancestor, local, remote);
  const starts = [
    ...[...conflictingTaskIds].map((id) => graphNode("task", id)),
    ...[...conflictingSeriesIds].map((id) =>
      graphNode("recurrence", id)
    ),
  ].sort();
  const handled = new Set<string>();
  const conflicts: JigDataConflict[] = [];
  const ancestorTasks = taskMap(ancestor.tasks);
  const localTasks = taskMap(local.tasks);
  const remoteTasks = taskMap(remote.tasks);

  for (const start of starts) {
    if (handled.has(start)) continue;
    const component = connectedComponent(graph, start);
    for (const node of component) handled.add(node);

    const seriesIds = [...component]
      .map((node) => nodeId(node, "recurrence:"))
      .filter((id): id is string => id !== null)
      .sort();
    const taskIds = [...component]
      .map((node) => nodeId(node, "task:"))
      .filter((id): id is string => id !== null)
      .sort();

    if (seriesIds.length === 0) {
      for (const taskId of taskIds) {
        if (!conflictingTaskIds.has(taskId)) continue;
        conflicts.push({
          kind: "task",
          task_id: taskId,
          ancestor: ancestorTasks.get(taskId) ?? null,
          local: localTasks.get(taskId) ?? null,
          remote: remoteTasks.get(taskId) ?? null,
        });
      }
      continue;
    }

    const seriesSet = new Set(seriesIds);
    const taskSet = new Set(taskIds);
    conflicts.push({
      kind: "recurrence-family",
      recurrence_series_ids: seriesIds,
      ancestor: familySide(ancestor, seriesSet, taskSet),
      local: familySide(local, seriesSet, taskSet),
      remote: familySide(remote, seriesSet, taskSet),
    });
  }

  return conflicts.sort((left, right) =>
    jigDataConflictKey(left).localeCompare(jigDataConflictKey(right))
  );
}

function analyzeRelatedSnapshots(
  ancestorInput: PortableSnapshot,
  localInput: PortableSnapshot,
  remoteInput: PortableSnapshot,
): ReconciliationAnalysis {
  const datasetId = ancestorInput.dataset_id;
  const ancestor = validatedSnapshot(ancestorInput, datasetId);
  const local = validatedSnapshot(localInput, datasetId);
  const remote = validatedSnapshot(remoteInput, datasetId);

  const ancestorTasks = taskMap(ancestor.tasks);
  const localTasks = taskMap(local.tasks);
  const remoteTasks = taskMap(remote.tasks);
  const taskSelections = new Map<string, RecordSelection<Task>>();
  const conflictingTaskIds = new Set<string>();

  for (const id of unionIds(ancestorTasks, localTasks, remoteTasks)) {
    const selection = selectRecord(
      ancestorTasks.get(id) ?? null,
      localTasks.get(id) ?? null,
      remoteTasks.get(id) ?? null,
      nullableTaskEqual,
    );
    taskSelections.set(id, selection);
    if (selection.kind === "conflict") conflictingTaskIds.add(id);
  }

  const ancestorRecurrences = recurrenceMap(ancestor.recurrences);
  const localRecurrences = recurrenceMap(local.recurrences);
  const remoteRecurrences = recurrenceMap(remote.recurrences);
  const recurrenceSelections =
    new Map<string, RecordSelection<RecurrenceSeries>>();
  const conflictingSeriesIds = new Set<string>();

  for (const id of unionIds(
    ancestorRecurrences,
    localRecurrences,
    remoteRecurrences,
  )) {
    const selection = selectRecord(
      ancestorRecurrences.get(id) ?? null,
      localRecurrences.get(id) ?? null,
      remoteRecurrences.get(id) ?? null,
      nullableRecurrenceEqual,
    );
    recurrenceSelections.set(id, selection);
    if (selection.kind === "conflict") conflictingSeriesIds.add(id);
  }

  return {
    dataset_id: datasetId,
    ancestor,
    local,
    remote,
    tasks: taskSelections,
    recurrences: recurrenceSelections,
    conflicts: buildConflicts(
      ancestor,
      local,
      remote,
      conflictingTaskIds,
      conflictingSeriesIds,
    ),
  };
}

function resolvedRecords(
  analysis: ReconciliationAnalysis,
): SelectedRecords | null {
  const tasks: Task[] = [];
  for (const selection of analysis.tasks.values()) {
    if (selection.kind === "conflict") return null;
    if (selection.value !== null) tasks.push(selection.value);
  }
  const recurrences: RecurrenceSeries[] = [];
  for (const selection of analysis.recurrences.values()) {
    if (selection.kind === "conflict") return null;
    if (selection.value !== null) recurrences.push(selection.value);
  }
  return {
    tasks: sortedTasks(tasks),
    recurrences: sortedRecurrences(recurrences),
  };
}

function validatedCandidate(
  datasetId: string,
  records: SelectedRecords,
): PortableSnapshot | null {
  try {
    return snapshotFromCanonicalState(
      datasetId,
      records.tasks,
      records.recurrences,
    );
  } catch {
    return null;
  }
}

export function reconcileRelatedPortableSnapshots(
  ancestor: PortableSnapshot,
  local: PortableSnapshot,
  remote: PortableSnapshot,
): RelatedReconciliation {
  const analysis = analyzeRelatedSnapshots(ancestor, local, remote);
  if (analysis.conflicts.length > 0) {
    return {
      kind: "semantic-conflict",
      conflicts: analysis.conflicts,
    };
  }
  const records = resolvedRecords(analysis);
  const candidate =
    records === null
      ? null
      : validatedCandidate(analysis.dataset_id, records);
  return candidate === null
    ? {
        kind: "semantic-conflict",
        conflicts: analysis.conflicts,
      }
    : {
        kind: "resolved",
        snapshot: candidate,
      };
}

function sortedSourceTasks(
  tasks: readonly Task[],
): readonly Task[] {
  return [...tasks].sort((left, right) => left.id.localeCompare(right.id));
}

function sortedSourceRecurrences(
  recurrences: readonly RecurrenceSeries[],
): readonly RecurrenceSeries[] {
  return [...recurrences].sort((left, right) =>
    left.id.localeCompare(right.id)
  );
}

export function buildJigDataConflictCase(
  ancestorHead: string,
  localHead: string,
  remoteHead: string,
  expectedRevision: number,
  ancestor: PortableSnapshot,
  local: PortableSnapshot,
  remote: PortableSnapshot,
): JigDataConflictCase | null {
  validateObjectId(ancestorHead, "ancestor_head");
  validateObjectId(localHead, "local_head");
  validateObjectId(remoteHead, "remote_head");
  if (!Number.isInteger(expectedRevision) || expectedRevision < 0) {
    throw new TypeError("expected_revision must be a nonnegative integer");
  }

  const analysis = analyzeRelatedSnapshots(ancestor, local, remote);
  const automatic = reconcileRelatedPortableSnapshots(
    analysis.ancestor,
    analysis.local,
    analysis.remote,
  );
  if (automatic.kind === "resolved") return null;

  return {
    dataset_id: analysis.dataset_id,
    ancestor_head: ancestorHead,
    local_head: localHead,
    remote_head: remoteHead,
    expected_revision: expectedRevision,
    ancestor_tasks: sortedSourceTasks(analysis.ancestor.tasks),
    local_tasks: sortedSourceTasks(analysis.local.tasks),
    remote_tasks: sortedSourceTasks(analysis.remote.tasks),
    ancestor_recurrences:
      sortedSourceRecurrences(analysis.ancestor.recurrences),
    local_recurrences:
      sortedSourceRecurrences(analysis.local.recurrences),
    remote_recurrences:
      sortedSourceRecurrences(analysis.remote.recurrences),
    conflicts: analysis.conflicts,
  };
}

function choiceMap(
  conflictCase: JigDataConflictCase,
  choices: readonly JigDataConflictChoice[],
): ReadonlyMap<string, ReconciliationSide> | null {
  const required = new Set(
    conflictCase.conflicts.map(jigDataConflictKey),
  );
  const selected = new Map<string, ReconciliationSide>();
  for (const choice of choices) {
    if (
      !required.has(choice.conflict_key) ||
      selected.has(choice.conflict_key)
    ) {
      return null;
    }
    selected.set(choice.conflict_key, choice.side);
  }
  if (selected.size !== required.size) return null;
  return selected;
}

function snapshotsFromCase(
  conflictCase: JigDataConflictCase,
): {
  readonly ancestor: PortableSnapshot;
  readonly local: PortableSnapshot;
  readonly remote: PortableSnapshot;
} {
  return {
    ancestor: snapshotFromCanonicalState(
      conflictCase.dataset_id,
      conflictCase.ancestor_tasks,
      conflictCase.ancestor_recurrences,
    ),
    local: snapshotFromCanonicalState(
      conflictCase.dataset_id,
      conflictCase.local_tasks,
      conflictCase.local_recurrences,
    ),
    remote: snapshotFromCanonicalState(
      conflictCase.dataset_id,
      conflictCase.remote_tasks,
      conflictCase.remote_recurrences,
    ),
  };
}

function selectedRecordsForChoices(
  conflictCase: JigDataConflictCase,
  choices: readonly JigDataConflictChoice[],
): SelectedRecords | null {
  const selected = choiceMap(conflictCase, choices);
  if (selected === null) return null;
  const source = snapshotsFromCase(conflictCase);
  const analysis = analyzeRelatedSnapshots(
    source.ancestor,
    source.local,
    source.remote,
  );
  const taskSelections =
    new Map<string, RecordSelection<Task>>(analysis.tasks);
  const recurrenceSelections =
    new Map<string, RecordSelection<RecurrenceSeries>>(
      analysis.recurrences,
    );

  for (const conflict of conflictCase.conflicts) {
    const key = jigDataConflictKey(conflict);
    const side = selected.get(key);
    if (side === undefined) return null;

    if (conflict.kind === "task") {
      const task = side === "local" ? conflict.local : conflict.remote;
      taskSelections.set(conflict.task_id, {
        kind: "resolved",
        value: task,
      });
      continue;
    }

    const chosen = side === "local" ? conflict.local : conflict.remote;
    const allTaskIds = new Set<string>();
    for (const familySideValue of [
      conflict.ancestor,
      conflict.local,
      conflict.remote,
    ]) {
      for (const task of familySideValue.tasks) allTaskIds.add(task.id);
    }
    const chosenTasks = taskMap(chosen.tasks);
    for (const taskId of allTaskIds) {
      taskSelections.set(taskId, {
        kind: "resolved",
        value: chosenTasks.get(taskId) ?? null,
      });
    }

    const chosenSeries = recurrenceMap(chosen.series);
    for (const seriesId of conflict.recurrence_series_ids) {
      recurrenceSelections.set(seriesId, {
        kind: "resolved",
        value: chosenSeries.get(seriesId) ?? null,
      });
    }
  }

  const resolvedAnalysis: ReconciliationAnalysis = {
    ...analysis,
    tasks: taskSelections,
    recurrences: recurrenceSelections,
  };
  return resolvedRecords(resolvedAnalysis);
}

function outstandingOnDate(task: Task, date: string): boolean {
  return task.completed_at === null && task.scheduled_date === date;
}

function conflictDates(
  conflict: JigDataConflict,
): readonly string[] {
  const dates = new Set<string>();
  if (conflict.kind === "task") {
    for (const task of [
      conflict.ancestor,
      conflict.local,
      conflict.remote,
    ]) {
      if (task !== null && task.completed_at === null) {
        dates.add(task.scheduled_date);
      }
    }
    return [...dates].sort();
  }

  for (const familySideValue of [
    conflict.ancestor,
    conflict.local,
    conflict.remote,
  ]) {
    for (const task of familySideValue.tasks) {
      if (task.completed_at === null) dates.add(task.scheduled_date);
    }
  }
  return [...dates].sort();
}

function positionsAreContiguous(tasks: readonly Task[]): boolean {
  const positions = tasks
    .map((task) => task.position)
    .filter((position): position is number => position !== null)
    .sort((left, right) => left - right);
  if (positions.length !== tasks.length) return false;
  return positions.every((position, index) => position === index);
}

function requiredOrderDates(
  conflicts: readonly JigDataConflict[],
  tasks: readonly Task[],
): readonly string[] {
  const dates = new Set<string>();
  for (const conflict of conflicts) {
    for (const date of conflictDates(conflict)) dates.add(date);
  }
  const outstandingByDate = new Map<string, Task[]>();
  for (const task of tasks) {
    if (task.completed_at !== null) continue;
    const entries = outstandingByDate.get(task.scheduled_date) ?? [];
    entries.push(task);
    outstandingByDate.set(task.scheduled_date, entries);
  }
  for (const [date, entries] of outstandingByDate) {
    if (!positionsAreContiguous(entries)) dates.add(date);
  }
  return [...dates].sort();
}

function sourcePositionCompare(
  left: Task,
  right: Task,
): number {
  const leftPosition = left.position;
  const rightPosition = right.position;
  if (leftPosition === null || rightPosition === null) {
    return left.id.localeCompare(right.id);
  }
  return leftPosition === rightPosition
    ? left.id.localeCompare(right.id)
    : leftPosition - rightPosition;
}

function seedDateOrder(
  date: string,
  provisionalTasks: readonly Task[],
  localTasks: readonly Task[],
  remoteTasks: readonly Task[],
): JigDataDateOrder {
  const finalTasks = provisionalTasks.filter((task) =>
    outstandingOnDate(task, date)
  );
  const finalIds = new Set(finalTasks.map((task) => task.id));
  const used = new Set<string>();
  const taskIds: string[] = [];

  const append = (tasks: readonly Task[]): void => {
    for (const task of tasks) {
      if (!finalIds.has(task.id) || used.has(task.id)) continue;
      used.add(task.id);
      taskIds.push(task.id);
    }
  };

  append(
    localTasks
      .filter((task) => outstandingOnDate(task, date))
      .sort(sourcePositionCompare),
  );
  append(
    remoteTasks
      .filter((task) => outstandingOnDate(task, date))
      .sort(sourcePositionCompare),
  );
  append(
    finalTasks
      .filter((task) => !used.has(task.id))
      .sort((left, right) => left.id.localeCompare(right.id)),
  );

  return { date, task_ids: taskIds };
}

export function deriveJigDataDateOrders(
  conflictCase: JigDataConflictCase,
  choices: readonly JigDataConflictChoice[],
): readonly JigDataDateOrder[] | null {
  const validatedCase = validateJigDataConflictCase(conflictCase);
  const records = selectedRecordsForChoices(validatedCase, choices);
  if (records === null) return null;
  return requiredOrderDates(
    validatedCase.conflicts,
    records.tasks,
  ).map((date) =>
    seedDateOrder(
      date,
      records.tasks,
      validatedCase.local_tasks,
      validatedCase.remote_tasks,
    )
  );
}

function exactDateOrderMap(
  required: readonly JigDataDateOrder[],
  supplied: readonly JigDataDateOrder[],
): ReadonlyMap<string, readonly string[]> | null {
  if (required.length !== supplied.length) return null;
  const requiredByDate = new Map(
    required.map((order) => [order.date, order.task_ids]),
  );
  const suppliedByDate = new Map<string, readonly string[]>();
  for (const order of supplied) {
    if (suppliedByDate.has(order.date)) return null;
    const requiredIds = requiredByDate.get(order.date);
    if (requiredIds === undefined) return null;
    if (requiredIds.length !== order.task_ids.length) return null;
    const expected = [...requiredIds].sort();
    const actual = [...order.task_ids].sort();
    if (
      expected.some((id, index) => id !== actual[index])
    ) {
      return null;
    }
    suppliedByDate.set(order.date, order.task_ids);
  }
  return suppliedByDate;
}

function rewriteReviewedPositions(
  tasks: readonly Task[],
  orders: ReadonlyMap<string, readonly string[]>,
): readonly Task[] | null {
  const positionsById = new Map<string, number>();
  for (const [date, ids] of orders) {
    for (let index = 0; index < ids.length; index += 1) {
      const id = ids[index];
      if (id === undefined || positionsById.has(id)) return null;
      positionsById.set(id, index);
    }
    const actualIds = tasks
      .filter((task) => outstandingOnDate(task, date))
      .map((task) => task.id)
      .sort();
    const suppliedIds = [...ids].sort();
    if (
      actualIds.length !== suppliedIds.length ||
      actualIds.some((id, index) => id !== suppliedIds[index])
    ) {
      return null;
    }
  }

  return tasks.map((task) => {
    if (task.completed_at !== null) return task;
    const position = positionsById.get(task.id);
    return position === undefined
      ? task
      : validateTask({ ...task, position });
  });
}

export function applyJigDataResolution(
  conflictCase: JigDataConflictCase,
  resolutionInput: JigDataResolution,
): RelatedReconciliation {
  const validatedCase = validateJigDataConflictCase(conflictCase);
  const resolution = validateJigDataResolution(resolutionInput);
  if (
    resolution.ancestor_head !== validatedCase.ancestor_head ||
    resolution.local_head !== validatedCase.local_head ||
    resolution.remote_head !== validatedCase.remote_head ||
    resolution.expected_revision !== validatedCase.expected_revision
  ) {
    return {
      kind: "semantic-conflict",
      conflicts: validatedCase.conflicts,
    };
  }

  const records = selectedRecordsForChoices(
    validatedCase,
    resolution.choices,
  );
  const requiredOrders = deriveJigDataDateOrders(
    validatedCase,
    resolution.choices,
  );
  if (records === null || requiredOrders === null) {
    return {
      kind: "semantic-conflict",
      conflicts: validatedCase.conflicts,
    };
  }

  const orders = exactDateOrderMap(
    requiredOrders,
    resolution.date_orders,
  );
  if (orders === null) {
    return {
      kind: "semantic-conflict",
      conflicts: validatedCase.conflicts,
    };
  }
  const tasks = rewriteReviewedPositions(records.tasks, orders);
  if (tasks === null) {
    return {
      kind: "semantic-conflict",
      conflicts: validatedCase.conflicts,
    };
  }
  const candidate = validatedCandidate(
    validatedCase.dataset_id,
    {
      tasks,
      recurrences: records.recurrences,
    },
  );
  return candidate === null
    ? {
        kind: "semantic-conflict",
        conflicts: validatedCase.conflicts,
      }
    : {
        kind: "resolved",
        snapshot: candidate,
      };
}

function validateRecurrencePatternValue(
  value: unknown,
  label: string,
): RecurrencePattern {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw new TypeError(`${label} must be an object`);
  }
  const candidate = Object.fromEntries(Object.entries(value));
  if (candidate.kind === "weekly") {
    const record = exactObject(
      value,
      ["kind", "interval_weeks", "weekdays"],
      label,
    );
    const interval = record.interval_weeks;
    if (
      typeof interval !== "number" ||
      !Number.isInteger(interval) ||
      interval <= 0
    ) {
      throw new TypeError(
        `${label}.interval_weeks must be a positive integer`,
      );
    }
    if (!Array.isArray(record.weekdays) || record.weekdays.length === 0) {
      throw new TypeError(`${label}.weekdays must be a non-empty array`);
    }
    const weekdays: Weekday[] = [];
    const seen = new Set<Weekday>();
    for (const entry of record.weekdays) {
      if (!isWeekday(entry) || seen.has(entry)) {
        throw new TypeError(
          `${label}.weekdays must contain unique canonical weekdays`,
        );
      }
      seen.add(entry);
      weekdays.push(entry);
    }
    const canonicalWeekdays = WEEKDAYS.filter((weekday) =>
      seen.has(weekday)
    );
    if (
      canonicalWeekdays.some(
        (weekday, index) => weekday !== weekdays[index],
      )
    ) {
      throw new TypeError(
        `${label}.weekdays must use canonical weekday order`,
      );
    }
    return {
      kind: "weekly",
      interval_weeks: interval,
      weekdays,
    };
  }
  if (candidate.kind === "monthly") {
    const record = exactObject(
      value,
      ["kind", "day_of_month"],
      label,
    );
    const day = record.day_of_month;
    if (
      typeof day !== "number" ||
      !Number.isInteger(day) ||
      day < 1 ||
      day > 31
    ) {
      throw new TypeError(
        `${label}.day_of_month must be an integer from 1 through 31`,
      );
    }
    return {
      kind: "monthly",
      day_of_month: day,
    };
  }
  throw new TypeError(`${label}.kind is invalid`);
}

function validateRecurrenceSeriesValue(
  value: unknown,
  label: string,
): RecurrenceSeries {
  const record = exactObject(
    value,
    [
      "id",
      "effective_from",
      "end_date",
      "pattern",
      "created_at",
      "updated_at",
    ],
    label,
  );
  const id = requiredString(record, "id", label);
  assertUuid(id, "recurrence_series_id");
  const effectiveFrom = requiredString(record, "effective_from", label);
  assertCivilDate(effectiveFrom, "effective_from");
  const endDate = requiredString(record, "end_date", label);
  assertCivilDate(endDate, "end_date");
  const createdAt = requiredString(record, "created_at", label);
  const updatedAt = requiredString(record, "updated_at", label);
  return validateRecurrenceSeries({
    id,
    effective_from: effectiveFrom,
    end_date: endDate,
    pattern: validateRecurrencePatternValue(
      record.pattern,
      `${label}.pattern`,
    ),
    created_at: createdAt,
    updated_at: updatedAt,
  });
}

function validateNullableTask(
  value: unknown,
  expectedId: string,
  label: string,
): Task | null {
  if (value === null) return null;
  const task = validateTask(value);
  if (task.id !== expectedId) {
    throw new TypeError(`${label}.id does not match conflict identity`);
  }
  return task;
}

function validateFamilySide(
  value: unknown,
  seriesIds: ReadonlySet<string>,
  label: string,
): JigDataConflictFamilySide {
  const record = exactObject(value, ["series", "tasks"], label);
  if (!Array.isArray(record.series) || !Array.isArray(record.tasks)) {
    throw new TypeError(`${label} series/tasks must be arrays`);
  }
  const series = record.series.map((entry) =>
    validateRecurrenceSeriesValue(entry, `${label} recurrence series`)
  );
  const seriesSeen = new Set<string>();
  let previousSeriesId: string | null = null;
  for (const candidate of series) {
    if (
      seriesSeen.has(candidate.id) ||
      !seriesIds.has(candidate.id) ||
      (
        previousSeriesId !== null &&
        previousSeriesId.localeCompare(candidate.id) >= 0
      )
    ) {
      throw new TypeError(
        `${label} recurrence series must be unique and canonically ordered`,
      );
    }
    seriesSeen.add(candidate.id);
    previousSeriesId = candidate.id;
  }
  const tasks = record.tasks.map((entry) => validateTask(entry));
  const taskSeen = new Set<string>();
  let previousTaskId: string | null = null;
  for (const task of tasks) {
    if (
      taskSeen.has(task.id) ||
      (
        previousTaskId !== null &&
        previousTaskId.localeCompare(task.id) >= 0
      )
    ) {
      throw new TypeError(
        `${label} Tasks must be unique and canonically ordered`,
      );
    }
    taskSeen.add(task.id);
    previousTaskId = task.id;
    if (
      task.recurrence_series_id !== null &&
      !seriesIds.has(task.recurrence_series_id)
    ) {
      throw new TypeError(
        `${label} Task references a series outside the conflict family`,
      );
    }
  }
  return { series, tasks };
}

function validateConflict(value: unknown): JigDataConflict {
  const kindRecord =
    value !== null && typeof value === "object" && !Array.isArray(value)
      ? Object.fromEntries(Object.entries(value))
      : null;
  if (kindRecord === null || typeof kindRecord.kind !== "string") {
    throw new TypeError("Jig data conflict must have a kind");
  }

  if (kindRecord.kind === "task") {
    const record = exactObject(
      value,
      ["kind", "task_id", "ancestor", "local", "remote"],
      "Task conflict",
    );
    const taskId = requiredString(record, "task_id", "Task conflict");
    assertUuid(taskId, "task_id");
    return {
      kind: "task",
      task_id: taskId,
      ancestor: validateNullableTask(
        record.ancestor,
        taskId,
        "Task conflict ancestor",
      ),
      local: validateNullableTask(
        record.local,
        taskId,
        "Task conflict local",
      ),
      remote: validateNullableTask(
        record.remote,
        taskId,
        "Task conflict remote",
      ),
    };
  }

  if (kindRecord.kind === "recurrence-family") {
    const record = exactObject(
      value,
      [
        "kind",
        "recurrence_series_ids",
        "ancestor",
        "local",
        "remote",
      ],
      "Recurrence-family conflict",
    );
    if (!Array.isArray(record.recurrence_series_ids)) {
      throw new TypeError(
        "Recurrence-family conflict ids must be an array",
      );
    }
    const seriesIds: string[] = [];
    const seen = new Set<string>();
    for (const entry of record.recurrence_series_ids) {
      if (typeof entry !== "string") {
        throw new TypeError("Recurrence-family id must be a string");
      }
      assertUuid(entry, "recurrence_series_id");
      if (seen.has(entry)) {
        throw new TypeError("Recurrence-family ids must be unique");
      }
      seen.add(entry);
      seriesIds.push(entry);
    }
    const sorted = [...seriesIds].sort();
    if (
      sorted.length === 0 ||
      sorted.some((id, index) => id !== seriesIds[index])
    ) {
      throw new TypeError(
        "Recurrence-family ids must be non-empty and sorted",
      );
    }
    const seriesSet = new Set(seriesIds);
    return {
      kind: "recurrence-family",
      recurrence_series_ids: seriesIds,
      ancestor: validateFamilySide(
        record.ancestor,
        seriesSet,
        "Recurrence-family ancestor",
      ),
      local: validateFamilySide(
        record.local,
        seriesSet,
        "Recurrence-family local",
      ),
      remote: validateFamilySide(
        record.remote,
        seriesSet,
        "Recurrence-family remote",
      ),
    };
  }

  throw new TypeError("Unknown Jig data conflict kind");
}

function validateTaskArray(
  value: unknown,
  label: string,
): readonly Task[] {
  if (!Array.isArray(value)) {
    throw new TypeError(`${label} must be an array`);
  }
  const tasks = value.map((entry) => validateTask(entry));
  let previousId: string | null = null;
  for (const task of tasks) {
    if (
      previousId !== null &&
      previousId.localeCompare(task.id) >= 0
    ) {
      throw new TypeError(
        `${label} must be uniquely and canonically ordered by Task id`,
      );
    }
    previousId = task.id;
  }
  return tasks;
}

function validateRecurrenceArray(
  value: unknown,
  label: string,
): readonly RecurrenceSeries[] {
  if (!Array.isArray(value)) {
    throw new TypeError(`${label} must be an array`);
  }
  const recurrences = value.map((entry) =>
    validateRecurrenceSeriesValue(entry, `${label} recurrence series`)
  );
  let previousId: string | null = null;
  for (const series of recurrences) {
    if (
      previousId !== null &&
      previousId.localeCompare(series.id) >= 0
    ) {
      throw new TypeError(
        `${label} must be uniquely and canonically ordered by recurrence id`,
      );
    }
    previousId = series.id;
  }
  return recurrences;
}

export function validateJigDataConflictCase(
  value: unknown,
): JigDataConflictCase {
  const record = exactObject(
    value,
    [
      "dataset_id",
      "ancestor_head",
      "local_head",
      "remote_head",
      "expected_revision",
      "ancestor_tasks",
      "local_tasks",
      "remote_tasks",
      "ancestor_recurrences",
      "local_recurrences",
      "remote_recurrences",
      "conflicts",
    ],
    "Jig data conflict case",
  );
  const datasetId = requiredString(
    record,
    "dataset_id",
    "Jig data conflict case",
  );
  assertUuid(datasetId, "dataset_id");
  const ancestorHead = validateObjectId(
    requiredString(record, "ancestor_head", "Jig data conflict case"),
    "ancestor_head",
  );
  const localHead = validateObjectId(
    requiredString(record, "local_head", "Jig data conflict case"),
    "local_head",
  );
  const remoteHead = validateObjectId(
    requiredString(record, "remote_head", "Jig data conflict case"),
    "remote_head",
  );
  const expectedRevision = requiredNonnegativeInteger(
    record,
    "expected_revision",
    "Jig data conflict case",
  );
  const ancestorTasks = validateTaskArray(
    record.ancestor_tasks,
    "ancestor_tasks",
  );
  const localTasks = validateTaskArray(
    record.local_tasks,
    "local_tasks",
  );
  const remoteTasks = validateTaskArray(
    record.remote_tasks,
    "remote_tasks",
  );
  const ancestorRecurrences = validateRecurrenceArray(
    record.ancestor_recurrences,
    "ancestor_recurrences",
  );
  const localRecurrences = validateRecurrenceArray(
    record.local_recurrences,
    "local_recurrences",
  );
  const remoteRecurrences = validateRecurrenceArray(
    record.remote_recurrences,
    "remote_recurrences",
  );
  assertRecurrenceState(ancestorTasks, ancestorRecurrences);
  assertRecurrenceState(localTasks, localRecurrences);
  assertRecurrenceState(remoteTasks, remoteRecurrences);

  if (!Array.isArray(record.conflicts)) {
    throw new TypeError("Jig data conflict case conflicts must be an array");
  }
  const conflicts = record.conflicts.map(validateConflict);
  const keys = new Set<string>();
  let previousConflictKey: string | null = null;
  for (const conflict of conflicts) {
    const key = jigDataConflictKey(conflict);
    if (
      keys.has(key) ||
      (
        previousConflictKey !== null &&
        previousConflictKey.localeCompare(key) >= 0
      )
    ) {
      throw new TypeError(
        "Jig data conflict keys must be unique and canonically ordered",
      );
    }
    keys.add(key);
    previousConflictKey = key;
  }

  return {
    dataset_id: datasetId,
    ancestor_head: ancestorHead,
    local_head: localHead,
    remote_head: remoteHead,
    expected_revision: expectedRevision,
    ancestor_tasks: ancestorTasks,
    local_tasks: localTasks,
    remote_tasks: remoteTasks,
    ancestor_recurrences: ancestorRecurrences,
    local_recurrences: localRecurrences,
    remote_recurrences: remoteRecurrences,
    conflicts,
  };
}

export function validateOptionalJigDataConflictCase(
  value: unknown,
): JigDataConflictCase | null {
  return value === null ? null : validateJigDataConflictCase(value);
}

function validateSide(value: unknown): ReconciliationSide {
  if (value === "local" || value === "remote") return value;
  throw new TypeError("Conflict side must be local or remote");
}

function validateConflictChoice(value: unknown): JigDataConflictChoice {
  const record = exactObject(
    value,
    ["conflict_key", "side"],
    "Jig data conflict choice",
  );
  return {
    conflict_key: requiredString(
      record,
      "conflict_key",
      "Jig data conflict choice",
    ),
    side: validateSide(record.side),
  };
}

function validateDateOrder(value: unknown): JigDataDateOrder {
  const record = exactObject(
    value,
    ["date", "task_ids"],
    "Jig data date order",
  );
  const date = requiredString(record, "date", "Jig data date order");
  assertCivilDate(date, "date");
  if (!Array.isArray(record.task_ids)) {
    throw new TypeError("Jig data date order task_ids must be an array");
  }
  const taskIds: string[] = [];
  const seen = new Set<string>();
  for (const entry of record.task_ids) {
    if (typeof entry !== "string") {
      throw new TypeError("Jig data date-order Task id must be a string");
    }
    assertUuid(entry, "task_id");
    if (seen.has(entry)) {
      throw new TypeError("Jig data date-order Task ids must be unique");
    }
    seen.add(entry);
    taskIds.push(entry);
  }
  return { date, task_ids: taskIds };
}

export function validateJigDataResolution(
  value: unknown,
): JigDataResolution {
  const record = exactObject(
    value,
    [
      "ancestor_head",
      "local_head",
      "remote_head",
      "expected_revision",
      "choices",
      "date_orders",
    ],
    "Jig data resolution",
  );
  if (!Array.isArray(record.choices) || !Array.isArray(record.date_orders)) {
    throw new TypeError(
      "Jig data resolution choices/date_orders must be arrays",
    );
  }
  const choices = record.choices.map(validateConflictChoice);
  const choiceKeys = new Set<string>();
  for (const choice of choices) {
    if (choiceKeys.has(choice.conflict_key)) {
      throw new TypeError("Jig data resolution conflict keys must be unique");
    }
    choiceKeys.add(choice.conflict_key);
  }
  const dateOrders = record.date_orders.map(validateDateOrder);
  const dates = new Set<string>();
  for (const order of dateOrders) {
    if (dates.has(order.date)) {
      throw new TypeError("Jig data resolution dates must be unique");
    }
    dates.add(order.date);
  }

  return {
    ancestor_head: validateObjectId(
      requiredString(record, "ancestor_head", "Jig data resolution"),
      "ancestor_head",
    ),
    local_head: validateObjectId(
      requiredString(record, "local_head", "Jig data resolution"),
      "local_head",
    ),
    remote_head: validateObjectId(
      requiredString(record, "remote_head", "Jig data resolution"),
      "remote_head",
    ),
    expected_revision: requiredNonnegativeInteger(
      record,
      "expected_revision",
      "Jig data resolution",
    ),
    choices,
    date_orders: dateOrders,
  };
}

export function recoveryCommitSpec(
  kind: RecoveryCommitKind,
  localHead: string,
  localCommitterTimestampSeconds: number,
  remoteHead: string,
  remoteCommitterTimestampSeconds: number,
): RecoveryCommitSpec {
  validateObjectId(localHead, "localHead");
  validateObjectId(remoteHead, "remoteHead");
  if (localHead === remoteHead) {
    throw new TypeError("Recovery requires distinct local and remote heads");
  }
  for (const [field, value] of [
    ["localCommitterTimestampSeconds", localCommitterTimestampSeconds],
    ["remoteCommitterTimestampSeconds", remoteCommitterTimestampSeconds],
  ]) {
    if (
      typeof value !== "number" ||
      !Number.isInteger(value) ||
      value < 0
    ) {
      throw new TypeError(`${field} must be a nonnegative integer`);
    }
  }
  if (kind !== "automatic" && kind !== "user-resolved") {
    throw new TypeError("Unknown recovery commit kind");
  }
  const sortedParents = [localHead, remoteHead].sort();
  const first = sortedParents[0];
  const second = sortedParents[1];
  if (first === undefined || second === undefined) {
    throw new TypeError("Recovery requires two parent object ids");
  }
  return {
    parents: [first, second],
    name: "Jig",
    email: "jig@local.invalid",
    timestamp_seconds:
      Math.max(
        localCommitterTimestampSeconds,
        remoteCommitterTimestampSeconds,
      ) + 1,
    timezone_offset_minutes: 0,
    message:
      kind === "automatic"
        ? "Reconcile Jig data"
        : "Resolve Jig sync conflict",
  };
}
