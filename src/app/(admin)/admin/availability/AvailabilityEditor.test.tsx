import { describe, expect, it } from "vitest";
import { weekStateToRules, rulesToWeekState } from "./availability-helpers";

/**
 * The editor renders in the browser and calls /api/availability + /api/leave;
 * its logic is the pure availability-helpers asserted here and in
 * availability-helpers.test.ts.
 */
describe("AvailabilityEditor round-trip", () => {
  it("round-trips rules through week state", () => {
    const rules = [
      { weekday: 1, startTime: "09:00", endTime: "17:00" },
      { weekday: 5, startTime: "10:00", endTime: "16:00" },
    ];
    expect(weekStateToRules(rulesToWeekState(rules))).toEqual(rules);
  });
});
