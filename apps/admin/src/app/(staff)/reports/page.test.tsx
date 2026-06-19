import { describe, expect, it } from "vitest";
import { revenueTrendData, type RawBooking } from "./report-data";

/**
 * The reports page is an async Server Component (DB + server-only). Its chart
 * series are the pure report-data transforms, asserted here and in
 * report-data.test.ts.
 */
describe("ReportsPage series", () => {
  it("produces an empty trend for no bookings", () => {
    expect(revenueTrendData([] as RawBooking[])).toEqual([]);
  });
});
