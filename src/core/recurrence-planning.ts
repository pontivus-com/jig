import {
  createRecurrenceSeries,
  enumerateRecurrenceDates,
  validateRecurrenceSeries,
  validateRecurrenceSpec,
  type RecurrenceSeries,
  type RecurrenceSpec,
} from "./recurrence";
import {
  assertTaskSet,
  createTask,
  deleteTask,
  PlanningError,
} from "./planning";
import {
  assertUtcInstant,
  validateTask,
  type Task,
} from "./task";

export interface RecurrencePlanningState {
  readonly tasks: readonly Task[];
  readonly recurrences: readonly RecurrenceSeries[];
}

export interface RecurrenceMutationResult extends RecurrencePlanningState {
  readonly task: Task;
}

function taskById(tasks: readonly Task[], taskId: string): Task {
  const task = tasks.find((candidate) => candidate.id === taskId);
  if (task === undefined) {
    throw new PlanningError("NOT_FOUND", `Task ${taskId} does not exist`);
  }
  return task;
}

function seriesById(
  recurrences: readonly RecurrenceSeries[],
  seriesId: string,
): RecurrenceSeries {
  const series = recurrences.find((candidate) => candidate.id === seriesId);
  if (series === undefined) {
    throw new PlanningError(
      "INVALID_OPERATION",
      `Recurrence series ${seriesId} does not exist`,
    );
  }
  return series;
}

function replaceTask(
  tasks: readonly Task[],
  replacement: Task,
): readonly Task[] {
  return tasks.map((task) =>
    task.id === replacement.id ? replacement : task,
  );
}

function replaceSeries(
  recurrences: readonly RecurrenceSeries[],
  replacement: RecurrenceSeries,
): readonly RecurrenceSeries[] {
  return recurrences.map((series) =>
    series.id === replacement.id ? replacement : series,
  );
}

function copiedOccurrence(
  source: Task,
  id: string,
  seriesId: string,
  slot: string,
  now: string,
): Task {
  return validateTask({
    id,
    title: source.title,
    scheduled_date: slot,
    position: 0,
    priority: source.priority,
    context: source.context,
    reference: source.reference,
    note: source.note,
    reminder_time: source.reminder_time,
    recurrence_series_id: seriesId,
    recurrence_occurrence_date: slot,
    completed_at: null,
    created_at: now,
    updated_at: now,
  });
}

function linkOccurrence(
  task: Task,
  seriesId: string,
  slot: string,
  now: string,
): Task {
  return validateTask({
    ...task,
    recurrence_series_id: seriesId,
    recurrence_occurrence_date: slot,
    updated_at: now,
  });
}

export function assertRecurrenceState(
  tasks: readonly Task[],
  recurrences: readonly RecurrenceSeries[],
): void {
  assertTaskSet(tasks);

  const seriesIds = new Set<string>();
  for (const series of recurrences) {
    const validated = validateRecurrenceSeries(series);
    if (seriesIds.has(validated.id)) {
      throw new PlanningError(
        "INVALID_OPERATION",
        `Duplicate recurrence series id ${validated.id}`,
      );
    }
    seriesIds.add(validated.id);
  }

  const linkedSeries = new Set<string>();
  for (const task of tasks) {
    if (task.recurrence_series_id === null) {
      continue;
    }
    if (!seriesIds.has(task.recurrence_series_id)) {
      throw new PlanningError(
        "INVALID_OPERATION",
        `Task ${task.id} references missing recurrence series ${task.recurrence_series_id}`,
      );
    }
    linkedSeries.add(task.recurrence_series_id);
  }

  for (const series of recurrences) {
    if (!linkedSeries.has(series.id)) {
      throw new PlanningError(
        "INVALID_OPERATION",
        `Recurrence series ${series.id} has no linked Tasks`,
      );
    }
  }
}

function addGeneratedOccurrences(
  tasks: readonly Task[],
  source: Task,
  seriesId: string,
  dates: readonly string[],
  createId: () => string,
  now: string,
): readonly Task[] {
  let nextTasks = tasks;
  for (const date of dates) {
    const generated = copiedOccurrence(
      source,
      createId(),
      seriesId,
      date,
      now,
    );
    nextTasks = createTask(nextTasks, generated).tasks;
  }
  return nextTasks;
}

export function enableTaskRecurrence(
  tasks: readonly Task[],
  recurrences: readonly RecurrenceSeries[],
  taskId: string,
  spec: RecurrenceSpec,
  createSeriesId: () => string,
  createTaskId: () => string,
  now: string,
): RecurrenceMutationResult {
  assertRecurrenceState(tasks, recurrences);
  assertUtcInstant(now, "updated_at");
  const current = taskById(tasks, taskId);
  if (current.recurrence_series_id !== null) {
    throw new PlanningError(
      "INVALID_OPERATION",
      "Task already belongs to a recurrence series",
    );
  }

  const normalized = validateRecurrenceSpec(spec, current.scheduled_date);
  const series = createRecurrenceSeries(
    createSeriesId(),
    current.scheduled_date,
    normalized,
    now,
  );
  const linked = linkOccurrence(
    current,
    series.id,
    current.scheduled_date,
    now,
  );
  let nextTasks = replaceTask(tasks, linked);
  nextTasks = addGeneratedOccurrences(
    nextTasks,
    linked,
    series.id,
    enumerateRecurrenceDates(series.effective_from, normalized),
    createTaskId,
    now,
  );
  const nextRecurrences = [...recurrences, series];
  assertRecurrenceState(nextTasks, nextRecurrences);
  return {
    tasks: nextTasks,
    recurrences: nextRecurrences,
    task: taskById(nextTasks, taskId),
  };
}

