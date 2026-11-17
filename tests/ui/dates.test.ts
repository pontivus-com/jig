import { describe, expect, it } from "vitest";
import { formatPlannerWeekRange } from "../../ui/src/dates";

describe("Planner week range formatting", () => {
  it("formats a week contained in one month", () => {
    expect(formatPlannerWeekRange("2026-11-16")).toBe("16–22 Nov 2026");
  });

  it("formats a week crossing months", () => {
    expect(formatPlannerWeekRange("2026-11-30")).toBe("30 Nov–6 Dec 2026");
  });

  it("formats a week crossing years", () => {
    expect(formatPlannerWeekRange("2026-12-28")).toBe(
      "28 Dec 2026–3 Jan 2027",
    );
  });
});
