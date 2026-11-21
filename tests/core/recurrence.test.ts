import { describe, expect, it } from "vitest";
import {
  enumerateRecurrenceDates,
  recurrenceSpecMatchesSeries,
  type RecurrenceSeries,
  type RecurrenceSpec,
} from "../../src/core/recurrence";
import {
  changeTaskRecurrence,
  enableTaskRecurrence,
  stopTaskRecurrence,
} from "../../src/core/recurrence-planning";
import {
  completeTask,
  editTask,
  moveTask,
} from "../../src/core/planning";
import type { Task } from "../../src/core/task";

const NOW = "2026-11-16T01:00:00.000Z";
const LATER = "2026-11-16T02:00:00.000Z";

function uuid(suffix: number): string {
  return `018f47f0-7b5c-7d4d-8e2b-9c3aa11f${suffix
    .toString()
    .padStart(4, "0")}`;
}

function task(
  suffix: number,
  date = "2026-11-16",
  position = 0,
): Task {
  return {
    id: uuid(suffix),
    title: `Task ${suffix}`,
    scheduled_date: date,
    position,
    priority: "NORMAL",
    context: null,
    reference: null,
    note: null,
    reminder_time: "09:30",
    recurrence_series_id: null,
    recurrence_occurrence_date: null,
    completed_at: null,
    created_at: NOW,
    updated_at: NOW,
  };
}

function weekly(
  weekdays: readonly ("MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN")[],
  intervalWeeks = 1,
  endDate = "2026-12-31",
): RecurrenceSpec {
  return {
    pattern: {
      kind: "weekly",
      interval_weeks: intervalWeeks,
      weekdays,
    },
    end_date: endDate,
  };
}

describe("bounded recurrence enumeration", () => {
  it("enumerates weekly slots after the seed with inclusive end-date semantics", () => {
    expect(
      enumerateRecurrenceDates(
        "2026-11-16",
        weekly(["MON", "WED"], 1, "2026-11-25"),
      ),
    ).toEqual([
      "2026-11-18",
      "2026-11-23",
      "2026-11-25",
    ]);
  });

  it("supports all-seven weekdays and every-four-weeks cadence", () => {
    expect(
      enumerateRecurrenceDates(
        "2026-11-16",
        weekly(
          ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
          4,
          "2026-12-20",
        ),
      ),
    ).toEqual([
      "2026-11-17",
      "2026-11-18",
      "2026-11-19",
      "2026-11-20",
      "2026-11-21",
      "2026-11-22",
      "2026-12-14",
      "2026-12-15",
      "2026-12-16",
      "2026-12-17",
      "2026-12-18",
      "2026-12-19",
      "2026-12-20",
    ]);
  });

  it("skips months that do not contain the configured day", () => {
    expect(
      enumerateRecurrenceDates("2027-01-31", {
        pattern: {
          kind: "monthly",
          day_of_month: 31,
        },
        end_date: "2027-05-31",
      }),
    ).toEqual([
      "2027-03-31",
      "2027-05-31",
    ]);
  });

  it("handles leap-year day 29 without clamping", () => {
    expect(
      enumerateRecurrenceDates("2027-02-28", {
        pattern: {
          kind: "monthly",
          day_of_month: 29,
        },
        end_date: "2028-03-01",
      }),
    ).toEqual([
      "2027-03-29",
      "2027-04-29",
      "2027-05-29",
      "2027-06-29",
      "2027-07-29",
      "2027-08-29",
      "2027-09-29",
      "2027-10-29",
      "2027-11-29",
      "2027-12-29",
      "2028-01-29",
      "2028-02-29",
    ]);
  });
});

