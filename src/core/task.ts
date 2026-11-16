export const PRIORITIES = ["HIGH", "NORMAL", "LOW"] as const;
export type Priority = (typeof PRIORITIES)[number];

export interface TaskEditChanges {
  readonly title?: string;
  readonly scheduled_date?: string;
  readonly priority?: Priority;
  readonly context?: string | null;
  readonly reference?: string | null;
  readonly note?: string | null;
  readonly reminder_time?: string | null;
}

export type TaskCommand =
  | {
      readonly type: "create";
      readonly title: string;
      readonly scheduled_date: string;
      readonly priority?: Priority;
      readonly context?: string | null;
      readonly reference?: string | null;
      readonly note?: string | null;
      readonly reminder_time?: string | null;
    }
  | {
      readonly type: "edit";
      readonly task_id: string;
      readonly changes: TaskEditChanges;
    }
  | {
      readonly type: "move";
      readonly task_id: string;
      readonly destination_date: string;
      readonly destination_index: number;
    }
  | { readonly type: "complete"; readonly task_id: string }
  | { readonly type: "reopen"; readonly task_id: string }
  | { readonly type: "delete"; readonly task_id: string };

export interface Task {
  readonly id: string;
  readonly title: string;
  readonly scheduled_date: string;
  readonly position: number | null;
  readonly priority: Priority;
  readonly context: string | null;
  readonly reference: string | null;
  readonly note: string | null;
  readonly reminder_time: string | null;
  readonly completed_at: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export class TaskValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TaskValidationError";
  }
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CIVIL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const LOCAL_TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const UTC_INSTANT_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

export function isPriority(value: unknown): value is Priority {
  return typeof value === "string" && PRIORITIES.includes(value as Priority);
}

export function assertUuid(value: string, field = "id"): void {
  if (!UUID_PATTERN.test(value)) {
    throw new TaskValidationError(`${field} must be a UUID`);
  }
}

export function assertCivilDate(
  value: string,
  field = "scheduled_date",
): void {
  const match = CIVIL_DATE_PATTERN.exec(value);
  if (match === null) {
    throw new TaskValidationError(`${field} must use YYYY-MM-DD`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new TaskValidationError(`${field} must be a real civil date`);
  }
}

export function assertLocalTime(
  value: string,
  field = "reminder_time",
): void {
  if (!LOCAL_TIME_PATTERN.test(value)) {
    throw new TaskValidationError(`${field} must use HH:mm`);
  }
}

export function assertUtcInstant(value: string, field: string): void {
  if (!UTC_INSTANT_PATTERN.test(value) || Number.isNaN(Date.parse(value))) {
    throw new TaskValidationError(`${field} must be a UTC ISO instant`);
  }
}

function assertOptionalText(value: string | null, field: string): void {
  if (value !== null && value.trim().length === 0) {
    throw new TaskValidationError(
      `${field} must be null or nonblank text`,
    );
  }
}

export function validateTask(value: unknown): Task {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TaskValidationError("Task must be an object");
  }

  const task = value as Record<string, unknown>;
  const expectedKeys = [
    "id",
    "title",
    "scheduled_date",
    "position",
    "priority",
    "context",
    "reference",
    "note",
    "reminder_time",
    "completed_at",
    "created_at",
    "updated_at",
  ] as const;

  const actualKeys = Object.keys(task).sort();
  const sortedExpectedKeys = [...expectedKeys].sort();
  if (
    actualKeys.length !== sortedExpectedKeys.length ||
    actualKeys.some((key, index) => key !== sortedExpectedKeys[index])
  ) {
    throw new TaskValidationError(
      "Task must contain exactly the canonical Task fields",
    );
  }

  const id = task.id;
  const title = task.title;
  const scheduledDate = task.scheduled_date;
  const position = task.position;
  const priority = task.priority;
  const context = task.context;
  const reference = task.reference;
  const note = task.note;
  const reminderTime = task.reminder_time;
  const completedAt = task.completed_at;
  const createdAt = task.created_at;
  const updatedAt = task.updated_at;

  if (typeof id !== "string") {
    throw new TaskValidationError("id must be a string");
  }
  assertUuid(id);

  if (typeof title !== "string") {
    throw new TaskValidationError("title must be a string");
  }
  if (title.trim().length === 0) {
    throw new TaskValidationError("title must be nonblank");
  }
  if (title !== title.trim()) {
    throw new TaskValidationError("title must be trimmed");
  }

  if (typeof scheduledDate !== "string") {
    throw new TaskValidationError("scheduled_date must be a string");
  }
  assertCivilDate(scheduledDate);

  if (!isPriority(priority)) {
    throw new TaskValidationError("priority is invalid");
  }

  for (const [field, fieldValue] of [
    ["context", context],
    ["reference", reference],
    ["note", note],
  ] as const) {
    if (fieldValue !== null && typeof fieldValue !== "string") {
      throw new TaskValidationError(`${field} must be null or a string`);
    }
    assertOptionalText(fieldValue, field);
  }

  if (
    reminderTime !== null &&
    typeof reminderTime !== "string"
  ) {
    throw new TaskValidationError(
      "reminder_time must be null or a string",
    );
  }
  if (reminderTime !== null) {
    assertLocalTime(reminderTime);
  }

  if (
    completedAt !== null &&
    typeof completedAt !== "string"
  ) {
    throw new TaskValidationError(
      "completed_at must be null or a string",
    );
  }

  if (completedAt === null) {
    if (
      typeof position !== "number" ||
      !Number.isInteger(position) ||
      position < 0
    ) {
      throw new TaskValidationError(
        "outstanding task position must be a nonnegative integer",
      );
    }
  } else {
    assertUtcInstant(completedAt, "completed_at");
    if (position !== null) {
      throw new TaskValidationError(
        "completed task position must be null",
      );
    }
  }

  if (typeof createdAt !== "string") {
    throw new TaskValidationError("created_at must be a string");
  }
  if (typeof updatedAt !== "string") {
    throw new TaskValidationError("updated_at must be a string");
  }
  assertUtcInstant(createdAt, "created_at");
  assertUtcInstant(updatedAt, "updated_at");

  if (Date.parse(updatedAt) < Date.parse(createdAt)) {
    throw new TaskValidationError(
      "updated_at must not precede created_at",
    );
  }

  if (
    completedAt !== null &&
    Date.parse(completedAt) < Date.parse(createdAt)
  ) {
    throw new TaskValidationError(
      "completed_at must not precede created_at",
    );
  }

  return {
    id,
    title,
    scheduled_date: scheduledDate,
    position: position as number | null,
    priority,
    context: context as string | null,
    reference: reference as string | null,
    note: note as string | null,
    reminder_time: reminderTime,
    completed_at: completedAt,
    created_at: createdAt,
    updated_at: updatedAt,
  };
}

export function normalizeOptionalText(
  value: string | null | undefined,
): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export function normalizeTitle(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new TaskValidationError("title must be nonblank");
  }
  return trimmed;
}
