import { afterAll, afterEach, describe, expect, it } from "vitest";
import { CURRENT_CONSENT_FORM } from "@bnb/core/consent";
import {
  KIOSK_PIN_PATTERN,
  KioskPinError,
  ReceptionCheckinError,
  checkInCustomer,
  checkinDate,
  consentNeedsAck,
  createWalkInBooking,
  dayWindow,
  kioskPinConfigured,
  loadReceptionBoard,
  setKioskPin,
  setStaffCheckin,
  verifyKioskPin,
  type CheckInCustomerInput,
} from "./reception";
import { closeTestDb, dbReachable, testDb, uid } from "./testdb";

/** A complete v2 check-in payload; tests override what they care about. */
function checkin(
  bookingId: string,
  idCheckedByArtistId: string,
  over: Partial<CheckInCustomerInput> = {},
): CheckInCustomerInput {
  return {
    bookingId,
    answers: { age: true, sober: true, consent: true },
    flagged: false,
    signature: "data:image/png;base64,AAAA",
    formVersion: CURRENT_CONSENT_FORM.version,
    questions: CURRENT_CONSENT_FORM.questions,
    printedName: "Kiosk Customer",
    dob: new Date(Date.UTC(1990, 0, 15)),
    idCheckedByArtistId,
    ...over,
  };
}

describe("KIOSK_PIN_PATTERN", () => {
  it("accepts 4–6 digits only", () => {
    for (const ok of ["1234", "12345", "123456"]) {
      expect(KIOSK_PIN_PATTERN.test(ok)).toBe(true);
    }
    for (const bad of ["123", "1234567", "12a4", " 1234", ""]) {
      expect(KIOSK_PIN_PATTERN.test(bad)).toBe(false);
    }
  });
});

const db = () => testDb();

describe("dayWindow", () => {
  it("returns the local [midnight, midnight+24h) window", () => {
    const now = new Date(2026, 6, 7, 14, 30); // 7 Jul 2026 14:30 local
    const { from, to } = dayWindow(now);
    expect(from.getHours()).toBe(0);
    expect(from.getMinutes()).toBe(0);
    expect(from.getDate()).toBe(7);
    expect(to.getTime() - from.getTime()).toBe(24 * 3600 * 1000);
  });
});

describe("checkinDate", () => {
  it("pins the local calendar day at UTC midnight", () => {
    const now = new Date(2026, 6, 7, 23, 59);
    const d = checkinDate(now);
    expect(d.toISOString()).toBe("2026-07-07T00:00:00.000Z");
  });

  it("is stable across the same local day", () => {
    expect(checkinDate(new Date(2026, 6, 7, 0, 1)).getTime()).toBe(
      checkinDate(new Date(2026, 6, 7, 23, 59)).getTime(),
    );
  });
});