describe("recurrence semantic equivalence", () => {
  const series: RecurrenceSeries = {
    id: uuid(100),
    effective_from: "2026-11-16",
    end_date: "2026-12-31",
    pattern: {
      kind: "weekly",
      interval_weeks: 1,
      weekdays: ["MON", "WED"],
    },
    created_at: NOW,
    updated_at: NOW,
  };

  it("normalizes valid recurrence specs before comparing them with a series", () => {
    expect(
      recurrenceSpecMatchesSeries(
        weekly(["WED", "MON"], 1, "2026-12-31"),
        series,
      ),
    ).toBe(true);
  });

  it("rejects recurrence specs with different bounds or patterns", () => {
    expect(
      recurrenceSpecMatchesSeries(
        weekly(["MON", "WED"], 2, "2026-12-31"),
        series,
      ),
    ).toBe(false);
    expect(
      recurrenceSpecMatchesSeries(
        weekly(["MON", "WED"], 1, "2026-12-30"),
        series,
      ),
    ).toBe(false);
  });
});

describe("recurrence membership planning", () => {
  it("enables recurrence by retaining the seed and materializing ordinary Tasks", () => {
    let nextTaskId = 10;
    const result = enableTaskRecurrence(
      [task(1)],
      [],
      uuid(1),
      weekly(["MON"], 1, "2026-11-30"),
      () => uuid(100),
      () => uuid(nextTaskId++),
      LATER,
    );

    expect(result.recurrences).toHaveLength(1);
    expect(result.recurrences[0]).toMatchObject({
      id: uuid(100),
      effective_from: "2026-11-16",
      end_date: "2026-11-30",
      pattern: {
        kind: "weekly",
        interval_weeks: 1,
        weekdays: ["MON"],
      },
    });
    expect(
      result.tasks.map((candidate) => ({
        date: candidate.scheduled_date,
        slot: candidate.recurrence_occurrence_date,
        series: candidate.recurrence_series_id,
        reminder: candidate.reminder_time,
      })),
    ).toEqual([
      {
        date: "2026-11-16",
        slot: "2026-11-16",
        series: uuid(100),
        reminder: "09:30",
      },
      {
        date: "2026-11-23",
        slot: "2026-11-23",
        series: uuid(100),
        reminder: "09:30",
      },
      {
        date: "2026-11-30",
        slot: "2026-11-30",
        series: uuid(100),
        reminder: "09:30",
      },
    ]);
  });

  it("keeps ordinary edits and movement occurrence-local", () => {
    let nextTaskId = 10;
    const enabled = enableTaskRecurrence(
      [task(1)],
      [],
      uuid(1),
      weekly(["MON"], 1, "2026-11-30"),
      () => uuid(100),
      () => uuid(nextTaskId++),
      LATER,
    );
    const middle = enabled.tasks.find(
      (candidate) =>
        candidate.recurrence_occurrence_date === "2026-11-23",
    );
    if (middle === undefined) {
      throw new Error("Expected middle occurrence");
    }

    const edited = editTask(
      enabled.tasks,
      middle.id,
      {
        title: "Independent title",
        reminder_time: "15:45",
      },
      "2026-11-16T03:00:00.000Z",
    );
    const moved = moveTask(
      edited.tasks,
      middle.id,
      "2026-11-24",
      0,
      "2026-11-16T04:00:00.000Z",
    );

    expect(moved.task.title).toBe("Independent title");
    expect(moved.task.reminder_time).toBe("15:45");
    expect(moved.task.scheduled_date).toBe("2026-11-24");
    expect(moved.task.recurrence_occurrence_date).toBe("2026-11-23");
    expect(
      moved.tasks.find(
        (candidate) =>
          candidate.recurrence_occurrence_date === "2026-11-30",
      )?.title,
    ).toBe("Task 1");
  });

  it("reconciles from the invoking immutable slot without rewriting retained siblings", () => {
    let nextTaskId = 10;
    const enabled = enableTaskRecurrence(
      [task(1)],
      [],
      uuid(1),
      weekly(["MON"], 1, "2026-12-07"),
      () => uuid(100),
      () => uuid(nextTaskId++),
      LATER,
    );
    const invoking = enabled.tasks.find(
      (candidate) =>
        candidate.recurrence_occurrence_date === "2026-11-23",
    );
    const retained = enabled.tasks.find(
      (candidate) =>
        candidate.recurrence_occurrence_date === "2026-11-30",
    );
    if (invoking === undefined || retained === undefined) {
      throw new Error("Expected recurring occurrences");
    }

    const editedInvoking = editTask(
      enabled.tasks,
      invoking.id,
      {
        title: "Anchor content",
        note: "Copied only to new slots",
      },
      "2026-11-16T03:00:00.000Z",
    );
    const retainedEdited = editTask(
      editedInvoking.tasks,
      retained.id,
      {
        title: "Retained independent content",
      },
      "2026-11-16T04:00:00.000Z",
    );

    const reconciled = changeTaskRecurrence(
      retainedEdited.tasks,
      enabled.recurrences,
      invoking.id,
      weekly(["MON", "WED"], 1, "2026-12-02"),
      () => uuid(nextTaskId++),
      "2026-11-16T05:00:00.000Z",
    );

    expect(reconciled.recurrences[0]?.effective_from).toBe(
      "2026-11-23",
    );
    expect(
      reconciled.tasks.find((candidate) => candidate.id === retained.id),
    ).toMatchObject({
      id: retained.id,
      title: "Retained independent content",
      recurrence_occurrence_date: "2026-11-30",
    });
    expect(
      reconciled.tasks.find(
        (candidate) =>
          candidate.recurrence_occurrence_date === "2026-11-25",
      ),
    ).toMatchObject({
      title: "Anchor content",
      note: "Copied only to new slots",
      scheduled_date: "2026-11-25",
    });
    expect(
      reconciled.tasks.find(
        (candidate) =>
          candidate.recurrence_occurrence_date === "2026-12-02",
      ),
    ).toMatchObject({
      title: "Anchor content",
      note: "Copied only to new slots",
    });
    expect(
      reconciled.tasks.some(
        (candidate) =>
          candidate.recurrence_occurrence_date === "2026-12-07",
      ),
    ).toBe(false);
  });

  it("preserves completed History while Stop repeating removes every other outstanding occurrence", () => {
    let nextTaskId = 10;
    const enabled = enableTaskRecurrence(
      [task(1)],
      [],
      uuid(1),
      weekly(["MON"], 1, "2026-12-07"),
      () => uuid(100),
      () => uuid(nextTaskId++),
      LATER,
    );
    const completedCandidate = enabled.tasks.find(
      (candidate) =>
        candidate.recurrence_occurrence_date === "2026-11-23",
    );
    const invoking = enabled.tasks.find(
      (candidate) =>
        candidate.recurrence_occurrence_date === "2026-11-30",
    );
    if (completedCandidate === undefined || invoking === undefined) {
      throw new Error("Expected recurring occurrences");
    }

    const completed = completeTask(
      enabled.tasks,
      completedCandidate.id,
      "2026-11-23T18:00:00.000Z",
    );
    const stopped = stopTaskRecurrence(
      completed.tasks,
      enabled.recurrences,
      invoking.id,
      "2026-11-30T09:00:00.000Z",
    );

    expect(stopped.task).toMatchObject({
      id: invoking.id,
      recurrence_series_id: null,
      recurrence_occurrence_date: null,
    });
    expect(
      stopped.tasks.find(
        (candidate) => candidate.id === completedCandidate.id,
      ),
    ).toMatchObject({
      completed_at: "2026-11-23T18:00:00.000Z",
      recurrence_series_id: uuid(100),
    });
    expect(
      stopped.tasks.filter(
        (candidate) =>
          candidate.id !== invoking.id &&
          candidate.completed_at === null &&
          candidate.recurrence_series_id === uuid(100),
      ),
    ).toEqual([]);
    expect(stopped.recurrences).toHaveLength(1);
  });
});
