import { describe, expect, it } from "vitest";
import { filterBookingRows, type BookingRow } from "./BookingsTable";

/**
 * The bookings page is an async Server Component (DB + server-only). Its
 * client-side filtering is the pure filterBookingRows predicate, asserted here.
 */
describe("BookingsPage filtering", () => {
  it("scopes rows by status", () => {
    const rows: BookingRow[] = [
      {
        id: "1",
        customerName: "A",
        artistName: "X",
        type: "session",
        status: "completed",
        startISO: "2026-06-01T10:00:00Z",
        priceEstimatePence: null,
      },
    ];
    expect(filterBookingRows(rows, { status: "completed" })).toHaveLength(1);
    expect(filterBookingRows(rows, { status: "pending" })).toHaveLength(0);
  });
});