describe("reception service (DB)", () => {
  const customerIds: string[] = [];
  const bookingIds: string[] = [];
  const checkinArtistIds: string[] = [];

  afterEach(async () => {
    if (!(await dbReachable())) return;
    if (bookingIds.length) {
      // Consent forms are kept on booking delete (Restrict) — a licensing
      // record must never vanish with its booking — so clear them first.
      await db().consentForm.deleteMany({
        where: { bookingId: { in: bookingIds } },
      });
      await db().booking.deleteMany({ where: { id: { in: bookingIds } } });
      bookingIds.length = 0;
    }
    if (checkinArtistIds.length) {
      await db().staffCheckin.deleteMany({
        where: { artistId: { in: checkinArtistIds } },
      });
      checkinArtistIds.length = 0;
    }
  });

  afterAll(async () => {
    if (await dbReachable()) {
      if (customerIds.length)
        await db().customer.deleteMany({ where: { id: { in: customerIds } } });
    }
    await closeTestDb();
  });

  async function fixtureBooking(startOffsetMin = 60) {
    const artist = await db().artist.findFirstOrThrow({
      orderBy: { sortOrder: "asc" },
    });
    const customer = await db().customer.create({
      data: { name: `Kiosk ${uid()}` },
    });
    customerIds.push(customer.id);
    const start = new Date(Date.now() + startOffsetMin * 60_000);
    const end = new Date(start.getTime() + 60 * 60_000);
    const booking = await db().booking.create({
      data: {
        customerId: customer.id,
        artistId: artist.id,
        type: "session",
        start,
        end,
        durationMin: 60,
        status: "confirmed",
      },
    });
    bookingIds.push(booking.id);
    return { artist, customer, booking };
  }

  it("staff check-in toggles on/off for the same day", async () => {
    if (!(await dbReachable())) return;
    const artist = await db().artist.findFirstOrThrow();
    checkinArtistIds.push(artist.id);

    const on = await setStaffCheckin(artist.id, true);
    expect(on.checkedOutAt).toBeNull();

    const off = await setStaffCheckin(artist.id, false);
    expect(off.checkedOutAt).not.toBeNull();
    expect(off.id).toBe(on.id); // same day-row, not a duplicate

    const backOn = await setStaffCheckin(artist.id, true);
    expect(backOn.checkedOutAt).toBeNull();
  });

  it("customer check-in stores the consent form and stamps the booking", async () => {
    if (!(await dbReachable())) return;
    const { artist, booking, customer } = await fixtureBooking();

    const answers = { age: true, sober: true, consent: true };
    const result = await checkInCustomer(
      checkin(booking.id, artist.id, {
        answers,
        printedName: "Megan Wray",
        medicalNotes: "  Mild asthma, inhaler in bag  ",
        photoConsent: true,
      }),
    );

    expect(result.booking.checkedInAt).not.toBeNull();
    const form = result.consentForm;
    expect(form.flagged).toBe(false);
    expect(form.answers).toEqual(answers);
    // The snapshot: exactly what was shown, who signed, who checked ID.
    expect(form.formVersion).toBe(CURRENT_CONSENT_FORM.version);
    expect(form.questions).toEqual(
      CURRENT_CONSENT_FORM.questions.map((q) => ({ ...q })),
    );
    expect(form.printedName).toBe("Megan Wray");
    expect(form.dob?.toISOString().slice(0, 10)).toBe("1990-01-15");
    expect(form.medicalNotes).toBe("Mild asthma, inhaler in bag");
    expect(form.photoConsent).toBe(true);
    expect(form.idCheckedBy).toBe(artist.name);
    expect(form.idCheckedByArtistId).toBe(artist.id);
    expect(form.idCheckedAt).not.toBeNull();

    // A customer record with no DOB picks it up from the form.
    const updated = await db().customer.findUniqueOrThrow({
      where: { id: customer.id },
    });
    expect(updated.dob?.toISOString().slice(0, 10)).toBe("1990-01-15");

    // Second check-in on the same booking is a conflict.
    await expect(
      checkInCustomer(checkin(booking.id, artist.id)),
    ).rejects.toBeInstanceOf(ReceptionCheckinError);
  });

  it("writes nothing when the ID checker is unknown (one transaction)", async () => {
    if (!(await dbReachable())) return;
    const { booking } = await fixtureBooking();
    await expect(
      checkInCustomer(checkin(booking.id, "no-such-artist")),
    ).rejects.toThrow("Pick who checked the photo ID");
    const after = await db().booking.findUniqueOrThrow({
      where: { id: booking.id },
      include: { consentForm: true },
    });
    expect(after.checkedInAt).toBeNull();
    expect(after.consentForm).toBeNull();
  });

  it("a signed consent form blocks deleting its booking", async () => {
    if (!(await dbReachable())) return;
    const { artist, booking } = await fixtureBooking();
    await checkInCustomer(checkin(booking.id, artist.id));
    await expect(
      db().booking.delete({ where: { id: booking.id } }),
    ).rejects.toMatchObject({ code: "P2003" });
  });

  it("consentNeedsAck: missing or flagged forms need staff acknowledgement", async () => {
    if (!(await dbReachable())) return;
    const none = await fixtureBooking();
    expect(await consentNeedsAck(none.booking.id)).toBe(true);

    const clean = await fixtureBooking(200);
    await checkInCustomer(checkin(clean.booking.id, clean.artist.id));
    expect(await consentNeedsAck(clean.booking.id)).toBe(false);

    const flagged = await fixtureBooking(300);
    await checkInCustomer(
      checkin(flagged.booking.id, flagged.artist.id, { flagged: true }),
    );
    expect(await consentNeedsAck(flagged.booking.id)).toBe(true);

    expect(await consentNeedsAck("no-such-booking")).toBe(false);
  });

  it("rejects checking in a cancelled booking", async () => {
    if (!(await dbReachable())) return;
    const { artist, booking } = await fixtureBooking();
    await db().booking.update({
      where: { id: booking.id },
      data: { status: "cancelled" },
    });
    await expect(
      checkInCustomer(checkin(booking.id, artist.id, { answers: {} })),
    ).rejects.toBeInstanceOf(ReceptionCheckinError);
  });

  it("walk-in creates a customer and a confirmed booking for today", async () => {
    if (!(await dbReachable())) return;
    const artist = await db().artist.findFirstOrThrow({
      orderBy: { sortOrder: "desc" }, // different artist from other fixtures
    });
    const name = `Walk-in ${uid()}`;
    const start = new Date(Date.now() + 6 * 3600 * 1000);

    const booking = await createWalkInBooking({
      customerName: name,
      phone: `07${Date.now()}`,
      artistId: artist.id,
      start,
      durationMin: 90,
      type: "session",
    });
    bookingIds.push(booking.id);
    customerIds.push(booking.customerId);

    expect(booking.status).toBe("confirmed");
    expect(booking.durationMin).toBe(90);
    expect(booking.end.getTime() - booking.start.getTime()).toBe(90 * 60_000);
    const customer = await db().customer.findUnique({
      where: { id: booking.customerId },
    });
    expect(customer?.name).toBe(name);
  });

  it("loadReceptionBoard reports floor state, consent + completion", async () => {
    if (!(await dbReachable())) return;
    const { artist, booking, customer } = await fixtureBooking(120);
    checkinArtistIds.push(artist.id);
    await setStaffCheckin(artist.id, true);
    await checkInCustomer(
      checkin(booking.id, artist.id, {
        answers: { age: false },
        flagged: true,
      }),
    );

    const board = await loadReceptionBoard();

    const boardArtist = board.artists.find((a) => a.id === artist.id);
    expect(boardArtist?.checkedIn).toBe(true);

    const sess = board.sessions.find((s) => s.id === booking.id);
    expect(sess).toBeDefined();
    expect(sess?.customerName).toBe(customer.name);
    expect(sess?.checkedInAt).not.toBeNull();
    expect(sess?.consentFlagged).toBe(true);
    expect(sess?.idCheckedBy).toBe(artist.name);
    expect(sess?.completed).toBe(false);
    expect(sess?.amountChargedPence).toBeNull();
  });
});

