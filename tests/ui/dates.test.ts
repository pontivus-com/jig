import { describe, expect, it } from "vitest";
import {
  formatPlannerDateHeader,
  formatPlannerHorizonRange,
} from "../../ui/src/dates";

describe("Planner horizon range formatting", () => {
  it("formats a week contained in one month", () => {
    expect(formatPlannerHorizonRange("2026-11-16")).toBe("16–22 Nov 2026");
  });

  it("formats a week crossing months", () => {
    expect(formatPlannerHorizonRange("2026-11-30")).toBe("30 Nov–6 Dec 2026");
  });

  it("formats a week crossing years", () => {
    expect(formatPlannerHorizonRange("2026-12-28")).toBe(
      "28 Dec 2026–3 Jan 2027",
    );
  });
});


describe("Planner date header formatting", () => {
  it("uses full English weekday names", () => {
    expect(formatPlannerDateHeader("2026-11-16")).toBe("Monday 16");
    expect(formatPlannerDateHeader("2026-11-17")).toBe("Tuesday 17");
    expect(formatPlannerDateHeader("2026-11-22")).toBe("Sunday 22");
  });
});
