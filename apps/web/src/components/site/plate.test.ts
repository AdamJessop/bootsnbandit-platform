import { describe, it, expect } from "vitest";
import { hashStr, plateBg } from "./plate";

describe("hashStr", () => {
  it("is deterministic for the same input", () => {
    expect(hashStr("marnie")).toBe(hashStr("marnie"));
  });

  it("returns an unsigned 32-bit integer", () => {
    const h = hashStr("anything");
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(0xffffffff);
    expect(Number.isInteger(h)).toBe(true);
  });

  it("differs for different inputs", () => {
    expect(hashStr("a")).not.toBe(hashStr("b"));
  });

  it("handles empty string", () => {
    expect(typeof hashStr("")).toBe("number");
  });
});

describe("plateBg", () => {
  it("produces a deterministic gradient for a seed", () => {
    expect(plateBg("flash-1")).toEqual(plateBg("flash-1"));
  });

  it("returns a linear-gradient background string", () => {
    expect(plateBg("seed").background).toMatch(/^linear-gradient\(/);
  });

  it("derives hue from the seed within 0–359 when no hue given", () => {
    const { hue } = plateBg("derive-me");
    expect(hue).toBeGreaterThanOrEqual(0);
    expect(hue).toBeLessThan(360);
  });

  it("honours an explicit hue override", () => {
    expect(plateBg("x", 200).hue).toBe(200);
  });
});
