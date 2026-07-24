import { afterAll, afterEach, describe, expect, it } from "vitest";
import {
  ReceptionCheckinError,
  checkInCustomer,
  checkinDate,
  createWalkInBooking,
  dayWindow,
  loadReceptionBoard,
  setStaffCheckin,
} from "./reception";
import { closeTestDb, dbReachable, testDb, uid } from "./testdb";

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
      // ConsentForm/Session cascade with the booking.
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
    const { booking } = await fixtureBooking();

    const answers = { age: true, sober: true, consent: true };
    const result = await checkInCustomer({
      bookingId: booking.id,
      answers,
      flagged: false,
      signature: "data:image/png;base64,AAAA",
    });

    expect(result.booking.checkedInAt).not.toBeNull();
    expect(result.consentForm.flagged).toBe(false);
    expect(result.consentForm.answers).toEqual(answers);

    // Second check-in on the same booking is a conflict.
    await expect(
      checkInCustomer({
        bookingId: booking.id,
        answers,
        flagged: false,
        signature: "data:image/png;base64,AAAA",
      }),
    ).rejects.toBeInstanceOf(ReceptionCheckinError);
  });

  it("rejects checking in a cancelled booking", async () => {
    if (!(await dbReachable())) return;
    const { booking } = await fixtureBooking();
    await db().booking.update({
      where: { id: booking.id },
      data: { status: "cancelled" },
    });
    await expect(
      checkInCustomer({
        bookingId: booking.id,
        answers: {},
        flagged: false,
        signature: "data:image/png;base64,AAAA",
      }),
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
    await checkInCustomer({
      bookingId: booking.id,
      answers: { age: false },
      flagged: true,
      signature: "data:image/png;base64,AAAA",
    });

    const board = await loadReceptionBoard();

    const boardArtist = board.artists.find((a) => a.id === artist.id);
    expect(boardArtist?.checkedIn).toBe(true);

    const sess = board.sessions.find((s) => s.id === booking.id);
    expect(sess).toBeDefined();
    expect(sess?.customerName).toBe(customer.name);
    expect(sess?.checkedInAt).not.toBeNull();
    expect(sess?.consentFlagged).toBe(true);
    expect(sess?.completed).toBe(false);
    expect(sess?.amountChargedPence).toBeNull();
  });
});
