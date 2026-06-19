import { afterAll, describe, expect, it } from "vitest";
import { reportOverview } from "./reports";
import { closeTestDb, dbReachable, testDb, uid } from "./testdb";

const db = () => testDb();

describe("reports.reportOverview (DB fixture)", () => {
  const cleanup = {
    customers: [] as string[],
    bookings: [] as string[],
    sessions: [] as string[],
    artists: [] as string[],
    chairs: [] as string[],
  };

  afterAll(async () => {
    if (cleanup.sessions.length)
      await db().session.deleteMany({ where: { id: { in: cleanup.sessions } } });
    if (cleanup.bookings.length)
      await db().booking.deleteMany({ where: { id: { in: cleanup.bookings } } });
    if (cleanup.customers.length)
      await db().customer.deleteMany({
        where: { id: { in: cleanup.customers } },
      });
    if (cleanup.artists.length)
      await db().artist.deleteMany({ where: { id: { in: cleanup.artists } } });
    if (cleanup.chairs.length)
      await db().chair.deleteMany({ where: { id: { in: cleanup.chairs } } });
    await closeTestDb();
  });

  it("aggregates bookings count, revenue (pence) and utilisation per artist", async () => {
    if (!(await dbReachable())) return;

    const tag = uid();
    const artist = await db().artist.create({
      data: { slug: `rep-${tag}`, name: `Rep ${tag}`, role: "Resident" },
    });
    cleanup.artists.push(artist.id);
    const customer = await db().customer.create({
      data: { name: `Rep cust ${tag}` },
    });
    cleanup.customers.push(customer.id);

    const from = new Date("2099-10-01T00:00:00Z");
    const to = new Date("2099-10-31T23:59:59Z");

    // Two completed sessions (revenue 18000 + 22000 = 40000 pence) + 1 confirmed.
    const b1 = await db().booking.create({
      data: {
        customerId: customer.id,
        artistId: artist.id,
        type: "session",
        start: new Date("2099-10-05T10:00:00Z"),
        end: new Date("2099-10-05T12:00:00Z"),
        durationMin: 120,
        status: "completed",
      },
    });
    const b2 = await db().booking.create({
      data: {
        customerId: customer.id,
        artistId: artist.id,
        type: "session",
        start: new Date("2099-10-06T10:00:00Z"),
        end: new Date("2099-10-06T13:00:00Z"),
        durationMin: 180,
        status: "completed",
      },
    });
    const b3 = await db().booking.create({
      data: {
        customerId: customer.id,
        artistId: artist.id,
        type: "session",
        start: new Date("2099-10-07T10:00:00Z"),
        end: new Date("2099-10-07T12:00:00Z"),
        durationMin: 120,
        status: "confirmed",
      },
    });
    cleanup.bookings.push(b1.id, b2.id, b3.id);

    const s1 = await db().session.create({
      data: { bookingId: b1.id, amountChargedPence: 18000, tipPence: 1000 },
    });
    const s2 = await db().session.create({
      data: { bookingId: b2.id, amountChargedPence: 22000 },
    });
    cleanup.sessions.push(s1.id, s2.id);

    const report = await reportOverview({ from, to, artistId: artist.id });

    expect(report.totals.bookings).toBe(3);
    expect(report.totals.completed).toBe(2);
    // Revenue = amountCharged + tip across completed sessions in range.
    expect(report.totals.revenuePence).toBe(18000 + 1000 + 22000);

    const row = report.perArtist.find((r) => r.artistId === artist.id)!;
    expect(row.bookings).toBe(3);
    expect(row.revenuePence).toBe(41000);
    // Booked minutes 120+180+120 = 420; capacity > 0; utilisation in [0,100].
    expect(row.bookedMinutes).toBe(420);
    expect(row.utilisationPct).toBeGreaterThanOrEqual(0);
    expect(row.utilisationPct).toBeLessThanOrEqual(100);
  });
});