describe("kiosk PIN (DB)", () => {
  let original: string | null = null;
  let settingsId: string | null = null;

  afterAll(async () => {
    if (settingsId) {
      await testDb().siteSettings.update({
        where: { id: settingsId },
        data: { kioskPinHash: original },
      });
    }
    await closeTestDb();
  });

  it("stores the PIN hashed, verifies it, and clears back to the hold gate", async () => {
    if (!(await dbReachable())) return;
    const settings = await testDb().siteSettings.findFirst({
      orderBy: { createdAt: "asc" },
    });
    if (!settings) return; // unseeded DB
    settingsId = settings.id;
    original = settings.kioskPinHash;

    await setKioskPin("4821");
    const stored = await testDb().siteSettings.findUniqueOrThrow({
      where: { id: settings.id },
    });
    expect(stored.kioskPinHash).not.toContain("4821");
    expect(stored.kioskPinHash).toMatch(/^scrypt\$/);
    expect(await kioskPinConfigured()).toBe(true);
    expect(await verifyKioskPin("4821")).toBe(true);
    expect(await verifyKioskPin("4822")).toBe(false);
    expect(await verifyKioskPin("48")).toBe(false);

    await setKioskPin(null);
    expect(await kioskPinConfigured()).toBe(false);
    expect(await verifyKioskPin("4821")).toBe(false);
  });

  it("refuses a malformed PIN before touching the database", async () => {
    await expect(setKioskPin("12")).rejects.toBeInstanceOf(KioskPinError);
    await expect(setKioskPin("abcd")).rejects.toBeInstanceOf(KioskPinError);
  });
});
