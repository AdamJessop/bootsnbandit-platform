import { describe, expect, it } from "vitest";
import { formatLondonDateTime, parseLondonDateTime } from "./london-date";

describe("parseLondonDateTime", () => {
  it("reads a winter (GMT) time as UTC", () => {
    expect(parseLondonDateTime("2026-11-14 18:00")?.toISOString()).toBe(
      "2026-11-14T18:00:00.000Z",
    );
  });

  it("reads a summer (BST) time an hour behind in UTC", () => {
    expect(parseLondonDateTime("2026-06-13T18:00")?.toISOString()).toBe(
      "2026-06-13T17:00:00.000Z",
    );
  });

  it("treats a bare date as the end of that day", () => {
    expect(parseLondonDateTime("2026-11-14")?.toISOString()).toBe(
      "2026-11-14T23:59:00.000Z",
    );
  });

  it("returns null for blank or malformed input", () => {
    expect(parseLondonDateTime("")).toBeNull();
    expect(parseLondonDateTime("Sat 7 Jun")).toBeNull();
    expect(parseLondonDateTime("2026-02-31")).toBeNull();
    expect(parseLondonDateTime("2026-11-14 25:00")).toBeNull();
  });
});

describe("formatLondonDateTime", () => {
  it("round-trips through the input format in both GMT and BST", () => {
    for (const s of ["2026-11-14 18:00", "2026-06-13 09:30"]) {
      expect(formatLondonDateTime(parseLondonDateTime(s))).toBe(s);
    }
  });

  it("renders empty for no date", () => {
    expect(formatLondonDateTime(null)).toBe("");
  });
});
