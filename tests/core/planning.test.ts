import { describe, expect, it } from "vitest";
import type { Priority, Task } from "../../src/core/task";
import {
  assertActiveScheduleDate,
  assertTaskSet,
  completeTask,
  createTask,
  defaultAddDate,
  deleteTask,
  editTask,
  isActiveScheduleDate,
  moveTask,
  reopenTask,
  rollForwardOutstanding,
  startOfWeekMonday,
  weekdayOffsetFromMonday,
  weekDates,
} from "../../src/core/planning";

const NOW = "2026-11-16T01:00:00.000Z";
const LATER = "2026-11-16T02:00:00.000Z";

function task(
  suffix: number,
  date: string,
  position: number,
  priority: Priority = "NORMAL",
): Task {
  return {
    id: `018f47f0-7b5c-7d4d-8e2b-9c3aa11f${suffix
      .toString()
      .padStart(4, "0")}`,
    title: `Task ${suffix}`,
    scheduled_date: date,
    position,
    priority,
    context: null,
    reference: null,
    note: null,
    reminder_time: null,
    recurrence_series_id: null,
    recurrence_occurrence_date: null,
    completed_at: null,
    created_at: NOW,
    updated_at: NOW,
  };
}

function positions(tasks: readonly Task[], date: string): readonly string[] {
  return tasks
    .filter(
      (candidate) =>
        candidate.scheduled_date === date &&
        candidate.completed_at === null,
    )
    .sort((left, right) => (left.position ?? 0) - (right.position ?? 0))
    .map((candidate) => candidate.title);
}

function recurringTask(
  suffix: number,
  scheduledDate: string,
  position: number,
  seriesId: string,
  occurrenceDate: string,
): Task {
  return {
    ...task(suffix, scheduledDate, position),
    recurrence_series_id: seriesId,
    recurrence_occurrence_date: occurrenceDate,
  };
}

