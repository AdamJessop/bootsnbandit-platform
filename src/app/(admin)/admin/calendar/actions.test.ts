import { beforeEach, describe, expect, it, vi } from "vitest";

const requireRole = vi.fn();
const createBooking = vi.fn();
const updateBooking = vi.fn();

vi.mock("@bnb/core/auth", () => ({ requireRole: () => requireRole() }));
vi.mock("@bnb/core/services/bookings", async () => {
  // Re-use the real BookingConflictError so instanceof checks work.
  const actual = await vi.importActual<
    typeof import("@bnb/core/services/bookings")
  >("@bnb/core/services/bookings");
  return {
    BookingConflictError: actual.BookingConflictError,
    createBooking: (input: unknown) => createBooking(input),
    updateBooking: (id: string, input: unknown) => updateBooking(id, input),
  };
});

import { BookingConflictError } from "@bnb/core/services/bookings";
import { saveBookingAction, updateBookingAction } from "./actions";

const owner = { role: "OWNER", artistId: null };
const artist = { role: "ARTIST", artistId: "art_self" };

const saveInput = {
  customerId: "cus_1",
  artistId: "art_1",
  type: "session" as const,
  durationMin: 90,
  start: "2026-06-16T12:00:00.000Z",
  end: "2026-06-16T13:30:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("saveBookingAction", () => {
  it("creates a booking and returns its id (owner)", async () => {
    requireRole.mockResolvedValue(owner);
    createBooking.mockResolvedValue({ id: "bk_1" });
    const res = await saveBookingAction(saveInput);
    expect(res).toEqual({ ok: true, bookingId: "bk_1" });
    expect(createBooking).toHaveBeenCalledWith(
      expect.objectContaining({ customerId: "cus_1" }),
    );
  });

  it("blocks an artist creating for another artist", async () => {
    requireRole.mockResolvedValue(artist);
    const res = await saveBookingAction(saveInput);
    expect(res.ok).toBe(false);
    expect(createBooking).not.toHaveBeenCalled();
  });

  it("surfaces a friendly conflict message", async () => {
    requireRole.mockResolvedValue(owner);
    createBooking.mockRejectedValue(new BookingConflictError("leave"));
    const res = await saveBookingAction(saveInput);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/leave/i);
  });
});

describe("updateBookingAction", () => {
  it("moves a booking (owner) and converts ISO to Date", async () => {
    requireRole.mockResolvedValue(owner);
    updateBooking.mockResolvedValue({ id: "bk_1" });
    const res = await updateBookingAction({
      id: "bk_1",
      artistId: "art_1",
      start: "2026-06-16T13:00:00.000Z",
      end: "2026-06-16T14:30:00.000Z",
    });
    expect(res.ok).toBe(true);
    const [, patch] = updateBooking.mock.calls[0];
    expect((patch as { start: Date }).start).toBeInstanceOf(Date);
  });

  it("surfaces a booking conflict on move", async () => {
    requireRole.mockResolvedValue(owner);
    updateBooking.mockRejectedValue(new BookingConflictError("booking"));
    const res = await updateBookingAction({ id: "bk_1", artistId: "art_1" });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/already booked/i);
  });
});
