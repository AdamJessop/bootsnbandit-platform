import { describe, expect, it } from "vitest";
import { toReportCsv } from "./report-data";

/**
 * ReportsView renders recharts in the browser; its data transforms +
 * CSV are the pure report-data helpers asserted here and in
 * report-data.test.ts.
 */
describe("ReportsView CSV", () => {
  it("exports per-artist rows", () => {
    const csv = toReportCsv([
      {
        artistName: "Boots",
        bookings: 1,
        completed: 1,
        revenuePence: 10000,
        utilisationPct: 50,
      },
    ]);
    expect(csv).toContain("Boots,1,1,100.00,50");
  });
});