describe("daily rollover", () => {
  it("moves overdue outstanding Tasks into today before existing today Tasks", () => {
    const existing = [
      task(1, "2026-11-14", 0),
      task(2, "2026-11-15", 0),
      task(3, "2026-11-15", 1),
      task(4, "2026-11-16", 0),
    ];

    const result = rollForwardOutstanding(
      existing,
      "2026-11-16",
      LATER,
    );

    expect(result.moved_task_ids).toEqual([
      existing[0]!.id,
      existing[1]!.id,
      existing[2]!.id,
    ]);
    expect(positions(result.tasks, "2026-11-14")).toEqual([]);
    expect(positions(result.tasks, "2026-11-15")).toEqual([]);
    expect(positions(result.tasks, "2026-11-16")).toEqual([
      "Task 1",
      "Task 2",
      "Task 3",
      "Task 4",
    ]);
    expect(
      result.tasks.find((candidate) => candidate.id === existing[0]!.id)
        ?.scheduled_date,
    ).toBe("2026-11-16");
    assertTaskSet(result.tasks);
  });

  it("preserves reminder time while changing the scheduled date", () => {
    const overdue: Task = {
      ...task(1, "2026-11-15", 0),
      reminder_time: "10:00",
    };

    const result = rollForwardOutstanding(
      [overdue],
      "2026-11-16",
      LATER,
    );
    const moved = result.tasks[0]!;

    expect(moved.scheduled_date).toBe("2026-11-16");
    expect(moved.reminder_time).toBe("10:00");
    expect(moved.updated_at).toBe(LATER);
  });

  it("does not roll completed Tasks", () => {
    const completed = completeTask(
      [task(1, "2026-11-15", 0)],
      task(1, "2026-11-15", 0).id,
      LATER,
    ).task;

    const result = rollForwardOutstanding(
      [completed],
      "2026-11-16",
      "2026-11-16T03:00:00.000Z",
    );

    expect(result.moved_task_ids).toEqual([]);
    expect(result.tasks).toEqual([completed]);
  });

  it("catches up multiple missed days directly to the current date", () => {
    const existing = [task(1, "2026-10-31", 0)];

    const result = rollForwardOutstanding(
      existing,
      "2026-11-03",
      LATER,
    );

    expect(positions(result.tasks, "2026-11-01")).toEqual([]);
    expect(positions(result.tasks, "2026-11-02")).toEqual([]);
    expect(positions(result.tasks, "2026-11-03")).toEqual(["Task 1"]);
  });

  it("is a no-op when no overdue outstanding Task exists", () => {
    const existing = [task(1, "2026-11-16", 0)];

    const result = rollForwardOutstanding(
      existing,
      "2026-11-16",
      LATER,
    );

    expect(result.moved_task_ids).toEqual([]);
    expect(result.tasks).toBe(existing);
  });

  it("supersedes older overdue recurring occurrences and rolls only the latest due survivor", () => {
    const seriesId = "018f47f0-7b5c-7d4d-8e2b-9c3aa11f9001";
    const older = recurringTask(
      1,
      "2026-11-17",
      0,
      seriesId,
      "2026-11-17",
    );
    const latestDue = recurringTask(
      2,
      "2026-11-19",
      0,
      seriesId,
      "2026-11-19",
    );
    const future = recurringTask(
      3,
      "2026-11-23",
      0,
      seriesId,
      "2026-11-23",
    );

    const result = rollForwardOutstanding(
      [older, latestDue, future],
      "2026-11-20",
      "2026-11-20T01:00:00.000Z",
    );

    expect(result.superseded_task_ids).toEqual([older.id]);
    expect(result.moved_task_ids).toEqual([latestDue.id]);
    expect(
      result.tasks.find((candidate) => candidate.id === older.id),
    ).toBeUndefined();
    expect(
      result.tasks.find((candidate) => candidate.id === latestDue.id),
    ).toMatchObject({
      scheduled_date: "2026-11-20",
      recurrence_occurrence_date: "2026-11-19",
      position: 0,
    });
    expect(
      result.tasks.find((candidate) => candidate.id === future.id),
    ).toMatchObject({
      scheduled_date: "2026-11-23",
      recurrence_occurrence_date: "2026-11-23",
    });
    assertTaskSet(result.tasks);
  });

  it("preserves completed recurring History while superseding only stale outstanding siblings", () => {
    const seriesId = "018f47f0-7b5c-7d4d-8e2b-9c3aa11f9004";
    const completed = {
      ...recurringTask(
        1,
        "2026-11-17",
        0,
        seriesId,
        "2026-11-17",
      ),
      position: null,
      completed_at: "2026-11-17T18:00:00.000Z",
      updated_at: "2026-11-17T18:00:00.000Z",
    } satisfies Task;
    const staleOutstanding = recurringTask(
      2,
      "2026-11-18",
      0,
      seriesId,
      "2026-11-18",
    );
    const latestDue = recurringTask(
      3,
      "2026-11-19",
      0,
      seriesId,
      "2026-11-19",
    );

    const result = rollForwardOutstanding(
      [completed, staleOutstanding, latestDue],
      "2026-11-20",
      "2026-11-20T01:00:00.000Z",
    );

    expect(result.superseded_task_ids).toEqual([staleOutstanding.id]);
    expect(result.moved_task_ids).toEqual([latestDue.id]);
    expect(
      result.tasks.find((candidate) => candidate.id === completed.id),
    ).toStrictEqual(completed);
    expect(
      result.tasks.find((candidate) => candidate.id === latestDue.id),
    ).toMatchObject({
      scheduled_date: "2026-11-20",
      recurrence_occurrence_date: "2026-11-19",
    });
    assertTaskSet(result.tasks);
  });

  it("preserves an explicitly future-rescheduled older recurring occurrence", () => {
    const seriesId = "018f47f0-7b5c-7d4d-8e2b-9c3aa11f9002";
    const explicitlyFuture = recurringTask(
      1,
      "2026-11-25",
      0,
      seriesId,
      "2026-11-17",
    );
    const latestDue = recurringTask(
      2,
      "2026-11-19",
      0,
      seriesId,
      "2026-11-19",
    );

    const result = rollForwardOutstanding(
      [explicitlyFuture, latestDue],
      "2026-11-20",
      "2026-11-20T01:00:00.000Z",
    );

    expect(result.superseded_task_ids).toEqual([]);
    expect(result.moved_task_ids).toEqual([latestDue.id]);
    expect(
      result.tasks.find((candidate) => candidate.id === explicitlyFuture.id),
    ).toMatchObject({ scheduled_date: "2026-11-25" });
  });

  it("supersedes stale recurring work without requiring another move", () => {
    const seriesId = "018f47f0-7b5c-7d4d-8e2b-9c3aa11f9003";
    const older = recurringTask(
      1,
      "2026-11-19",
      0,
      seriesId,
      "2026-11-19",
    );
    const latestDue = recurringTask(
      2,
      "2026-11-20",
      0,
      seriesId,
      "2026-11-20",
    );

    const result = rollForwardOutstanding(
      [older, latestDue],
      "2026-11-20",
      "2026-11-20T01:00:00.000Z",
    );

    expect(result.moved_task_ids).toEqual([]);
    expect(result.superseded_task_ids).toEqual([older.id]);
    expect(result.tasks).toEqual([latestDue]);
  });
});

