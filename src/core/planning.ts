import {
  assertCivilDate,
  assertUtcInstant,
  normalizeOptionalText,
  normalizeTitle,
  type Priority,
  type Task,
  type TaskEditChanges,
  validateTask,
} from "./task";

export type PlanningErrorCode = "NOT_FOUND" | "INVALID_OPERATION";

export class PlanningError extends Error {
  readonly code: PlanningErrorCode;

  constructor(code: PlanningErrorCode, message: string) {
    super(message);
    this.name = "PlanningError";
    this.code = code;
  }
}

export interface DayAttention {
  readonly carried_over: readonly Task[];
  readonly scheduled: readonly Task[];
}

export interface HistoryGroup {
  readonly completion_date: string;
  readonly tasks: readonly Task[];
}

const PRIORITY_SCORE: Readonly<Record<Priority, number>> = {
  HIGH: 3,
  NORMAL: 2,
  LOW: 1,
};

function taskById(tasks: readonly Task[], taskId: string): Task {
  const task = tasks.find((candidate) => candidate.id === taskId);
  if (task === undefined) {
    throw new PlanningError("NOT_FOUND", `Task ${taskId} does not exist`);
  }
  return task;
}

function activeSequence(
  tasks: readonly Task[],
  scheduledDate: string,
  excludedId?: string,
): Task[] {
  return tasks
    .filter(
      (task) =>
        task.completed_at === null &&
        task.scheduled_date === scheduledDate &&
        task.id !== excludedId,
    )
    .sort((left, right) => (left.position ?? 0) - (right.position ?? 0));
}

function applyActiveSequence(
  tasks: readonly Task[],
  scheduledDate: string,
  sequence: readonly Task[],
  updatedAt: string,
): Task[] {
  const desired = new Map(
    sequence.map((task, position) => [task.id, position] as const),
  );

  return tasks.map((task) => {
    if (
      task.completed_at !== null ||
      task.scheduled_date !== scheduledDate
    ) {
      return task;
    }

    const position = desired.get(task.id);
    if (position === undefined) {
      throw new PlanningError(
        "INVALID_OPERATION",
        `Active sequence omitted Task ${task.id}`,
      );
    }

    if (task.position === position) {
      return task;
    }

    return {
      ...task,
      position,
      updated_at: updatedAt,
    };
  });
}

function replaceTask(
  tasks: readonly Task[],
  replacement: Task,
): Task[] {
  return tasks.map((task) =>
    task.id === replacement.id ? replacement : task,
  );
}

function insertionIndexForPriority(
  sequence: readonly Task[],
  priority: Priority,
): number {
  let index = 0;
  for (let cursor = 0; cursor < sequence.length; cursor += 1) {
    const candidate = sequence[cursor];
    if (
      candidate !== undefined &&
      PRIORITY_SCORE[candidate.priority] >= PRIORITY_SCORE[priority]
    ) {
      index = cursor + 1;
    }
  }
  return index;
}

export function assertTaskSet(tasks: readonly Task[]): void {
  const ids = new Set<string>();
  const positionsByDate = new Map<string, number[]>();

  for (const task of tasks) {
    validateTask(task);
    if (ids.has(task.id)) {
      throw new PlanningError(
        "INVALID_OPERATION",
        `Duplicate Task id ${task.id}`,
      );
    }
    ids.add(task.id);

    if (task.completed_at === null) {
      const positions = positionsByDate.get(task.scheduled_date) ?? [];
      positions.push(task.position as number);
      positionsByDate.set(task.scheduled_date, positions);
    }
  }

  for (const [scheduledDate, positions] of positionsByDate) {
    positions.sort((left, right) => left - right);
    for (let index = 0; index < positions.length; index += 1) {
      if (positions[index] !== index) {
        throw new PlanningError(
          "INVALID_OPERATION",
          `Outstanding positions for ${scheduledDate} must be contiguous from zero`,
        );
      }
    }
  }
}

export function createTask(
  tasks: readonly Task[],
  task: Task,
): { readonly tasks: readonly Task[]; readonly task: Task } {
  assertTaskSet(tasks);
  validateTask(task);

  if (task.completed_at !== null) {
    throw new PlanningError(
      "INVALID_OPERATION",
      "A newly created Task must be outstanding",
    );
  }
  if (tasks.some((candidate) => candidate.id === task.id)) {
    throw new PlanningError(
      "INVALID_OPERATION",
      `Task ${task.id} already exists`,
    );
  }

  const sequence = activeSequence(tasks, task.scheduled_date);
  const insertionIndex = insertionIndexForPriority(sequence, task.priority);
  const inserted: Task = {
    ...task,
    position: insertionIndex,
  };
  const nextSequence = [
    ...sequence.slice(0, insertionIndex),
    inserted,
    ...sequence.slice(insertionIndex),
  ];

  let nextTasks = [...tasks, inserted];
  nextTasks = applyActiveSequence(
    nextTasks,
    task.scheduled_date,
    nextSequence,
    task.updated_at,
  );
  assertTaskSet(nextTasks);

  return {
    tasks: nextTasks,
    task: taskById(nextTasks, task.id),
  };
}

