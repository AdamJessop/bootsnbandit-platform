import { describe, expect, it } from "vitest";
import { IMAGE_EXT_BY_MIME, isAllowedImageMime, sniffImageMime } from "./uploads";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const GIF = new TextEncoder().encode("GIF89a......");
const WEBP = new Uint8Array([
  ...new TextEncoder().encode("RIFF"), 0, 0, 0, 0, ...new TextEncoder().encode("WEBP"),
]);
const AVIF = new Uint8Array([
  0, 0, 0, 0x1c, ...new TextEncoder().encode("ftypavif"), 0, 0, 0, 0,
]);
const SVG = new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'/>");

describe("sniffImageMime", () => {
  it.each([
    ["png", PNG, "image/png"],
    ["jpeg", JPEG, "image/jpeg"],
    ["gif", GIF, "image/gif"],
    ["webp", WEBP, "image/webp"],
    ["avif", AVIF, "image/avif"],
  ])("detects %s", (_n, bytes, mime) => {
    expect(sniffImageMime(bytes)).toBe(mime);
  });
  it("rejects svg / text / empty", () => {
    expect(sniffImageMime(SVG)).toBeNull();
    expect(sniffImageMime(new Uint8Array())).toBeNull();
  });
  it("maps allowed mimes to extensions", () => {
    expect(IMAGE_EXT_BY_MIME["image/jpeg"]).toBe("jpg");
    expect(isAllowedImageMime("image/svg+xml")).toBe(false);
    expect(isAllowedImageMime("image/webp")).toBe(true);
  });
});