describe("active scheduling dates", () => {
  it("accepts today and future dates and rejects past dates", () => {
    expect(isActiveScheduleDate("2026-11-20", "2026-11-20")).toBe(true);
    expect(isActiveScheduleDate("2026-11-20", "2026-11-21")).toBe(true);
    expect(isActiveScheduleDate("2026-11-20", "2026-11-19")).toBe(false);
    expect(() =>
      assertActiveScheduleDate("2026-11-20", "2026-11-20"),
    ).not.toThrow();
    expect(() =>
      assertActiveScheduleDate("2026-11-20", "2026-11-21"),
    ).not.toThrow();
    expect(() =>
      assertActiveScheduleDate("2026-11-20", "2026-11-19"),
    ).toThrow(
      "Outstanding Tasks can only be scheduled for today or a future date",
    );
  });
});

describe("planning mutations", () => {
  it("uses priority only to place a new Task in a manually mixed list", () => {
    const existing = [
      task(1, "2026-11-16", 0, "LOW"),
      task(2, "2026-11-16", 1, "HIGH"),
      task(3, "2026-11-16", 2, "LOW"),
    ];
    const created = task(4, "2026-11-16", 0, "NORMAL");

    const result = createTask(existing, created);

    expect(positions(result.tasks, "2026-11-16")).toEqual([
      "Task 1",
      "Task 2",
      "Task 4",
      "Task 3",
    ]);
    assertTaskSet(result.tasks);
  });

  it("does not reorder an established list when priority changes", () => {
    const existing = [
      task(1, "2026-11-16", 0, "LOW"),
      task(2, "2026-11-16", 1, "HIGH"),
    ];

    const result = editTask(
      existing,
      existing[0]!.id,
      { priority: "HIGH" },
      LATER,
    );

    expect(positions(result.tasks, "2026-11-16")).toEqual([
      "Task 1",
      "Task 2",
    ]);
  });

  it("uses after-removal destination indexing for same-date movement", () => {
    const existing = [
      task(1, "2026-11-16", 0),
      task(2, "2026-11-16", 1),
      task(3, "2026-11-16", 2),
    ];

    const result = moveTask(
      existing,
      existing[0]!.id,
      "2026-11-16",
      2,
      LATER,
    );

    expect(positions(result.tasks, "2026-11-16")).toEqual([
      "Task 2",
      "Task 3",
      "Task 1",
    ]);
  });

  it("moves to an exact cross-date index including an empty date", () => {
    const existing = [
      task(1, "2026-11-16", 0),
      task(2, "2026-11-16", 1),
    ];

    const result = moveTask(
      existing,
      existing[0]!.id,
      "2026-11-17",
      0,
      LATER,
    );

    expect(positions(result.tasks, "2026-11-16")).toEqual(["Task 2"]);
    expect(positions(result.tasks, "2026-11-17")).toEqual(["Task 1"]);
    expect(result.task.scheduled_date).toBe("2026-11-17");
  });

  it("uses priority-assisted placement for an editor date change", () => {
    const moving = task(1, "2026-11-16", 0, "NORMAL");
    const destination = [
      task(2, "2026-11-17", 0, "HIGH"),
      task(3, "2026-11-17", 1, "LOW"),
    ];

    const result = editTask(
      [moving, ...destination],
      moving.id,
      { scheduled_date: "2026-11-17" },
      LATER,
    );

    expect(positions(result.tasks, "2026-11-17")).toEqual([
      "Task 2",
      "Task 1",
      "Task 3",
    ]);
  });

  it("completes, compacts, and reopens at the end without changing identity", () => {
    const existing = [
      task(1, "2026-11-16", 0),
      task(2, "2026-11-16", 1),
    ];

    const completed = completeTask(
      existing,
      existing[0]!.id,
      LATER,
    );
    expect(completed.task.position).toBeNull();
    expect(completed.task.completed_at).toBe(LATER);
    expect(positions(completed.tasks, "2026-11-16")).toEqual([
      "Task 2",
    ]);

    const reopened = reopenTask(
      completed.tasks,
      completed.task.id,
      "2026-11-16T03:00:00.000Z",
    );
    expect(reopened.task.id).toBe(existing[0]!.id);
    expect(positions(reopened.tasks, "2026-11-16")).toEqual([
      "Task 2",
      "Task 1",
    ]);
  });

  it("hard-deletes outstanding Tasks and compacts positions", () => {
    const existing = [
      task(1, "2026-11-16", 0),
      task(2, "2026-11-16", 1),
      task(3, "2026-11-16", 2),
    ];

    const result = deleteTask(
      existing,
      existing[1]!.id,
      LATER,
    );

    expect(result.tasks.some((candidate) => candidate.id === existing[1]!.id))
      .toBe(false);
    expect(positions(result.tasks, "2026-11-16")).toEqual([
      "Task 1",
      "Task 3",
    ]);
    assertTaskSet(result.tasks);
  });

  it("allows a completed Task date edit without re-entering active order", () => {
    const completed = completeTask([task(1, "2026-11-16", 0)], task(1, "2026-11-16", 0).id, LATER).task;
    const result = editTask(
      [completed],
      completed.id,
      { scheduled_date: "2026-12-31" },
      "2026-11-16T03:00:00.000Z",
    );

    expect(result.task.scheduled_date).toBe("2026-12-31");
    expect(result.task.completed_at).toBe(LATER);
    expect(result.task.position).toBeNull();
  });
});


