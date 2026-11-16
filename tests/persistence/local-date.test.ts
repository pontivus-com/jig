import { describe, expect, it } from "bun:test";
import {
  localCivilDate,
  millisecondsUntilNextLocalDay,
} from "../../src/shell/local-date";

describe("local civil-day helpers", () => {
  it("formats the host local civil date without UTC conversion", () => {
    expect(
      localCivilDate(new Date(2026, 0, 2, 23, 30, 0, 0)),
    ).toBe("2026-01-02");
  });

  it("schedules just beyond the next local midnight", () => {
    expect(
      millisecondsUntilNextLocalDay(
        new Date(2026, 0, 2, 23, 59, 59, 900),
      ),
    ).toBe(150);
  });
});
