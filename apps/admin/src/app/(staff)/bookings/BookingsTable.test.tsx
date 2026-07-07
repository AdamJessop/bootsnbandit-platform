import { describe, expect, it } from "vitest";
import {
  BookingsTable,
  filterBookingRows,
  type BookingRow,
} from "./BookingsTable";

const rows: BookingRow[] = [
  {
    id: "1",
    customerName: "Amy",
    artistName: "Boots",
    type: "session",
    status: "confirmed",
    startISO: "2026-06-01T10:00:00Z",
    priceEstimatePence: 12000,
    cancelRequestedAt: null,
  },
  {
    id: "2",
    customerName: "Bob",
    artistName: "Bandit",
    type: "consult",
    status: "cancelled",
    startISO: "2026-06-02T10:00:00Z",
    priceEstimatePence: null,
    cancelRequestedAt: null,
  },
  {
    id: "3",
    customerName: "Cat",
    artistName: "Boots",
    type: "session",
    status: "confirmed",
    startISO: "2026-06-03T10:00:00Z",
    priceEstimatePence: 8000,
    cancelRequestedAt: "2026-06-01T09:00:00Z",
  },
];

describe("BookingsTable", () => {
  it("is a component function", () => {
    expect(typeof BookingsTable).toBe("function");
  });
});

describe("filterBookingRows", () => {
  it("filters by status", () => {
    expect(filterBookingRows(rows, { status: "confirmed" })).toHaveLength(2);
  });

  it("filters by type", () => {
    expect(filterBookingRows(rows, { type: "consult" })[0].id).toBe("2");
  });

  it("returns all rows when no filters set", () => {
    expect(filterBookingRows(rows, {})).toHaveLength(3);
  });

  it("filters to cancellation-requested rows only", () => {
    const out = filterBookingRows(rows, { cancelRequested: true });
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("3");
  });

  it("combines cancelRequested with other filters", () => {
    expect(
      filterBookingRows(rows, { cancelRequested: true, type: "consult" }),
    ).toHaveLength(0);
  });
});
