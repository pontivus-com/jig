import { describe, expect, it } from "vitest";
import type { Task } from "../../src/core/task";
import { isReminderDue } from "../../src/core/reminder";

const BASE: Task = {
  id: "018f47f0-7b5c-7d4d-8e2b-9c3aa11f0001",
  title: "Reminder contract",
  scheduled_date: "2026-11-18",
  position: 0,
  priority: "NORMAL",
  context: null,
  reference: null,
  note: null,
  reminder_time: "09:30",
  recurrence_series_id: null,
  recurrence_occurrence_date: null,
  completed_at: null,
  created_at: "2026-11-18T01:00:00.000Z",
  updated_at: "2026-11-18T01:00:00.000Z",
};

describe("reminder due semantics", () => {
  it("is false before and true at/after the reminder minute", () => {
    expect(isReminderDue(BASE, new Date(2026, 10, 18, 9, 29))).toBe(false);
    expect(isReminderDue(BASE, new Date(2026, 10, 18, 9, 30))).toBe(true);
    expect(isReminderDue(BASE, new Date(2026, 10, 18, 18, 0))).toBe(true);
  });

  it("requires an incomplete Task on the current local civil date", () => {
    expect(isReminderDue(
      { ...BASE, reminder_time: null },
      new Date(2026, 10, 18, 10, 0),
    )).toBe(false);
    expect(isReminderDue(
      { ...BASE, completed_at: "2026-11-18T03:00:00.000Z", position: null },
      new Date(2026, 10, 18, 10, 0),
    )).toBe(false);
    expect(isReminderDue(BASE, new Date(2026, 10, 19, 10, 0))).toBe(false);
  });

  it("immediately recognizes a rolled-forward Task whose reminder time has passed", () => {
    const rolled: Task = {
      ...BASE,
      scheduled_date: "2026-11-19",
      updated_at: "2026-11-19T00:00:01.000Z",
    };
    expect(isReminderDue(rolled, new Date(2026, 10, 19, 10, 0))).toBe(true);
  });
});
