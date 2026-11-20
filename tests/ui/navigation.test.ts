import { describe, expect, it } from "vitest";
import {
  initialDestinationNavigation,
  navigateDestination,
  previousDestination,
} from "../../ui/src/navigation";

describe("destination navigation", () => {
  it("returns to destinations in reverse navigation order", () => {
    const history = navigateDestination(
      navigateDestination(initialDestinationNavigation, "settings"),
      "history",
    );

    expect(history).toEqual({
      current: "history",
      history: ["planner", "settings"],
    });
    expect(previousDestination(history)).toEqual({
      current: "settings",
      history: ["planner"],
    });
    expect(previousDestination({ current: "planner", history: [] })).toBeNull();
  });

  it("does not create a history entry for the active destination", () => {
    expect(
      navigateDestination(initialDestinationNavigation, "planner"),
    ).toBe(initialDestinationNavigation);
  });
});
