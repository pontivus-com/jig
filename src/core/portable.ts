import {
  assertUuid,
  type Task,
  validateTask,
} from "./task";
import {
  validateRecurrenceSeries,
  type RecurrencePattern,
  type RecurrenceSeries,
} from "./recurrence";
import { assertRecurrenceState } from "./recurrence-planning";

export const PORTABLE_FORMAT_VERSION = 2;

export interface PortableSnapshot {
  readonly dataset_id: string;
  readonly files: ReadonlyMap<string, string>;
  readonly tasks: readonly Task[];
  readonly recurrences: readonly RecurrenceSeries[];
}

export class SnapshotValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SnapshotValidationError";
  }
}

function canonicalTaskRecord(task: Task): Record<string, unknown> {
  return {
    completed_at: task.completed_at,
    context: task.context,
    created_at: task.created_at,
    id: task.id,
    note: task.note,
    position: task.position,
    priority: task.priority,
    reference: task.reference,
    reminder_time: task.reminder_time,
    recurrence_occurrence_date: task.recurrence_occurrence_date,
    recurrence_series_id: task.recurrence_series_id,
    scheduled_date: task.scheduled_date,
    title: task.title,
    updated_at: task.updated_at,
  };
}

function canonicalRecurrenceRecord(
  series: RecurrenceSeries,
): Record<string, unknown> {
  return {
    created_at: series.created_at,
    effective_from: series.effective_from,
    end_date: series.end_date,
    id: series.id,
    pattern: series.pattern,
    updated_at: series.updated_at,
  };
}

function stableJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function portableSnapshotsEqual(
  left: PortableSnapshot,
  right: PortableSnapshot,
): boolean {
  if (left.files.size !== right.files.size) {
    return false;
  }
  for (const [path, content] of left.files) {
    if (right.files.get(path) !== content) {
      return false;
    }
  }
  return true;
}

export function serializeSnapshot(
  tasks: readonly Task[],
  datasetId: string,
  recurrences: readonly RecurrenceSeries[] = [],
): PortableSnapshot {
  assertUuid(datasetId, "dataset_id");
  assertRecurrenceState(tasks, recurrences);

  const files = new Map<string, string>();
  files.set(
    "format.json",
    stableJson({
      dataset_id: datasetId,
      version: PORTABLE_FORMAT_VERSION,
    }),
  );

  for (const task of [...tasks].sort((left, right) =>
    left.id.localeCompare(right.id),
  )) {
    files.set(
      `tasks/${task.id}.json`,
      stableJson(canonicalTaskRecord(task)),
    );
  }

  for (const series of [...recurrences].sort((left, right) =>
    left.id.localeCompare(right.id),
  )) {
    files.set(
      `recurrences/${series.id}.json`,
      stableJson(canonicalRecurrenceRecord(series)),
    );
  }

  return {
    dataset_id: datasetId,
    files,
    tasks: [...tasks],
    recurrences: [...recurrences],
  };
}

function isUnknownRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function parseJsonObject(
  content: string,
  path: string,
): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new SnapshotValidationError(`${path} is not valid JSON`);
  }

  if (!isUnknownRecord(parsed)) {
    throw new SnapshotValidationError(
      `${path} must contain a JSON object`,
    );
  }
  return parsed;
}

function exactKeys(
  object: Record<string, unknown>,
  keys: readonly string[],
  path: string,
  meaning: string,
): void {
  const actualKeys = Object.keys(object).sort();
  const expectedKeys = [...keys].sort();
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key, index) => key !== expectedKeys[index])
  ) {
    throw new SnapshotValidationError(
      `${path} does not contain exactly the canonical ${meaning} fields`,
    );
  }
}

function parseTaskRecord(
  content: string,
  path: string,
  expectedId: string,
  version: 1 | 2,
): Task {
  const raw = parseJsonObject(content, path);
  const v1Keys = [
    "completed_at",
    "context",
    "created_at",
    "id",
    "note",
    "position",
    "priority",
    "reference",
    "reminder_time",
    "scheduled_date",
    "title",
    "updated_at",
  ] as const;
  const v2Keys = [
    ...v1Keys,
    "recurrence_occurrence_date",
    "recurrence_series_id",
  ] as const;
  exactKeys(raw, version === 1 ? v1Keys : v2Keys, path, "Task");

  const object =
    version === 1
      ? {
          ...raw,
          recurrence_series_id: null,
          recurrence_occurrence_date: null,
        }
      : raw;
  const task = validateTask(object);
  if (task.id !== expectedId) {
    throw new SnapshotValidationError(
      `${path} id does not match its filename`,
    );
  }
  return task;
}