export function changeTaskRecurrence(
  tasks: readonly Task[],
  recurrences: readonly RecurrenceSeries[],
  taskId: string,
  spec: RecurrenceSpec,
  createTaskId: () => string,
  now: string,
): RecurrenceMutationResult {
  assertRecurrenceState(tasks, recurrences);
  assertUtcInstant(now, "updated_at");
  const invoking = taskById(tasks, taskId);
  const seriesId = invoking.recurrence_series_id;
  const anchor = invoking.recurrence_occurrence_date;
  if (seriesId === null || anchor === null) {
    throw new PlanningError(
      "INVALID_OPERATION",
      "Task does not belong to a recurrence series",
    );
  }

  const currentSeries = seriesById(recurrences, seriesId);
  const normalized = validateRecurrenceSpec(spec, anchor);
  const desiredDates = new Set(
    enumerateRecurrenceDates(anchor, normalized),
  );

  let nextTasks = tasks;
  const laterOutstanding = tasks.filter(
    (task) =>
      task.id !== invoking.id &&
      task.recurrence_series_id === seriesId &&
      task.recurrence_occurrence_date !== null &&
      task.recurrence_occurrence_date > anchor &&
      task.completed_at === null,
  );

  for (const candidate of laterOutstanding) {
    const slot = candidate.recurrence_occurrence_date;
    if (slot !== null && !desiredDates.has(slot)) {
      nextTasks = deleteTask(nextTasks, candidate.id, now).tasks;
    }
  }

  const existingSlots = new Set(
    nextTasks
      .filter((task) => task.recurrence_series_id === seriesId)
      .map((task) => task.recurrence_occurrence_date)
      .filter((slot): slot is string => slot !== null),
  );
  const newDates = [...desiredDates].filter(
    (date) => !existingSlots.has(date),
  );
  nextTasks = addGeneratedOccurrences(
    nextTasks,
    invoking,
    seriesId,
    newDates,
    createTaskId,
    now,
  );

  const updatedSeries = validateRecurrenceSeries({
    ...currentSeries,
    effective_from: anchor,
    end_date: normalized.end_date,
    pattern: normalized.pattern,
    updated_at: now,
  });
  const nextRecurrences = replaceSeries(
    recurrences,
    updatedSeries,
  );
  assertRecurrenceState(nextTasks, nextRecurrences);
  return {
    tasks: nextTasks,
    recurrences: nextRecurrences,
    task: taskById(nextTasks, taskId),
  };
}

export function stopTaskRecurrence(
  tasks: readonly Task[],
  recurrences: readonly RecurrenceSeries[],
  taskId: string,
  now: string,
): RecurrenceMutationResult {
  assertRecurrenceState(tasks, recurrences);
  assertUtcInstant(now, "updated_at");
  const invoking = taskById(tasks, taskId);
  const seriesId = invoking.recurrence_series_id;
  if (
    seriesId === null ||
    invoking.recurrence_occurrence_date === null
  ) {
    throw new PlanningError(
      "INVALID_OPERATION",
      "Task does not belong to a recurrence series",
    );
  }

  let nextTasks = replaceTask(
    tasks,
    validateTask({
      ...invoking,
      recurrence_series_id: null,
      recurrence_occurrence_date: null,
      updated_at: now,
    }),
  );

  const outstandingToRemove = nextTasks.filter(
    (task) =>
      task.id !== taskId &&
      task.recurrence_series_id === seriesId &&
      task.completed_at === null,
  );
  for (const task of outstandingToRemove) {
    nextTasks = deleteTask(nextTasks, task.id, now).tasks;
  }

  const stillLinked = nextTasks.some(
    (task) => task.recurrence_series_id === seriesId,
  );
  const nextRecurrences = stillLinked
    ? recurrences
    : recurrences.filter((series) => series.id !== seriesId);

  assertRecurrenceState(nextTasks, nextRecurrences);
  return {
    tasks: nextTasks,
    recurrences: nextRecurrences,
    task: taskById(nextTasks, taskId),
  };
}

export function setTaskRecurrence(
  tasks: readonly Task[],
  recurrences: readonly RecurrenceSeries[],
  taskId: string,
  recurrence: RecurrenceSpec | null,
  createSeriesId: () => string,
  createTaskId: () => string,
  now: string,
): RecurrenceMutationResult {
  const current = taskById(tasks, taskId);
  if (recurrence === null) {
    return stopTaskRecurrence(
      tasks,
      recurrences,
      taskId,
      now,
    );
  }
  if (current.recurrence_series_id === null) {
    return enableTaskRecurrence(
      tasks,
      recurrences,
      taskId,
      recurrence,
      createSeriesId,
      createTaskId,
      now,
    );
  }
  return changeTaskRecurrence(
    tasks,
    recurrences,
    taskId,
    recurrence,
    createTaskId,
    now,
  );
}
