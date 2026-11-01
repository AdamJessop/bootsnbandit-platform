import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUser = vi.fn();
const setStaffCheckin = vi.fn();
const checkInCustomer = vi.fn();
const createWalkInBooking = vi.fn();
const completeSession = vi.fn();
const revalidatePath = vi.fn();
const loadArtistShowcase = vi.fn();
const consentNeedsAck = vi.fn();
const verifyKioskPin = vi.fn();
const kioskPinConfigured = vi.fn();

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
    consentNeedsAck: (...a: unknown[]) => consentNeedsAck(...a),
    verifyKioskPin: (...a: unknown[]) => verifyKioskPin(...a),
    kioskPinConfigured: () => kioskPinConfigured(),
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

import { CURRENT_CONSENT_FORM } from "@bnb/core/consent";
import {
  artistShowcaseAction,
  checkoutAction,
  customerCheckinAction,
  toggleStaffAction,
  verifyStaffPinAction,
  walkInAction,
} from "./actions";
import { pinThrottle } from "./pin-throttle";

/** Every question answered the way that needs no follow-up. */
const CLEAN = Object.fromEntries(
  CURRENT_CONSENT_FORM.questions.map((q) => [q.id, q.expect === "yes"]),
);

/** A complete, valid kiosk check-in payload. */
function checkin(over: Record<string, unknown> = {}) {
  return {
    bookingId: "b1",
    answers: CLEAN,
    signature: "data:image/png;base64,AA",
    printedName: "Megan Wray",
    dob: "1990-01-15",
    idCheckedByArtistId: "a1",
    ...over,
  } as Parameters<typeof customerCheckinAction>[0];
}

beforeEach(() => {
  vi.clearAllMocks();
  pinThrottle.reset();
  getCurrentUser.mockResolvedValue({ id: "u1", role: "OWNER" });
  consentNeedsAck.mockResolvedValue(false);
});

describe("kiosk actions auth guard", () => {
  it("every action refuses when the kiosk is signed out", async () => {
    getCurrentUser.mockResolvedValue(null);
    for (const run of [
      () => toggleStaffAction("a1", true),
      () => customerCheckinAction(checkin()),
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
      () => verifyStaffPinAction("1234"),
    ]) {
      const res = await run();
      expect(res.ok).toBe(false);
    }
    expect(setStaffCheckin).not.toHaveBeenCalled();
    expect(completeSession).not.toHaveBeenCalled();
    expect(verifyKioskPin).not.toHaveBeenCalled();
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
  it("stores the form with its version/question snapshot, DOB and ID checker", async () => {
    checkInCustomer.mockResolvedValue({});
    const res = await customerCheckinAction(
      checkin({ medicalNotes: "Inhaler in bag", photoConsent: true }),
    );
    expect(res.ok).toBe(true);
    expect(checkInCustomer).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: "b1",
        flagged: false,
        formVersion: CURRENT_CONSENT_FORM.version,
        questions: CURRENT_CONSENT_FORM.questions,
        printedName: "Megan Wray",
        dob: new Date(Date.UTC(1990, 0, 15)),
        medicalNotes: "Inhaler in bag",
        photoConsent: true,
        idCheckedByArtistId: "a1",
      }),
    );
  });

  it("derives the flag from the answers server-side", async () => {
    checkInCustomer.mockResolvedValue({});
    const res = await customerCheckinAction(
      checkin({ answers: { ...CLEAN, age: false } }),
    );
    expect(res.ok).toBe(true);
    expect(checkInCustomer).toHaveBeenCalledWith(
      expect.objectContaining({ bookingId: "b1", flagged: true }),
    );
  });

  it("flags an under-18 date of birth even with clean answers", async () => {
    checkInCustomer.mockResolvedValue({});
    const dob = new Date();
    dob.setFullYear(dob.getFullYear() - 16);
    const iso = dob.toISOString().slice(0, 10);
    await customerCheckinAction(checkin({ dob: iso }));
    expect(checkInCustomer).toHaveBeenCalledWith(
      expect.objectContaining({ flagged: true }),
    );
  });

  it("stores only the current form's questions (drops unknown keys)", async () => {
    checkInCustomer.mockResolvedValue({});
    await customerCheckinAction(
      checkin({ answers: { ...CLEAN, injected: true } }),
    );
    const stored = checkInCustomer.mock.calls[0][0] as {
      answers: Record<string, boolean>;
    };
    expect(Object.keys(stored.answers).sort()).toEqual(
      CURRENT_CONSENT_FORM.questions.map((q) => q.id).sort(),
    );
  });

  it("refuses a partly answered form", async () => {
    const res = await customerCheckinAction(
      checkin({ answers: { age: true } }),
    );
    expect(res).toEqual({
      ok: false,
      error: "Please answer every question on the form",
    });
    expect(checkInCustomer).not.toHaveBeenCalled();
  });

  it("refuses a missing name, impossible DOB or no ID checker", async () => {
    for (const bad of [
      { printedName: "  " },
      { dob: "2008-02-30" },
      { dob: "2999-01-01" },
      { idCheckedByArtistId: "" },
    ]) {
      expect((await customerCheckinAction(checkin(bad))).ok).toBe(false);
    }
    expect(checkInCustomer).not.toHaveBeenCalled();
  });

  it("rejects a non-image signature payload", async () => {
    const res = await customerCheckinAction(
      checkin({ signature: "javascript:alert(1)" }),
    );
    expect(res.ok).toBe(false);
    expect(checkInCustomer).not.toHaveBeenCalled();
  });

  it("surfaces a friendly message for double check-in", async () => {
    const { ReceptionCheckinError } =
      await import("@bnb/core/services/reception");
    checkInCustomer.mockRejectedValue(
      new ReceptionCheckinError("This booking has already been checked in"),
    );
    const res = await customerCheckinAction(checkin());
    expect(res).toEqual({
      ok: false,
      error: "This booking has already been checked in",
    });
  });
});