export function editTask(
  tasks: readonly Task[],
  taskId: string,
  changes: TaskEditChanges,
  updatedAt: string,
): { readonly tasks: readonly Task[]; readonly task: Task } {
  assertTaskSet(tasks);
  assertUtcInstant(updatedAt, "updated_at");

  const current = taskById(tasks, taskId);
  const nextScheduledDate =
    changes.scheduled_date ?? current.scheduled_date;
  assertCivilDate(nextScheduledDate);

  const edited: Task = validateTask({
    ...current,
    title:
      changes.title === undefined
        ? current.title
        : normalizeTitle(changes.title),
    scheduled_date: nextScheduledDate,
    priority: changes.priority ?? current.priority,
    context:
      changes.context === undefined
        ? current.context
        : normalizeOptionalText(changes.context),
    reference:
      changes.reference === undefined
        ? current.reference
        : normalizeOptionalText(changes.reference),
    note:
      changes.note === undefined
        ? current.note
        : normalizeOptionalText(changes.note),
    reminder_time:
      changes.reminder_time === undefined
        ? current.reminder_time
        : changes.reminder_time,
    updated_at: updatedAt,
  });

  if (
    current.completed_at !== null ||
    nextScheduledDate === current.scheduled_date
  ) {
    const nextTasks = replaceTask(tasks, edited);
    assertTaskSet(nextTasks);
    return { tasks: nextTasks, task: edited };
  }

  const sourceSequence = activeSequence(
    tasks,
    current.scheduled_date,
    current.id,
  );
  let nextTasks = tasks.filter((task) => task.id !== current.id);
  nextTasks = applyActiveSequence(
    nextTasks,
    current.scheduled_date,
    sourceSequence,
    updatedAt,
  );

  const destination = activeSequence(nextTasks, nextScheduledDate);
  const insertionIndex = insertionIndexForPriority(
    destination,
    edited.priority,
  );
  const moved: Task = {
    ...edited,
    position: insertionIndex,
  };
  const destinationSequence = [
    ...destination.slice(0, insertionIndex),
    moved,
    ...destination.slice(insertionIndex),
  ];

  nextTasks = [...nextTasks, moved];
  nextTasks = applyActiveSequence(
    nextTasks,
    nextScheduledDate,
    destinationSequence,
    updatedAt,
  );
  assertTaskSet(nextTasks);

  return {
    tasks: nextTasks,
    task: taskById(nextTasks, taskId),
  };
}

export function moveTask(
  tasks: readonly Task[],
  taskId: string,
  destinationDate: string,
  destinationIndex: number,
  updatedAt: string,
): { readonly tasks: readonly Task[]; readonly task: Task } {
  assertTaskSet(tasks);
  assertCivilDate(destinationDate, "destination_date");
  assertUtcInstant(updatedAt, "updated_at");

  if (!Number.isInteger(destinationIndex) || destinationIndex < 0) {
    throw new PlanningError(
      "INVALID_OPERATION",
      "destination_index must be a nonnegative integer",
    );
  }

  const current = taskById(tasks, taskId);
  if (current.completed_at !== null) {
    throw new PlanningError(
      "INVALID_OPERATION",
      "Completed Tasks cannot be moved in active ordering",
    );
  }

  const sourceDate = current.scheduled_date;
  const sourceSequence = activeSequence(tasks, sourceDate, taskId);

  if (sourceDate === destinationDate) {
    if (destinationIndex > sourceSequence.length) {
      throw new PlanningError(
        "INVALID_OPERATION",
        "destination_index exceeds the same-date sequence",
      );
    }

    const moved: Task = {
      ...current,
      updated_at: updatedAt,
    };
    const sequence = [
      ...sourceSequence.slice(0, destinationIndex),
      moved,
      ...sourceSequence.slice(destinationIndex),
    ];
    let nextTasks = replaceTask(tasks, moved);
    nextTasks = applyActiveSequence(
      nextTasks,
      sourceDate,
      sequence,
      updatedAt,
    );
    assertTaskSet(nextTasks);
    return {
      tasks: nextTasks,
      task: taskById(nextTasks, taskId),
    };
  }

  const destinationSequence = activeSequence(tasks, destinationDate);
  if (destinationIndex > destinationSequence.length) {
    throw new PlanningError(
      "INVALID_OPERATION",
      "destination_index exceeds the destination sequence",
    );
  }

  const moved: Task = {
    ...current,
    scheduled_date: destinationDate,
    position: destinationIndex,
    updated_at: updatedAt,
  };

  let nextTasks = replaceTask(tasks, moved);
  nextTasks = applyActiveSequence(
    nextTasks,
    sourceDate,
    sourceSequence,
    updatedAt,
  );

  const destinationWithMoved = [
    ...destinationSequence.slice(0, destinationIndex),
    moved,
    ...destinationSequence.slice(destinationIndex),
  ];
  nextTasks = applyActiveSequence(
    nextTasks,
    destinationDate,
    destinationWithMoved,
    updatedAt,
  );
  assertTaskSet(nextTasks);

  return {
    tasks: nextTasks,
    task: taskById(nextTasks, taskId),
  };
}

