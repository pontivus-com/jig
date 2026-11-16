import { describe, expect, it } from "vitest";
import type { Priority, Task } from "../../src/core/task";
import {
  assertTaskSet,
  completeTask,
  createTask,
  deleteTask,
  editTask,
  moveTask,
  reopenTask,
  rollForwardOutstanding,
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
  it("rolls overdue outstanding Tasks into today before existing today Tasks", () => {
    const oldest = { ...task(1, "2026-11-14", 0), reminder_time: "10:00" };
    const yesterday = task(2, "2026-11-15", 0);
    const today = task(3, "2026-11-16", 0);

    const result = rollForwardOutstanding(
      [oldest, yesterday, today],
      "2026-11-16",
      LATER,
    );

    expect(result.moved_task_ids).toEqual([oldest.id, yesterday.id]);
    expect(positions(result.tasks, "2026-11-14")).toEqual([]);
    expect(positions(result.tasks, "2026-11-15")).toEqual([]);
    expect(positions(result.tasks, "2026-11-16")).toEqual([
      "Task 1",
      "Task 2",
      "Task 3",
    ]);
    expect(
      result.tasks.find((candidate) => candidate.id === oldest.id),
    ).toMatchObject({
      scheduled_date: "2026-11-16",
      position: 0,
      reminder_time: "10:00",
      updated_at: LATER,
    });
    assertTaskSet(result.tasks);
  });

  it("rollover catches up multiple missed days directly and leaves completed Tasks unchanged", () => {
    const outstanding = task(1, "2026-12-30", 0);
    const completed = completeTask(
      [task(2, "2026-12-31", 0)],
      task(2, "2026-12-31", 0).id,
      "2026-12-31T12:00:00.000Z",
    ).task;

    const result = rollForwardOutstanding(
      [outstanding, completed],
      "2027-01-02",
      "2027-01-02T00:00:00.000Z",
    );

    expect(result.moved_task_ids).toEqual([outstanding.id]);
    expect(
      result.tasks.find((candidate) => candidate.id === outstanding.id),
    ).toMatchObject({
      scheduled_date: "2027-01-02",
      position: 0,
    });
    expect(
      result.tasks.find((candidate) => candidate.id === completed.id),
    ).toStrictEqual(completed);
  });

  it("rollover is a no-op when nothing is overdue", () => {
    const existing = [task(1, "2026-11-16", 0)];
    const result = rollForwardOutstanding(
      existing,
      "2026-11-16",
      LATER,
    );

    expect(result.tasks).toBe(existing);
    expect(result.moved_task_ids).toEqual([]);
  });

});
