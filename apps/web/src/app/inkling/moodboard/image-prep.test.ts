import { describe, expect, it } from "vitest";
import { shouldDownscale, targetDimensions } from "./image-prep";

describe("image prep", () => {
  it("scales the long edge to the max, preserving aspect", () => {
    expect(targetDimensions(4000, 3000)).toEqual({ width: 1600, height: 1200 });
    expect(targetDimensions(1000, 2400)).toEqual({ width: 667, height: 1600 });
    expect(targetDimensions(800, 600)).toEqual({ width: 800, height: 600 });
  });
  it("skips small files and already-small images", () => {
    expect(shouldDownscale(100_000, 4000, 3000)).toBe(false);
    expect(shouldDownscale(2_000_000, 1200, 900)).toBe(false);
    expect(shouldDownscale(2_000_000, 4000, 3000)).toBe(true);
  });
});
