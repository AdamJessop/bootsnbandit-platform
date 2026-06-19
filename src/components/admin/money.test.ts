import { describe, expect, it } from "vitest";
import { formatPence, parsePoundsToPence } from "./money";

describe("formatPence", () => {
  it("formats pence as GBP with two decimals", () => {
    expect(formatPence(12500)).toBe("£125.00");
    expect(formatPence(99)).toBe("£0.99");
  });

  it("treats null/undefined as zero", () => {
    expect(formatPence(null)).toBe("£0.00");
    expect(formatPence(undefined)).toBe("£0.00");
  });
});

describe("parsePoundsToPence", () => {
  it("parses whole pounds and decimals", () => {
    expect(parsePoundsToPence("125")).toBe(12500);
    expect(parsePoundsToPence("125.50")).toBe(12550);
    expect(parsePoundsToPence("0.99")).toBe(99);
  });

  it("strips a leading £ and thousands separators", () => {
    expect(parsePoundsToPence("£1,250")).toBe(125000);
  });

  it("rejects invalid input", () => {
    expect(parsePoundsToPence("")).toBeNull();
    expect(parsePoundsToPence("abc")).toBeNull();
    expect(parsePoundsToPence("-5")).toBeNull();
    expect(parsePoundsToPence("1.234")).toBeNull();
  });
});
