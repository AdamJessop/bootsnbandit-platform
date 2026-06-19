import { describe, expect, it } from "vitest";
import { currentBooking, nextBooking, type DeskBooking } from "./desk-board";

const mk = (id: string, startH: number, endH: number): DeskBooking => {
  const start = new Date(2026, 5, 16, startH, 0).toISOString();
  const end = new Date(2026, 5, 16, endH, 0).toISOString();
  return {
    id,
    start,
    end,
    type: "session",
    status: "confirmed",
    customerName: "X",
  };
};

const bookings = [mk("a", 10, 12), mk("b", 13, 15), mk("c", 16, 17)];

describe("currentBooking", () => {
  it("finds the in-progress booking", () => {
    expect(currentBooking(bookings, new Date(2026, 5, 16, 11, 0))?.id).toBe("a");
  });
  it("returns null in a gap", () => {
    expect(currentBooking(bookings, new Date(2026, 5, 16, 12, 30))).toBeNull();
  });
  it("treats end as exclusive", () => {
    expect(currentBooking(bookings, new Date(2026, 5, 16, 12, 0))).toBeNull();
  });
});

describe("nextBooking", () => {
  it("returns the soonest upcoming booking", () => {
    expect(nextBooking(bookings, new Date(2026, 5, 16, 12, 30))?.id).toBe("b");
  });
  it("returns null when the day is done", () => {
    expect(nextBooking(bookings, new Date(2026, 5, 16, 18, 0))).toBeNull();
  });
});