function parseRecurrencePattern(
  value: unknown,
  path: string,
): RecurrencePattern {
  if (!isUnknownRecord(value)) {
    throw new SnapshotValidationError(
      `${path} pattern must be an object`,
    );
  }
  if (value.kind === "weekly") {
    exactKeys(
      value,
      ["kind", "interval_weeks", "weekdays"],
      `${path}.pattern`,
      "weekly recurrence pattern",
    );
    if (
      typeof value.interval_weeks !== "number" ||
      !Array.isArray(value.weekdays) ||
      !value.weekdays.every((weekday) => typeof weekday === "string")
    ) {
      throw new SnapshotValidationError(
        `${path} weekly recurrence pattern is invalid`,
      );
    }
    const weekdays = value.weekdays.filter(
      (weekday) =>
        weekday === "MON" ||
        weekday === "TUE" ||
        weekday === "WED" ||
        weekday === "THU" ||
        weekday === "FRI" ||
        weekday === "SAT" ||
        weekday === "SUN",
    );
    if (weekdays.length !== value.weekdays.length) {
      throw new SnapshotValidationError(
        `${path} weekly recurrence weekday is invalid`,
      );
    }
    return {
      kind: "weekly",
      interval_weeks: value.interval_weeks,
      weekdays,
    };
  }
  if (value.kind === "monthly") {
    exactKeys(
      value,
      ["kind", "day_of_month"],
      `${path}.pattern`,
      "monthly recurrence pattern",
    );
    if (typeof value.day_of_month !== "number") {
      throw new SnapshotValidationError(
        `${path} monthly recurrence pattern is invalid`,
      );
    }
    return {
      kind: "monthly",
      day_of_month: value.day_of_month,
    };
  }
  throw new SnapshotValidationError(
    `${path} recurrence pattern kind is invalid`,
  );
}

function requirePortableString(
  object: Record<string, unknown>,
  key: string,
  path: string,
): string {
  const value = object[key];
  if (typeof value !== "string") {
    throw new SnapshotValidationError(
      `${path} ${key} must be a string`,
    );
  }
  return value;
}

function parseRecurrenceRecord(
  content: string,
  path: string,
  expectedId: string,
): RecurrenceSeries {
  const object = parseJsonObject(content, path);
  exactKeys(
    object,
    [
      "created_at",
      "effective_from",
      "end_date",
      "id",
      "pattern",
      "updated_at",
    ],
    path,
    "RecurrenceSeries",
  );
  const series = validateRecurrenceSeries({
    id: requirePortableString(object, "id", path),
    effective_from: requirePortableString(
      object,
      "effective_from",
      path,
    ),
    end_date: requirePortableString(object, "end_date", path),
    pattern: parseRecurrencePattern(object.pattern, path),
    created_at: requirePortableString(object, "created_at", path),
    updated_at: requirePortableString(object, "updated_at", path),
  });
  if (series.id !== expectedId) {
    throw new SnapshotValidationError(
      `${path} id does not match its filename`,
    );
  }
  return series;
}

export function validateSnapshot(
  files: ReadonlyMap<string, string>,
  expectedDatasetId?: string,
): PortableSnapshot {
  const formatContent = files.get("format.json");
  if (formatContent === undefined) {
    throw new SnapshotValidationError("format.json is missing");
  }

  const format = parseJsonObject(formatContent, "format.json");
  const version =
    format.version === 1 || format.version === 2
      ? format.version
      : null;
  if (
    version === null ||
    typeof format.dataset_id !== "string"
  ) {
    throw new SnapshotValidationError(
      "format.json has an unsupported format version or dataset identity",
    );
  }
  assertUuid(format.dataset_id, "dataset_id");

  if (
    expectedDatasetId !== undefined &&
    format.dataset_id !== expectedDatasetId
  ) {
    throw new SnapshotValidationError(
      "Snapshot dataset identity does not match the configured dataset",
    );
  }

  const tasks: Task[] = [];
  const recurrences: RecurrenceSeries[] = [];
  const taskIds = new Set<string>();
  const recurrenceIds = new Set<string>();

  for (const [path, content] of files) {
    if (path === "format.json") {
      continue;
    }

    const taskMatch = /^tasks\/([0-9a-f-]+)\.json$/i.exec(path);
    if (taskMatch !== null && taskMatch[1] !== undefined) {
      const task = parseTaskRecord(
        content,
        path,
        taskMatch[1],
        version,
      );
      if (taskIds.has(task.id)) {
        throw new SnapshotValidationError(
          `Duplicate Task id ${task.id} in snapshot`,
        );
      }
      taskIds.add(task.id);
      tasks.push(task);
      continue;
    }

    const recurrenceMatch =
      /^recurrences\/([0-9a-f-]+)\.json$/i.exec(path);
    if (
      version === 2 &&
      recurrenceMatch !== null &&
      recurrenceMatch[1] !== undefined
    ) {
      const series = parseRecurrenceRecord(
        content,
        path,
        recurrenceMatch[1],
      );
      if (recurrenceIds.has(series.id)) {
        throw new SnapshotValidationError(
          `Duplicate recurrence series id ${series.id} in snapshot`,
        );
      }
      recurrenceIds.add(series.id);
      recurrences.push(series);
      continue;
    }

    throw new SnapshotValidationError(
      `Unexpected portable snapshot path ${path}`,
    );
  }

  assertRecurrenceState(tasks, recurrences);
  return {
    dataset_id: format.dataset_id,
    files: new Map(files),
    tasks,
    recurrences,
  };
}
