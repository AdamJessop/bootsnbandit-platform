import { describe, expect, it } from "vitest";
import {
  downscaleImage,
  fitWithin,
  MAX_EDGE,
  needsDownscale,
  renamed,
  RESIZE_OVER_BYTES,
} from "./image-resize";

/**
 * Sizing maths for the client-side downscale (pure). The canvas path itself
 * needs a browser; in node `downscaleImage` must hand the file back untouched.
 */

const MB = 1024 * 1024;

describe("needsDownscale", () => {
  it("flags a 48MP phone photo by its long edge", () => {
    expect(
      needsDownscale({
        type: "image/jpeg",
        size: 3 * MB,
        width: 8064,
        height: 6048,
      }),
    ).toBe(true);
  });

  it("flags anything over 4MB even when it is already small enough", () => {
    expect(
      needsDownscale({
        type: "image/png",
        size: RESIZE_OVER_BYTES + 1,
        width: 2000,
        height: 1500,
      }),
    ).toBe(true);
  });

  it("leaves images at or under 2400px and 4MB alone", () => {
    expect(
      needsDownscale({
        type: "image/jpeg",
        size: 2 * MB,
        width: MAX_EDGE,
        height: 1600,
      }),
    ).toBe(false);
    expect(
      needsDownscale({
        type: "image/webp",
        size: RESIZE_OVER_BYTES,
        width: 1200,
        height: 2400,
      }),
    ).toBe(false);
  });

  it("never touches GIFs (canvas would flatten the animation)", () => {
    expect(
      needsDownscale({
        type: "image/gif",
        size: 7 * MB,
        width: 4000,
        height: 4000,
      }),
    ).toBe(false);
  });
});

describe("fitWithin", () => {
  it("scales the long edge to 2400 keeping the aspect ratio (landscape)", () => {
    expect(fitWithin(8064, 6048)).toEqual({ width: 2400, height: 1800 });
  });

  it("scales portrait images by height", () => {
    expect(fitWithin(3024, 4032)).toEqual({ width: 1800, height: 2400 });
  });

  it("rounds odd ratios to whole pixels", () => {
    expect(fitWithin(5000, 3333)).toEqual({ width: 2400, height: 1600 });
  });

  it("never upscales and never returns a zero side", () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(100000, 10)).toEqual({ width: 2400, height: 1 });
  });

  it("honours a custom max edge", () => {
    expect(fitWithin(1000, 500, 100)).toEqual({ width: 100, height: 50 });
  });
});

describe("renamed", () => {
  it("swaps the extension for the re-encoded type", () => {
    expect(renamed("IMG_0042.JPG", "image/webp")).toBe("IMG_0042.webp");
    expect(renamed("photo.png", "image/jpeg")).toBe("photo.jpg");
    expect(renamed("noext", "image/webp")).toBe("noext.webp");
  });
});

describe("downscaleImage", () => {
  it("returns the original file where the browser APIs are missing", async () => {
    const file = new File([new Uint8Array([1])], "x.png", {
      type: "image/png",
    });
    expect(await downscaleImage(file)).toBe(file);
  });

  it("returns GIFs untouched", async () => {
    const file = new File([new Uint8Array([1])], "x.gif", {
      type: "image/gif",
    });
    expect(await downscaleImage(file)).toBe(file);
  });
});
