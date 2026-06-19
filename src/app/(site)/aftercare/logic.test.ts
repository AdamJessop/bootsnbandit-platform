import { describe, it, expect } from "vitest";
import { stageForDay } from "./logic";

// 5 seeded stages, ordered 0..4 with day ranges per COMPOSITION-NOTES.
const STAGES = [
  { order: 0, minDay: 1, maxDay: 2 },
  { order: 1, minDay: 3, maxDay: 6 },
  { order: 2, minDay: 7, maxDay: 14 },
  { order: 3, minDay: 15, maxDay: 30 },
  { order: 4, minDay: 31, maxDay: null },
];

describe("stageForDay", () => {
  it("maps early days to the fresh stage", () => {
    expect(stageForDay(STAGES, 1)).toBe(0);
    expect(stageForDay(STAGES, 2)).toBe(0);
  });

  it("maps mid ranges correctly", () => {
    expect(stageForDay(STAGES, 4)).toBe(1);
    expect(stageForDay(STAGES, 10)).toBe(2);
    expect(stageForDay(STAGES, 20)).toBe(3);
  });

  it("maps day 30+ to the healed stage (open-ended max)", () => {
    expect(stageForDay(STAGES, 31)).toBe(4);
    expect(stageForDay(STAGES, 365)).toBe(4);
  });

  it("clamps day 0 / negatives to the first stage", () => {
    expect(stageForDay(STAGES, 0)).toBe(0);
    expect(stageForDay(STAGES, -5)).toBe(0);
  });
});
