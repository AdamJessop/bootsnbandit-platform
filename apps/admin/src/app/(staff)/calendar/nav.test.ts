import { describe, expect, it } from "vitest";
import { shiftAnchor } from "./nav";

const iso = (y: number, m: number, d: number) =>
  new Date(y, m, d, 12, 0).toISOString();

describe("shiftAnchor", () => {
  it("steps one day in day view", () => {
    const next = shiftAnchor(iso(2026, 5, 16), "day", 1);
    expect(new Date(next).getDate()).toBe(17);
  });

  it("steps one week in week view", () => {
    const next = shiftAnchor(iso(2026, 5, 16), "week", 1);
    expect(new Date(next).getDate()).toBe(23);
  });

  it("steps backwards", () => {
    const next = shiftAnchor(iso(2026, 5, 16), "day", -1);
    expect(new Date(next).getDate()).toBe(15);
  });
});