export function completeTask(
  tasks: readonly Task[],
  taskId: string,
  completedAt: string,
): { readonly tasks: readonly Task[]; readonly task: Task } {
  assertTaskSet(tasks);
  assertUtcInstant(completedAt, "completed_at");

  const current = taskById(tasks, taskId);
  if (current.completed_at !== null) {
    throw new PlanningError(
      "INVALID_OPERATION",
      "Task is already completed",
    );
  }

  const completed: Task = validateTask({
    ...current,
    position: null,
    completed_at: completedAt,
    updated_at: completedAt,
  });

  const sequence = activeSequence(
    tasks,
    current.scheduled_date,
    current.id,
  );
  let nextTasks = replaceTask(tasks, completed);
  nextTasks = applyActiveSequence(
    nextTasks,
    current.scheduled_date,
    sequence,
    completedAt,
  );
  assertTaskSet(nextTasks);

  return { tasks: nextTasks, task: completed };
}

export function reopenTask(
  tasks: readonly Task[],
  taskId: string,
  updatedAt: string,
): { readonly tasks: readonly Task[]; readonly task: Task } {
  assertTaskSet(tasks);
  assertUtcInstant(updatedAt, "updated_at");

  const current = taskById(tasks, taskId);
  if (current.completed_at === null) {
    throw new PlanningError(
      "INVALID_OPERATION",
      "Task is already outstanding",
    );
  }

  const sequence = activeSequence(tasks, current.scheduled_date);
  const reopened: Task = validateTask({
    ...current,
    position: sequence.length,
    completed_at: null,
    updated_at: updatedAt,
  });

  const nextTasks = [...replaceTask(tasks, reopened)];
  assertTaskSet(nextTasks);
  return { tasks: nextTasks, task: reopened };
}

export function deleteTask(
  tasks: readonly Task[],
  taskId: string,
  updatedAt: string,
): { readonly tasks: readonly Task[]; readonly deleted_task_id: string } {
  assertTaskSet(tasks);
  assertUtcInstant(updatedAt, "updated_at");

  const current = taskById(tasks, taskId);
  let nextTasks = tasks.filter((task) => task.id !== taskId);

  if (current.completed_at === null) {
    const sequence = activeSequence(nextTasks, current.scheduled_date);
    nextTasks = applyActiveSequence(
      nextTasks,
      current.scheduled_date,
      sequence,
      updatedAt,
    );
  }

  assertTaskSet(nextTasks);
  return { tasks: nextTasks, deleted_task_id: taskId };
}

export function rollForwardOutstanding(
  tasks: readonly Task[],
  currentLocalDate: string,
  updatedAt: string,
): {
  readonly tasks: readonly Task[];
  readonly moved_task_ids: readonly string[];
} {
  assertTaskSet(tasks);
  assertCivilDate(currentLocalDate, "current_local_date");
  assertUtcInstant(updatedAt, "updated_at");

  const overdue = tasks
    .filter(
      (task) =>
        task.completed_at === null &&
        task.scheduled_date < currentLocalDate,
    )
    .sort((left, right) => {
      const dateComparison = left.scheduled_date.localeCompare(
        right.scheduled_date,
      );
      return dateComparison !== 0
        ? dateComparison
        : (left.position ?? 0) - (right.position ?? 0);
    });

  if (overdue.length === 0) {
    return { tasks, moved_task_ids: [] };
  }

  const movedIds = new Set(overdue.map((task) => task.id));
  const affectedSourceDates = [
    ...new Set(overdue.map((task) => task.scheduled_date)),
  ];
  const existingDestination = activeSequence(tasks, currentLocalDate);

  let nextTasks = tasks.map((task) => {
    const movedIndex = overdue.findIndex(
      (candidate) => candidate.id === task.id,
    );
    if (movedIndex < 0) {
      return task;
    }
    return validateTask({
      ...task,
      scheduled_date: currentLocalDate,
      position: movedIndex,
      updated_at: updatedAt,
    });
  });

  for (const sourceDate of affectedSourceDates) {
    const remaining = nextTasks
      .filter(
        (task) =>
          task.completed_at === null &&
          task.scheduled_date === sourceDate &&
          !movedIds.has(task.id),
      )
      .sort((left, right) => (left.position ?? 0) - (right.position ?? 0));
    nextTasks = applyActiveSequence(
      nextTasks,
      sourceDate,
      remaining,
      updatedAt,
    );
  }

  const movedDestination = overdue.map((task) =>
    taskById(nextTasks, task.id),
  );
  nextTasks = applyActiveSequence(
    nextTasks,
    currentLocalDate,
    [...movedDestination, ...existingDestination],
    updatedAt,
  );
  assertTaskSet(nextTasks);

  return {
    tasks: nextTasks,
    moved_task_ids: overdue.map((task) => task.id),
  };
}

