import { describe, expect, it } from "vitest";
import {
  WEEKDAYS,
  rulesToWeekState,
  weekStateToRules,
  validateDay,
} from "./availability-helpers";

describe("WEEKDAYS", () => {
  it("lists 7 days starting Sunday", () => {
    expect(WEEKDAYS).toHaveLength(7);
    expect(WEEKDAYS[0].weekday).toBe(0);
    expect(WEEKDAYS[2].label).toBe("Tue");
  });
});

describe("rulesToWeekState", () => {
  it("maps rules onto enabled days", () => {
    const state = rulesToWeekState([
      { weekday: 2, startTime: "10:00", endTime: "18:00" },
    ]);
    expect(state[2]).toEqual({ enabled: true, start: "10:00", end: "18:00" });
    expect(state[0].enabled).toBe(false);
  });
});

describe("weekStateToRules", () => {
  it("emits rules only for enabled days", () => {
    const state = rulesToWeekState([
      { weekday: 3, startTime: "11:00", endTime: "17:00" },
    ]);
    const rules = weekStateToRules(state);
    expect(rules).toEqual([
      { weekday: 3, startTime: "11:00", endTime: "17:00" },
    ]);
  });
});

describe("validateDay", () => {
  it("rejects end before start", () => {
    expect(validateDay({ enabled: true, start: "18:00", end: "10:00" })).toBe(
      false,
    );
  });

  it("accepts a valid window or a disabled day", () => {
    expect(validateDay({ enabled: true, start: "10:00", end: "18:00" })).toBe(
      true,
    );
    expect(validateDay({ enabled: false, start: "x", end: "y" })).toBe(true);
  });
});
