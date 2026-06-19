import { afterEach, afterAll, describe, expect, it } from "vitest";
import {
  BookingConflictError,
  checkConflict,
  createBooking,
  updateBooking,
} from "./bookings";
import { closeTestDb, dbReachable, testDb, uid } from "./testdb";

const db = () => testDb();

async function fixtures() {
  const artist = await db().artist.findFirstOrThrow();
  const customer = await db().customer.create({
    data: { name: `Booker ${uid()}` },
  });
  return { artist, customer };
}

describe("bookings conflict check (DB)", () => {
  const customerIds: string[] = [];
  const bookingIds: string[] = [];
  const leaveIds: string[] = [];

  afterEach(async () => {
    if (!(await dbReachable())) return;
    if (bookingIds.length)
      await db().booking.deleteMany({ where: { id: { in: bookingIds } } });
    if (leaveIds.length)
      await db().leave.deleteMany({ where: { id: { in: leaveIds } } });
    bookingIds.length = 0;
    leaveIds.length = 0;
  });

  afterAll(async () => {
    if (customerIds.length)
      await db().customer.deleteMany({ where: { id: { in: customerIds } } });
    await closeTestDb();
  });

  it("rejects a booking overlapping an existing booking for the same artist", async () => {
    if (!(await dbReachable())) return;
    const { artist, customer } = await fixtures();
    customerIds.push(customer.id);

    const start = new Date("2099-03-10T10:00:00Z");
    const end = new Date("2099-03-10T12:00:00Z");
    const first = await createBooking({
      customerId: customer.id,
      artistId: artist.id,
      type: "session",
      start,
      end,
      durationMin: 120,
    });
    bookingIds.push(first.id);

    // Overlapping window → must throw.
    await expect(
      createBooking({
        customerId: customer.id,
        artistId: artist.id,
        type: "session",
        start: new Date("2099-03-10T11:00:00Z"),
        end: new Date("2099-03-10T13:00:00Z"),
        durationMin: 120,
      }),
    ).rejects.toBeInstanceOf(BookingConflictError);
  });

  it("rejects a booking overlapping a Leave row for the artist", async () => {
    if (!(await dbReachable())) return;
    const { artist, customer } = await fixtures();
    customerIds.push(customer.id);

    const leave = await db().leave.create({
      data: {
        artistId: artist.id,
        startDate: new Date("2099-04-01T00:00:00Z"),
        endDate: new Date("2099-04-07T23:59:59Z"),
        status: "approved",
      },
    });
    leaveIds.push(leave.id);

    await expect(
      createBooking({
        customerId: customer.id,
        artistId: artist.id,
        type: "session",
        start: new Date("2099-04-03T10:00:00Z"),
        end: new Date("2099-04-03T12:00:00Z"),
        durationMin: 120,
      }),
    ).rejects.toBeInstanceOf(BookingConflictError);
  });

  it("allows a non-overlapping booking", async () => {
    if (!(await dbReachable())) return;
    const { artist, customer } = await fixtures();
    customerIds.push(customer.id);

    const b = await createBooking({
      customerId: customer.id,
      artistId: artist.id,
      type: "session",
      start: new Date("2099-05-10T10:00:00Z"),
      end: new Date("2099-05-10T12:00:00Z"),
      durationMin: 120,
    });
    bookingIds.push(b.id);
    expect(b.id).toBeTruthy();
  });

  it("checkConflict ignores cancelled/no_show bookings", async () => {
    if (!(await dbReachable())) return;
    const { artist, customer } = await fixtures();
    customerIds.push(customer.id);

    const cancelled = await db().booking.create({
      data: {
        customerId: customer.id,
        artistId: artist.id,
        type: "session",
        start: new Date("2099-06-10T10:00:00Z"),
        end: new Date("2099-06-10T12:00:00Z"),
        durationMin: 120,
        status: "cancelled",
      },
    });
    bookingIds.push(cancelled.id);

    const conflict = await checkConflict({
      artistId: artist.id,
      start: new Date("2099-06-10T10:30:00Z"),
      end: new Date("2099-06-10T11:30:00Z"),
    });
    expect(conflict).toBeNull();
  });

  it("updateBooking re-checks conflicts but excludes itself", async () => {
    if (!(await dbReachable())) return;
    const { artist, customer } = await fixtures();
    customerIds.push(customer.id);

    const b = await createBooking({
      customerId: customer.id,
      artistId: artist.id,
      type: "session",
      start: new Date("2099-07-10T10:00:00Z"),
      end: new Date("2099-07-10T12:00:00Z"),
      durationMin: 120,
    });
    bookingIds.push(b.id);

    // Moving the same booking within its own window must not self-conflict.
    const updated = await updateBooking(b.id, {
      start: new Date("2099-07-10T10:30:00Z"),
      end: new Date("2099-07-10T12:30:00Z"),
    });
    expect(updated.start.toISOString()).toContain("10:30");
  });
});
