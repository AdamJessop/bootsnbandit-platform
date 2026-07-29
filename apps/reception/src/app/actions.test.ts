import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUser = vi.fn();
const setStaffCheckin = vi.fn();
const checkInCustomer = vi.fn();
const createWalkInBooking = vi.fn();
const completeSession = vi.fn();
const revalidatePath = vi.fn();
const loadArtistShowcase = vi.fn();

vi.mock("@bnb/core/auth", () => ({
  getCurrentUser: () => getCurrentUser(),
}));
vi.mock("@bnb/core/services/artist-showcase", () => ({
  loadArtistShowcase: (...a: unknown[]) => loadArtistShowcase(...a),
}));
vi.mock("@bnb/core/services/reception", async () => {
  const actual = await vi.importActual<
    typeof import("@bnb/core/services/reception")
  >("@bnb/core/services/reception");
  return {
    ReceptionCheckinError: actual.ReceptionCheckinError,
    setStaffCheckin: (...a: unknown[]) => setStaffCheckin(...a),
    checkInCustomer: (...a: unknown[]) => checkInCustomer(...a),
    createWalkInBooking: (...a: unknown[]) => createWalkInBooking(...a),
  };
});
vi.mock("@bnb/core/services/sessions", () => ({
  SessionCompletionError: class SessionCompletionError extends Error {},
  completeSession: (...a: unknown[]) => completeSession(...a),
}));
vi.mock("@bnb/core/services/bookings", () => ({
  BookingConflictError: class BookingConflictError extends Error {},
}));
vi.mock("next/cache", () => ({
  revalidatePath: (...a: unknown[]) => revalidatePath(...a),
}));

import {
  artistShowcaseAction,
  checkoutAction,
  customerCheckinAction,
  toggleStaffAction,
  walkInAction,
} from "./actions";

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentUser.mockResolvedValue({ id: "u1", role: "OWNER" });
});

describe("kiosk actions auth guard", () => {
  it("every action refuses when the kiosk is signed out", async () => {
    getCurrentUser.mockResolvedValue(null);
    for (const run of [
      () => toggleStaffAction("a1", true),
      () =>
        customerCheckinAction({
          bookingId: "b1",
          answers: { age: true },
          signature: "data:image/png;base64,AA",
        }),
      () =>
        walkInAction({
          customerName: "Jo",
          artistId: "a1",
          startIso: new Date().toISOString(),
          durationMin: 60,
          type: "session",
        }),
      () => checkoutAction("b1", 100),
      () => artistShowcaseAction("a1"),
    ]) {
      const res = await run();
      expect(res.ok).toBe(false);
    }
    expect(setStaffCheckin).not.toHaveBeenCalled();
    expect(completeSession).not.toHaveBeenCalled();
  });

  it("artistShowcaseAction refuses with the signed-out message", async () => {
    getCurrentUser.mockResolvedValue(null);
    const res = await artistShowcaseAction("a1");
    expect(res).toEqual({
      ok: false,
      error: "The kiosk is signed out — sign in again from the front desk",
    });
    expect(loadArtistShowcase).not.toHaveBeenCalled();
  });
});

describe("toggleStaffAction", () => {
  it("delegates to the service and revalidates the board", async () => {
    setStaffCheckin.mockResolvedValue({});
    const res = await toggleStaffAction("a1", true);
    expect(res.ok).toBe(true);
    expect(setStaffCheckin).toHaveBeenCalledWith("a1", true);
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });
});