describe("verifyStaffPinAction", () => {
  it("unlocks on the right PIN", async () => {
    verifyKioskPin.mockResolvedValue(true);
    expect(await verifyStaffPinAction("4821")).toEqual({ ok: true });
    expect(verifyKioskPin).toHaveBeenCalledWith("4821");
  });

  it("refuses a wrong PIN with a friendly message", async () => {
    verifyKioskPin.mockResolvedValue(false);
    kioskPinConfigured.mockResolvedValue(true);
    expect(await verifyStaffPinAction("0000")).toEqual({
      ok: false,
      error: "That PIN isn't right — try again",
    });
  });

  it("locks out after five wrong tries, without checking the hash", async () => {
    verifyKioskPin.mockResolvedValue(false);
    kioskPinConfigured.mockResolvedValue(true);
    for (let i = 0; i < 5; i++) await verifyStaffPinAction("0000");
    verifyKioskPin.mockClear();
    const res = await verifyStaffPinAction("4821");
    expect(res.ok).toBe(false);
    expect(res.ok === false && res.error).toMatch(/Too many tries/);
    expect(verifyKioskPin).not.toHaveBeenCalled();
  });

  it("says so when no PIN has been set", async () => {
    verifyKioskPin.mockResolvedValue(false);
    kioskPinConfigured.mockResolvedValue(false);
    expect(await verifyStaffPinAction("1234")).toEqual({
      ok: false,
      error: "No staff PIN is set for this kiosk",
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

  it("refuses a missing/flagged consent form unless staff acknowledged it", async () => {
    consentNeedsAck.mockResolvedValue(true);
    const res = await checkoutAction("b1", 15000);
    expect(res).toEqual({
      ok: false,
      error: "Check the consent form warning before completing the session",
    });
    expect(completeSession).not.toHaveBeenCalled();

    completeSession.mockResolvedValue({ session: {}, loyalty: null });
    const acked = await checkoutAction("b1", 15000, true);
    expect(acked.ok).toBe(true);
    expect(completeSession).toHaveBeenCalledOnce();
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
