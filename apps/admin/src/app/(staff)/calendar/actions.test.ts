import { beforeEach, describe, expect, it, vi } from "vitest";

const requireRole = vi.fn();
const createBooking = vi.fn();
const updateBooking = vi.fn();
const createCustomerWithWelcome = vi.fn();

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
vi.mock("@bnb/core/services/customer-welcome", () => ({
  createCustomerWithWelcome: (input: unknown) =>
    createCustomerWithWelcome(input),
}));

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
  vi.unstubAllEnvs();
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

  it("lets an artist create for a colleague (front-desk quick-add)", async () => {
    requireRole.mockResolvedValue(artist);
    createBooking.mockResolvedValue({ id: "bk_2" });
    const res = await saveBookingAction(saveInput); // artistId art_1 ≠ art_self
    expect(res).toEqual({ ok: true, bookingId: "bk_2" });
    expect(createBooking).toHaveBeenCalledWith(
      expect.objectContaining({ artistId: "art_1" }),
    );
  });

  it("still requires a signed-in staff member", async () => {
    requireRole.mockRejectedValue(new Error("NEXT_REDIRECT"));
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

describe("saveBookingAction (inline new customer)", () => {
  const { customerId: _drop, ...noCustomer } = saveInput;
  const newCustomerInput = {
    ...noCustomer,
    newCustomer: {
      name: "Robin Vale",
      email: "robin@example.com",
      dob: "1990-04-12",
    },
  };

  it("creates the customer (welcome email) then the booking", async () => {
    requireRole.mockResolvedValue(owner);
    createCustomerWithWelcome.mockResolvedValue({ id: "cus_new" });
    createBooking.mockResolvedValue({ id: "bk_9" });
    vi.stubEnv("PUBLIC_SITE_ORIGIN", "https://bootsandbandit.com");

    const res = await saveBookingAction(newCustomerInput);

    expect(res).toEqual({ ok: true, bookingId: "bk_9" });
    expect(createCustomerWithWelcome).toHaveBeenCalledWith({
      name: "Robin Vale",
      email: "robin@example.com",
      dob: new Date("1990-04-12T00:00:00.000Z"),
      siteOrigin: "https://bootsandbandit.com",
    });
    expect(createBooking).toHaveBeenCalledWith(
      expect.objectContaining({ customerId: "cus_new" }),
    );
    // Customer creation (welcome email) strictly precedes the booking write.
    expect(createCustomerWithWelcome.mock.invocationCallOrder[0]).toBeLessThan(
      createBooking.mock.invocationCallOrder[0],
    );
  });

  it("defaults siteOrigin to localhost and dob to null when omitted", async () => {
    requireRole.mockResolvedValue(owner);
    createCustomerWithWelcome.mockResolvedValue({ id: "cus_new" });
    createBooking.mockResolvedValue({ id: "bk_10" });
    vi.stubEnv("PUBLIC_SITE_ORIGIN", undefined);

    const res = await saveBookingAction({
      ...noCustomer,
      newCustomer: { name: "Robin Vale", email: "robin@example.com" },
    });

    expect(res.ok).toBe(true);
    expect(createCustomerWithWelcome).toHaveBeenCalledWith(
      expect.objectContaining({
        dob: null,
        siteOrigin: "http://localhost:3000",
      }),
    );
  });

  it("rejects when neither customerId nor newCustomer is given", async () => {
    requireRole.mockResolvedValue(owner);
    const res = await saveBookingAction({ ...noCustomer });
    expect(res.ok).toBe(false);
    expect(createCustomerWithWelcome).not.toHaveBeenCalled();
    expect(createBooking).not.toHaveBeenCalled();
  });

  it("rejects when both customerId and newCustomer are given", async () => {
    requireRole.mockResolvedValue(owner);
    const res = await saveBookingAction({
      ...saveInput,
      newCustomer: { name: "Robin Vale", email: "robin@example.com" },
    });
    expect(res.ok).toBe(false);
    expect(createCustomerWithWelcome).not.toHaveBeenCalled();
    expect(createBooking).not.toHaveBeenCalled();
  });

  it("rejects a malformed new-customer email", async () => {
    requireRole.mockResolvedValue(owner);
    const res = await saveBookingAction({
      ...noCustomer,
      newCustomer: { name: "Robin Vale", email: "not-an-email" },
    });
    expect(res.ok).toBe(false);
    expect(createCustomerWithWelcome).not.toHaveBeenCalled();
  });

  it("does not create the booking when customer creation fails", async () => {
    requireRole.mockResolvedValue(owner);
    createCustomerWithWelcome.mockRejectedValue(new Error("email exists"));
    const res = await saveBookingAction(newCustomerInput);
    expect(res.ok).toBe(false);
    expect(createBooking).not.toHaveBeenCalled();
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

  it("blocks an artist updating another artist's booking", async () => {
    requireRole.mockResolvedValue(artist);
    const res = await updateBookingAction({
      id: "bk_1",
      artistId: "art_other",
      start: "2026-06-16T13:00:00.000Z",
    });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/own calendar/i);
    expect(updateBooking).not.toHaveBeenCalled();
  });

  it("lets an artist update their own booking", async () => {
    requireRole.mockResolvedValue(artist);
    updateBooking.mockResolvedValue({ id: "bk_1" });
    const res = await updateBookingAction({ id: "bk_1", artistId: "art_self" });
    expect(res.ok).toBe(true);
  });

  it("surfaces a booking conflict on move", async () => {
    requireRole.mockResolvedValue(owner);
    updateBooking.mockRejectedValue(new BookingConflictError("booking"));
    const res = await updateBookingAction({ id: "bk_1", artistId: "art_1" });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/already booked/i);
  });
});
