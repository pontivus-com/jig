import { describe, expect, it } from "vitest";
import type { Task } from "../../src/core/task";
import {
  historyByCompletionDate,
  outstandingForDate,
  rollForwardOutstanding,
  weekDates,
} from "../../src/core/planning";

function task(
  id: string,
  scheduledDate: string,
  position: number | null,
  completedAt: string | null = null,
): Task {
  return {
    id,
    title: id,
    scheduled_date: scheduledDate,
    position,
    priority: "NORMAL",
    context: null,
    reference: null,
    note: null,
    reminder_time: null,
    completed_at: completedAt,
    created_at: "2026-11-13T00:00:00.000Z",
    updated_at: completedAt ?? "2026-11-13T00:00:00.000Z",
  };
}

describe("derived calendar views", () => {
  it("derives a Monday-start week across a year boundary", () => {
    expect(weekDates("2027-01-01")).toEqual([
      "2026-12-28",
      "2026-12-29",
      "2026-12-30",
      "2026-12-31",
      "2027-01-01",
      "2027-01-02",
      "2027-01-03",
    ]);
  });

  it("rolls earlier unfinished work into the canonical current-day view", () => {
    const thursday = task(
      "018f47f0-7b5c-7d4d-8e2b-9c3aa11f0001",
      "2026-11-12",
      0,
    );
    const friday = task(
      "018f47f0-7b5c-7d4d-8e2b-9c3aa11f0002",
      "2026-11-13",
      0,
    );

    const rolled = rollForwardOutstanding(
      [thursday, friday],
      "2026-11-14",
      "2026-11-14T00:00:00.000Z",
    );

    expect(
      outstandingForDate(rolled.tasks, "2026-11-14").map(
        (candidate) => candidate.id,
      ),
    ).toEqual([thursday.id, friday.id]);
    expect(outstandingForDate(rolled.tasks, "2026-11-12")).toEqual([]);
    expect(outstandingForDate(rolled.tasks, "2026-11-13")).toEqual([]);
  });

  it("groups History by actual completion date in the supplied viewing timezone", () => {
    const first = task(
      "018f47f0-7b5c-7d4d-8e2b-9c3aa11f0001",
      "2026-11-12",
      null,
      "2026-11-16T18:30:00.000Z",
    );
    const second = task(
      "018f47f0-7b5c-7d4d-8e2b-9c3aa11f0002",
      "2026-11-13",
      null,
      "2026-11-16T10:00:00.000Z",
    );

    const history = historyByCompletionDate(
      [first, second],
      "Asia/Bangkok",
    );

    expect(history.map((group) => group.completion_date)).toEqual([
      "2026-11-17",
      "2026-11-16",
    ]);
  });
});