describe("customerCheckinAction", () => {
  it("derives the flag from the answers server-side", async () => {
    checkInCustomer.mockResolvedValue({});
    const res = await customerCheckinAction({
      bookingId: "b1",
      answers: { age: false, sober: true },
      signature: "data:image/png;base64,AA",
    });
    expect(res.ok).toBe(true);
    expect(checkInCustomer).toHaveBeenCalledWith(
      expect.objectContaining({ bookingId: "b1", flagged: true }),
    );
  });

  it("rejects a non-image signature payload", async () => {
    const res = await customerCheckinAction({
      bookingId: "b1",
      answers: { age: true },
      signature: "javascript:alert(1)",
    });
    expect(res.ok).toBe(false);
    expect(checkInCustomer).not.toHaveBeenCalled();
  });

  it("surfaces a friendly message for double check-in", async () => {
    const { ReceptionCheckinError } =
      await import("@bnb/core/services/reception");
    checkInCustomer.mockRejectedValue(
      new ReceptionCheckinError("This booking has already been checked in"),
    );
    const res = await customerCheckinAction({
      bookingId: "b1",
      answers: { age: true },
      signature: "data:image/png;base64,AA",
    });
    expect(res).toEqual({
      ok: false,
      error: "This booking has already been checked in",
    });
  });
});

describe("walkInAction", () => {
  it("creates the walk-in booking", async () => {
    createWalkInBooking.mockResolvedValue({ id: "b9" });
    const start = new Date().toISOString();
    const res = await walkInAction({
      customerName: "Jo Bloggs",
      phone: "07123",
      artistId: "a1",
      startIso: start,
      durationMin: 120,
      type: "session",
    });
    expect(res.ok).toBe(true);
    expect(createWalkInBooking).toHaveBeenCalledWith(
      expect.objectContaining({
        customerName: "Jo Bloggs",
        durationMin: 120,
        type: "session",
      }),
    );
  });

  it("rejects invalid input without hitting the service", async () => {
    const res = await walkInAction({
      customerName: "",
      artistId: "a1",
      startIso: "not-a-date",
      durationMin: 0,
      type: "session",
    });
    expect(res.ok).toBe(false);
    expect(createWalkInBooking).not.toHaveBeenCalled();
  });
});

describe("checkoutAction", () => {
  it("completes the session with the charged amount", async () => {
    completeSession.mockResolvedValue({ session: {}, loyalty: null });
    const res = await checkoutAction("b1", 15000);
    expect(res.ok).toBe(true);
    expect(completeSession).toHaveBeenCalledWith({
      bookingId: "b1",
      amountChargedPence: 15000,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });

  it("rejects a negative amount", async () => {
    const res = await checkoutAction("b1", -5);
    expect(res.ok).toBe(false);
    expect(completeSession).not.toHaveBeenCalled();
  });
});

describe("artistShowcaseAction", () => {
  it("rejects an empty artist id without hitting the loader", async () => {
    const res = await artistShowcaseAction("");
    expect(res.ok).toBe(false);
    expect(loadArtistShowcase).not.toHaveBeenCalled();
  });

  it("passes through the loader's showcase, including gallery", async () => {
    const showcase = {
      artist: {
        id: "a1",
        name: "Sarah",
        status: "CO_OWNER",
        tag: null,
        bio: null,
        styles: ["blackwork"],
        specials: [],
        insta: null,
        experience: null,
        rating: null,
        pieces: null,
        headshot: null,
        hue: "crimson",
      },
      gallery: [
        {
          id: "g1",
          title: "Rose sleeve",
          style: "blackwork",
          placement: "arm",
          image: "https://example.com/g1.jpg",
          hue: "crimson",
          featured: true,
        },
      ],
    };
    loadArtistShowcase.mockResolvedValue(showcase);
    const res = await artistShowcaseAction("a1");
    expect(res).toEqual({ ok: true, data: showcase });
    expect(loadArtistShowcase).toHaveBeenCalledWith("a1");
  });

  it("returns a friendly error when the loader finds no artist", async () => {
    loadArtistShowcase.mockResolvedValue(null);
    const res = await artistShowcaseAction("missing");
    expect(res).toEqual({
      ok: false,
      error: "Artist not found — refresh the board",
    });
  });

  it("maps unexpected loader errors to the generic message", async () => {
    loadArtistShowcase.mockRejectedValue(new Error("db down"));
    const res = await artistShowcaseAction("a1");
    expect(res).toEqual({
      ok: false,
      error: "Something went wrong — give it another try",
    });
  });
});
