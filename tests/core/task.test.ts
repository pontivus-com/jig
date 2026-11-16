import { describe, expect, it } from "vitest";
import {
  TaskValidationError,
  type Task,
  validateTask,
} from "../../src/core/task";

const BASE: Task = {
  id: "018f47f0-7b5c-7d4d-8e2b-9c3aa11f0001",
  title: "Review TTA remediation",
  scheduled_date: "2026-11-16",
  position: 0,
  priority: "NORMAL",
  context: null,
  reference: null,
  note: null,
  reminder_time: null,
  completed_at: null,
  created_at: "2026-11-16T01:00:00.000Z",
  updated_at: "2026-11-16T01:00:00.000Z",
};

describe("canonical Task validation", () => {
  it("accepts the exact canonical outstanding shape", () => {
    expect(validateTask(BASE)).toBe(BASE);
  });

  it.each([
    ["invalid UUID", { id: "task-1" }],
    ["blank title", { title: "   " }],
    ["untrimmed title", { title: " Work " }],
    ["invalid date syntax", { scheduled_date: "16-11-2026" }],
    ["impossible date", { scheduled_date: "2026-02-30" }],
    ["negative position", { position: -1 }],
    ["invalid reminder", { reminder_time: "24:10" }],
    ["blank context", { context: " " }],
    ["non-UTC timestamp", { updated_at: "2026-11-16T08:00:00+07:00" }],
  ])("rejects %s", (_label, changes) => {
    expect(() =>
      validateTask({ ...BASE, ...changes } as Task),
    ).toThrow(TaskValidationError);
  });

  it("requires completed Tasks to have no active position", () => {
    expect(() =>
      validateTask({
        ...BASE,
        completed_at: "2026-11-16T02:00:00.000Z",
        position: 0,
      }),
    ).toThrow(/position must be null/);
  });

  it("requires outstanding Tasks to have an active position", () => {
    expect(() =>
      validateTask({
        ...BASE,
        position: null,
      }),
    ).toThrow(/nonnegative integer/);
  });

  it("rejects timestamps before creation", () => {
    expect(() =>
      validateTask({
        ...BASE,
        updated_at: "2026-11-15T23:59:59.000Z",
      }),
    ).toThrow(/must not precede/);
  });
});