describe("civil week helpers", () => {
  it("uses one Monday for every date in the same Monday-Sunday week", () => {
    for (const date of [
      "2026-11-16",
      "2026-11-17",
      "2026-11-18",
      "2026-11-19",
      "2026-11-20",
      "2026-11-21",
      "2026-11-22",
    ]) {
      expect(startOfWeekMonday(date)).toBe("2026-11-16");
    }
  });

  it("crosses month and year boundaries without changing civil-date semantics", () => {
    expect(startOfWeekMonday("2026-12-01")).toBe("2026-11-30");
    expect(startOfWeekMonday("2027-01-03")).toBe("2026-12-28");
    expect(weekDates("2027-01-03")).toEqual([
      "2026-12-28",
      "2026-12-29",
      "2026-12-30",
      "2026-12-31",
      "2027-01-01",
      "2027-01-02",
      "2027-01-03",
    ]);
  });

  it("derives the current weekday inside any displayed week", () => {
    expect(weekdayOffsetFromMonday("2026-11-16")).toBe(0);
    expect(weekdayOffsetFromMonday("2026-11-22")).toBe(6);
    expect(defaultAddDate("2026-11-16", "2026-11-19")).toBe("2026-11-19");
    expect(defaultAddDate("2026-11-23", "2026-11-19")).toBe("2026-11-26");
    expect(defaultAddDate("2026-12-28", "2027-01-03")).toBe("2027-01-03");
  });

  it("handles leap-day adjacency", () => {
    expect(startOfWeekMonday("2028-02-29")).toBe("2028-02-28");
    expect(weekDates("2028-02-29")).toEqual([
      "2028-02-28",
      "2028-02-29",
      "2028-03-01",
      "2028-03-02",
      "2028-03-03",
      "2028-03-04",
      "2028-03-05",
    ]);
  });
});
