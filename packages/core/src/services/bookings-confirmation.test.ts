import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { closeTestDb, dbReachable, testDb, uid } from "./testdb";

const db = () => testDb();

// Mock the P5 email contract like sessions.test.ts: record calls AND write a
// MessageLog row (as the real sendEmail does) so the dedupe check sees it.
const sendEmail = vi.fn(
  async (input: {
    to: string;
    type: string;
    customerId?: string | null;
    relatedBookingId?: string | null;
    data: Record<string, unknown>;
  }) => {
    const log = await testDb().messageLog.create({
      data: {
        customerId: input.customerId ?? null,
        relatedBookingId: input.relatedBookingId ?? null,
        type: input.type as never,
        channel: "email",
        subject: `${input.type} email`,
        status: "sent",
        sentAt: new Date(),
      },
    });
    return { id: log.id, status: "sent" };
  },
);

vi.mock("@bnb/core/email", () => ({ sendEmail }));

// Import AFTER the mock so the service picks up the mocked sendEmail.
const { createBooking, updateBooking } = await import("./bookings");

describe("booking confirmation email (DB + mocked email)", () => {
  const cleanup = {
    bookings: [] as string[],
    customers: [] as string[],
    messages: [] as string[],
  };

  beforeEach(() => {
    sendEmail.mockClear();
  });

  afterAll(async () => {
    if (cleanup.messages.length)
      await db().messageLog.deleteMany({
        where: { id: { in: cleanup.messages } },
      });
    if (cleanup.bookings.length)
      await db().booking.deleteMany({
        where: { id: { in: cleanup.bookings } },
      });
    if (cleanup.customers.length)
      await db().customer.deleteMany({
        where: { id: { in: cleanup.customers } },
      });
    await closeTestDb();
  });

  let slotHour = 0;

  async function fixtures(email?: string | null) {
    const artist = await db().artist.findFirstOrThrow();
    const customer = await db().customer.create({
      data: {
        name: `Confirm ${uid()}`,
        email: email === undefined ? `${uid("conf")}@example.com` : email,
      },
    });
    cleanup.customers.push(customer.id);
    // Distinct, far-future windows so the conflict check never trips.
    const start = new Date(Date.UTC(2098, 0, 1 + slotHour, 10));
    const end = new Date(Date.UTC(2098, 0, 1 + slotHour, 12));
    slotHour += 1;
    return { artist, customer, start, end };
  }

  async function collectLogs(bookingId: string) {
    const logs = await db().messageLog.findMany({
      where: { relatedBookingId: bookingId },
    });
    cleanup.messages.push(...logs.map((l) => l.id));
    return logs;
  }

  it("sends the confirmation email when a booking is created already confirmed", async () => {
    if (!(await dbReachable())) return;
    const { artist, customer, start, end } = await fixtures();

    const booking = await createBooking({
      customerId: customer.id,
      artistId: artist.id,
      type: "session",
      placement: "Forearm",
      start,
      end,
      durationMin: 120,
      status: "confirmed",
    });
    cleanup.bookings.push(booking.id);
    await collectLogs(booking.id);

    expect(sendEmail).toHaveBeenCalledTimes(1);
    const call = sendEmail.mock.calls[0][0];
    expect(call.type).toBe("confirmation");
    expect(call.to).toBe(customer.email);
    expect(call.relatedBookingId).toBe(booking.id);
    // Props the template actually consumes.
    expect(call.data.customerName).toBe(customer.name);
    expect(call.data.artistName).toBe(artist.name);
    expect(call.data.placement).toBe("Forearm");
    expect(typeof call.data.date).toBe("string");
  });

  it("does not send for a pending booking, sends on the transition to confirmed", async () => {
    if (!(await dbReachable())) return;
    const { artist, customer, start, end } = await fixtures();

    const booking = await createBooking({
      customerId: customer.id,
      artistId: artist.id,
      type: "session",
      start,
      end,
      durationMin: 120,
    });
    cleanup.bookings.push(booking.id);
    expect(sendEmail).not.toHaveBeenCalled();

    await updateBooking(booking.id, { status: "confirmed" });
    await collectLogs(booking.id);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0][0].type).toBe("confirmation");
  });

  it("dedupes: a booking re-entering confirmed is not emailed twice", async () => {
    if (!(await dbReachable())) return;
    const { artist, customer, start, end } = await fixtures();

    const booking = await createBooking({
      customerId: customer.id,
      artistId: artist.id,
      type: "session",
      start,
      end,
      durationMin: 120,
      status: "confirmed",
    });
    cleanup.bookings.push(booking.id);
    expect(sendEmail).toHaveBeenCalledTimes(1);

    // Bounce out of and back into `confirmed` — the MessageLog dedupe holds.
    await updateBooking(booking.id, { status: "pending" });
    await updateBooking(booking.id, { status: "confirmed" });
    // Updating an already-confirmed booking is not a transition either.
    await updateBooking(booking.id, { notes: "brought reference" });
    await collectLogs(booking.id);

    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it("skips the confirmation when the customer has no email", async () => {
    if (!(await dbReachable())) return;
    const { artist, customer, start, end } = await fixtures(null);

    const booking = await createBooking({
      customerId: customer.id,
      artistId: artist.id,
      type: "session",
      start,
      end,
      durationMin: 120,
      status: "confirmed",
    });
    cleanup.bookings.push(booking.id);

    expect(sendEmail).not.toHaveBeenCalled();
  });
});