export function addCivilDays(
  civilDate: string,
  amount: number,
): string {
  assertCivilDate(civilDate);
  if (!Number.isInteger(amount)) {
    throw new PlanningError(
      "INVALID_OPERATION",
      "Civil-day offset must be an integer",
    );
  }

  const [yearText, monthText, dayText] = civilDate.split("-");
  const date = new Date(
    Date.UTC(
      Number(yearText),
      Number(monthText) - 1,
      Number(dayText) + amount,
    ),
  );
  return [
    date.getUTCFullYear().toString().padStart(4, "0"),
    (date.getUTCMonth() + 1).toString().padStart(2, "0"),
    date.getUTCDate().toString().padStart(2, "0"),
  ].join("-");
}

export function weekDates(selectedDate: string): readonly string[] {
  assertCivilDate(selectedDate);
  const [yearText, monthText, dayText] = selectedDate.split("-");
  const date = new Date(
    Date.UTC(Number(yearText), Number(monthText) - 1, Number(dayText)),
  );
  const dayOfWeek = date.getUTCDay();
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = addCivilDays(selectedDate, -daysSinceMonday);

  return Array.from({ length: 7 }, (_, index) =>
    addCivilDays(monday, index),
  );
}

export function outstandingForDate(
  tasks: readonly Task[],
  scheduledDate: string,
): readonly Task[] {
  assertTaskSet(tasks);
  assertCivilDate(scheduledDate);
  return activeSequence(tasks, scheduledDate);
}

export function dayAttention(
  tasks: readonly Task[],
  selectedDate: string,
): DayAttention {
  assertTaskSet(tasks);
  assertCivilDate(selectedDate);

  const carriedOver = tasks
    .filter(
      (task) =>
        task.completed_at === null &&
        task.scheduled_date < selectedDate,
    )
    .sort((left, right) => {
      const dateComparison = left.scheduled_date.localeCompare(
        right.scheduled_date,
      );
      return dateComparison !== 0
        ? dateComparison
        : (left.position ?? 0) - (right.position ?? 0);
    });

  return {
    carried_over: carriedOver,
    scheduled: activeSequence(tasks, selectedDate),
  };
}

export function completedForScheduledDate(
  tasks: readonly Task[],
  scheduledDate: string,
): readonly Task[] {
  assertTaskSet(tasks);
  assertCivilDate(scheduledDate);

  return tasks
    .filter(
      (task) =>
        task.completed_at !== null &&
        task.scheduled_date === scheduledDate,
    )
    .sort((left, right) =>
      (right.completed_at ?? "").localeCompare(left.completed_at ?? ""),
    );
}

export function instantToCivilDate(
  instant: string,
  timeZone: string,
): string {
  assertUtcInstant(instant, "completed_at");
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(instant));

  const value = (type: Intl.DateTimeFormatPartTypes): string => {
    const part = parts.find((candidate) => candidate.type === type);
    if (part === undefined) {
      throw new PlanningError(
        "INVALID_OPERATION",
        `Unable to derive ${type} in timezone ${timeZone}`,
      );
    }
    return part.value;
  };

  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function historyByCompletionDate(
  tasks: readonly Task[],
  timeZone: string,
): readonly HistoryGroup[] {
  assertTaskSet(tasks);

  const groups = new Map<string, Task[]>();
  for (const task of tasks) {
    if (task.completed_at === null) {
      continue;
    }

    const completionDate = instantToCivilDate(
      task.completed_at,
      timeZone,
    );
    const group = groups.get(completionDate) ?? [];
    group.push(task);
    groups.set(completionDate, group);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([completion_date, groupedTasks]) => ({
      completion_date,
      tasks: groupedTasks.sort((left, right) =>
        (right.completed_at ?? "").localeCompare(
          left.completed_at ?? "",
        ),
      ),
    }));
}
