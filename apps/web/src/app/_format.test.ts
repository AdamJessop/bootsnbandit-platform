import { describe, it, expect } from "vitest";
import { formatPence, firstName } from "./_format";

describe("formatPence", () => {
  it("renders whole pounds without decimals", () => {
    expect(formatPence(13000)).toBe("£130");
    expect(formatPence(9000)).toBe("£90");
  });

  it("renders part-pounds with two decimals", () => {
    expect(formatPence(12550)).toBe("£125.50");
    expect(formatPence(99)).toBe("£0.99");
  });

  it("returns an em-dash for null/undefined", () => {
    expect(formatPence(null)).toBe("—");
    expect(formatPence(undefined)).toBe("—");
  });

  it("handles zero", () => {
    expect(formatPence(0)).toBe("£0");
  });
});

describe("firstName", () => {
  it("takes the first whitespace-delimited token", () => {
    expect(firstName("Sarah")).toBe("Sarah");
    expect(firstName("Adam Jessop")).toBe("Adam");
  });

  it("falls back to the whole string when blank", () => {
    expect(firstName("")).toBe("");
  });
});
