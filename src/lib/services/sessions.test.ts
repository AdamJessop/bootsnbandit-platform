import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { closeTestDb, dbReachable, testDb, uid } from "./testdb";

const db = () => testDb();

// Mock the P5 email contract: record calls and write a MessageLog row (as the
// real sendEmail does) so we can assert the timeline side-effects.
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

vi.mock("@/lib/email", () => ({ sendEmail }));

// Import AFTER the mock so the service picks up the mocked sendEmail.
const { completeSession } = await import("./sessions");

describe("completeSession (DB + mocked email + loyalty)", () => {
  const cleanup = {
    sessions: [] as string[],
    bookings: [] as string[],
    customers: [] as string[],
    messages: [] as string[],
  };

  beforeEach(() => {
    sendEmail.mockClear();
  });

  afterAll(async () => {
    if (cleanup.sessions.length)
      await db().session.deleteMany({ where: { id: { in: cleanup.sessions } } });
    if (cleanup.messages.length)
      await db().messageLog.deleteMany({
        where: { id: { in: cleanup.messages } },
      });
    if (cleanup.bookings.length)
      await db().booking.deleteMany({ where: { id: { in: cleanup.bookings } } });
    if (cleanup.customers.length)
      await db().customer.deleteMany({
        where: { id: { in: cleanup.customers } },
      });
    await closeTestDb();
  });

  async function makeBooking() {
    const artist = await db().artist.findFirstOrThrow();
    const customer = await db().customer.create({
      data: { name: `Session ${uid()}`, loyaltyStamps: 0 },
    });
    cleanup.customers.push(customer.id);
    const booking = await db().booking.create({
      data: {
        customerId: customer.id,
        artistId: artist.id,
        type: "session",
        start: new Date("2099-08-01T10:00:00Z"),
        end: new Date("2099-08-01T12:00:00Z"),
        durationMin: 120,
        status: "confirmed",
      },
    });
    cleanup.bookings.push(booking.id);
    return { customer, booking };
  }

  it("creates a Session, completes the booking, sends 2 emails, awards a stamp", async () => {
    if (!(await dbReachable())) return;
    const { customer, booking } = await makeBooking();

    const result = await completeSession({
      bookingId: booking.id,
      amountChargedPence: 18000,
      tipPence: 2000,
      bankRef: "TXN-123",
    });
    cleanup.sessions.push(result.session.id);

    // Session row written with the confirmed amount (pence).
    expect(result.session.amountChargedPence).toBe(18000);
    expect(result.session.tipPence).toBe(2000);
    expect(result.session.reviewRequestAt).toBeInstanceOf(Date);

    // Booking marked completed.
    const refreshed = await db().booking.findUniqueOrThrow({
      where: { id: booking.id },
    });
    expect(refreshed.status).toBe("completed");

    // sendEmail called for receipt + aftercare.
    const types = sendEmail.mock.calls.map((c) => c[0].type).sort();
    expect(types).toEqual(["aftercare", "receipt"]);

    // Two MessageLog rows recorded against the booking.
    const logs = await db().messageLog.findMany({
      where: { relatedBookingId: booking.id },
    });
    cleanup.messages.push(...logs.map((l) => l.id));
    expect(logs.length).toBe(2);

    // Loyalty stamp awarded.
    const c = await db().customer.findUniqueOrThrow({
      where: { id: customer.id },
    });
    expect(c.loyaltyStamps).toBe(1);

    // receiptSentAt / aftercareSentAt stamped.
    expect(result.session.receiptSentAt).toBeInstanceOf(Date);
    expect(result.session.aftercareSentAt).toBeInstanceOf(Date);
  });

  it("is idempotent-safe: throws on a booking that already has a session", async () => {
    if (!(await dbReachable())) return;
    const { booking } = await makeBooking();
    const r1 = await completeSession({
      bookingId: booking.id,
      amountChargedPence: 5000,
    });
    cleanup.sessions.push(r1.session.id);
    const logs = await db().messageLog.findMany({
      where: { relatedBookingId: booking.id },
    });
    cleanup.messages.push(...logs.map((l) => l.id));

    await expect(
      completeSession({ bookingId: booking.id, amountChargedPence: 5000 }),
    ).rejects.toThrow();
  });
});
