import { describe, it, expect } from "vitest";
import {
  parseStageBody,
  splitStageTitle,
  stageForDay,
  trackProgress,
  type StageRange,
} from "./logic";

const RANGES: StageRange[] = [
  { order: 0, minDay: 1, maxDay: 2 },
  { order: 1, minDay: 3, maxDay: 6 },
  { order: 2, minDay: 7, maxDay: 14 },
  { order: 3, minDay: 15, maxDay: 30 },
  { order: 4, minDay: 31, maxDay: null },
];

describe("stageForDay", () => {
  it("maps days to the seeded stages", () => {
    expect(stageForDay(RANGES, 1)).toBe(0);
    expect(stageForDay(RANGES, 2)).toBe(0);
    expect(stageForDay(RANGES, 3)).toBe(1);
    expect(stageForDay(RANGES, 6)).toBe(1);
    expect(stageForDay(RANGES, 7)).toBe(2);
    expect(stageForDay(RANGES, 14)).toBe(2);
    expect(stageForDay(RANGES, 15)).toBe(3);
    expect(stageForDay(RANGES, 30)).toBe(3);
    expect(stageForDay(RANGES, 31)).toBe(4);
    expect(stageForDay(RANGES, 400)).toBe(4);
  });

  it("clamps day 0 / negatives to the first stage", () => {
    expect(stageForDay(RANGES, 0)).toBe(0);
    expect(stageForDay(RANGES, -5)).toBe(0);
  });

  it("falls into the last stage when every range is bounded", () => {
    const bounded = RANGES.map((r) => ({ ...r, maxDay: r.maxDay ?? 60 }));
    expect(stageForDay(bounded, 999)).toBe(4);
  });

  it("returns 0 for no stages", () => {
    expect(stageForDay([], 10)).toBe(0);
  });
});

describe("trackProgress", () => {
  it("spans 0–100 across the nodes", () => {
    expect(trackProgress(5, 0)).toBe(0);
    expect(trackProgress(5, 2)).toBe(50);
    expect(trackProgress(5, 4)).toBe(100);
  });

  it("clamps out-of-range indexes and handles a single node", () => {
    expect(trackProgress(5, 9)).toBe(100);
    expect(trackProgress(5, -1)).toBe(0);
    expect(trackProgress(1, 0)).toBe(0);
    expect(trackProgress(0, 0)).toBe(0);
  });
});

describe("splitStageTitle", () => {
  it("splits the seeded 'Day · Name' format", () => {
    expect(splitStageTitle("Day 1–2 · Fresh & wrapped")).toEqual({
      day: "Day 1–2",
      name: "Fresh & wrapped",
    });
  });

  it("uses a plain title for both parts", () => {
    expect(splitStageTitle("Healed")).toEqual({ day: "Healed", name: "Healed" });
  });

  it("falls back when one side of the dot is empty", () => {
    expect(splitStageTitle("Day 30+ ·")).toEqual({
      day: "Day 30+",
      name: "Day 30+",
    });
  });
});

describe("parseStageBody", () => {
  it("splits the seeded body into care bullets and feel copy", () => {
    const r = parseStageBody(
      "Care: keep the wrap on as your artist advised; first wash with lukewarm water; pat dry, never rub. How it feels: tender, warm and a little swollen.",
    );
    expect(r.care).toEqual([
      "Keep the wrap on as your artist advised.",
      "First wash with lukewarm water.",
      "Pat dry, never rub.",
    ]);
    expect(r.feel).toBe("Tender, warm and a little swollen.");
  });

  it("treats a free-form body as a single care bullet with no feel", () => {
    expect(parseStageBody("Keep the wrap on.")).toEqual({
      care: ["Keep the wrap on."],
      feel: null,
    });
  });

  it("handles a body with only a feel section", () => {
    expect(parseStageBody("How it feels: fully healed.")).toEqual({
      care: [],
      feel: "Fully healed.",
    });
  });
});
