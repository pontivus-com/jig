import { describe, expect, it } from "vitest";
import type { RecurrenceSeries } from "../../src/core/recurrence";
import type { Task } from "../../src/core/task";
import {
  serializeSnapshot,
  SnapshotValidationError,
  validateSnapshot,
} from "../../src/shell/git";

const DATASET_ID = "018f47f0-7b5c-7d4d-8e2b-9c3aa11f0001";

function task(
  id: string,
  title: string,
  position: number,
): Task {
  return {
    id,
    title,
    scheduled_date: "2026-11-16",
    position,
    priority: position === 0 ? "HIGH" : "LOW",
    context: position === 0 ? "Legal" : null,
    reference: null,
    note: position === 1 ? "Later" : null,
    reminder_time: null,
    recurrence_series_id: null,
    recurrence_occurrence_date: null,
    completed_at: null,
    created_at: "2026-11-16T01:00:00.000Z",
    updated_at: "2026-11-16T01:00:00.000Z",
  };
}

const FIRST = task(
  "018f47f0-7b5c-7d4d-8e2b-9c3aa11f0101",
  "First",
  0,
);
const SECOND = task(
  "018f47f0-7b5c-7d4d-8e2b-9c3aa11f0102",
  "Second",
  1,
);

describe("portable complete snapshot", () => {
  it("is byte-stable and round-trips canonical Tasks", () => {
    const first = serializeSnapshot([SECOND, FIRST], DATASET_ID);
    const second = serializeSnapshot([SECOND, FIRST], DATASET_ID);

    expect([...first.files]).toStrictEqual([...second.files]);

    const validated = validateSnapshot(first.files, DATASET_ID);
    expect(
      [...validated.tasks].sort((a, b) => a.id.localeCompare(b.id)),
    ).toStrictEqual([FIRST, SECOND]);
  });

  it("rejects dataset mismatch", () => {
    const snapshot = serializeSnapshot([FIRST], DATASET_ID);
    expect(() =>
      validateSnapshot(
        snapshot.files,
        "018f47f0-7b5c-7d4d-8e2b-9c3aa11f9999",
      ),
    ).toThrow(SnapshotValidationError);
  });

  it("rejects path/embedded-ID mismatch", () => {
    const snapshot = serializeSnapshot([FIRST], DATASET_ID);
    const files = new Map(snapshot.files);
    const content = files.get(`tasks/${FIRST.id}.json`);
    expect(content).toBeDefined();
    files.delete(`tasks/${FIRST.id}.json`);
    files.set(
      "tasks/018f47f0-7b5c-7d4d-8e2b-9c3aa11f9999.json",
      content as string,
    );

    expect(() => validateSnapshot(files, DATASET_ID)).toThrow(
      /id does not match its filename/,
    );
  });

  it("accepts portable v1 as non-recurring input and emits v2 on next export", () => {
    const v1Task = {
      completed_at: null,
      context: null,
      created_at: "2026-11-16T01:00:00.000Z",
      id: FIRST.id,
      note: null,
      position: 0,
      priority: "HIGH",
      reference: null,
      reminder_time: null,
      scheduled_date: "2026-11-16",
      title: "First",
      updated_at: "2026-11-16T01:00:00.000Z",
    };
    const files = new Map<string, string>([
      [
        "format.json",
        `${JSON.stringify({
          dataset_id: DATASET_ID,
          version: 1,
        }, null, 2)}\n`,
      ],
      [
        `tasks/${FIRST.id}.json`,
        `${JSON.stringify(v1Task, null, 2)}\n`,
      ],
    ]);

    const adopted = validateSnapshot(files, DATASET_ID);
    expect(adopted.recurrences).toStrictEqual([]);
    expect(adopted.tasks[0]).toMatchObject({
      recurrence_series_id: null,
      recurrence_occurrence_date: null,
    });

    const upgraded = serializeSnapshot(
      adopted.tasks,
      DATASET_ID,
      adopted.recurrences,
    );
    expect(JSON.parse(upgraded.files.get("format.json") ?? "{}"))
      .toMatchObject({ version: 2 });
    expect(
      JSON.parse(
        upgraded.files.get(`tasks/${FIRST.id}.json`) ?? "{}",
      ),
    ).toMatchObject({
      recurrence_series_id: null,
      recurrence_occurrence_date: null,
    });
  });

  it("round-trips recurrence series and Task membership in portable v2", () => {
    const series: RecurrenceSeries = {
      id: "018f47f0-7b5c-7d4d-8e2b-9c3aa11f0200",
      effective_from: "2026-11-16",
      end_date: "2026-11-30",
      pattern: {
        kind: "weekly",
        interval_weeks: 1,
        weekdays: ["MON"],
      },
      created_at: "2026-11-16T01:00:00.000Z",
      updated_at: "2026-11-16T01:00:00.000Z",
    };
    const recurring: Task = {
      ...FIRST,
      recurrence_series_id: series.id,
      recurrence_occurrence_date: "2026-11-16",
    };

    const snapshot = serializeSnapshot(
      [recurring],
      DATASET_ID,
      [series],
    );
    expect(
      snapshot.files.has(`recurrences/${series.id}.json`),
    ).toBe(true);

    const validated = validateSnapshot(snapshot.files, DATASET_ID);
    expect(validated.tasks).toStrictEqual([recurring]);
    expect(validated.recurrences).toStrictEqual([series]);
  });

  it("rejects malformed active positions", () => {
    const snapshot = serializeSnapshot([FIRST, SECOND], DATASET_ID);
    const files = new Map(snapshot.files);
    const path = `tasks/${SECOND.id}.json`;
    const parsed = JSON.parse(files.get(path) as string) as Record<string, unknown>;
    parsed.position = 4;
    files.set(path, `${JSON.stringify(parsed, null, 2)}\n`);

    expect(() => validateSnapshot(files, DATASET_ID)).toThrow(
      /must be contiguous/,
    );
  });
});
