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

vi.mock("@bnb/core/email", () => ({ sendEmail }));

// Import AFTER the mock so the service picks up the mocked sendEmail.
const { completeSession, SessionCompletionError } = await import("./sessions");

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
      await db().session.deleteMany({
        where: { id: { in: cleanup.sessions } },
      });
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

  async function makeBooking(
    opts: {
      email?: string | null;
      status?: "confirmed" | "cancelled" | "no_show";
      loyaltyStamps?: number;
      marketingConsent?: boolean;
    } = {},
  ) {
    const artist = await db().artist.findFirstOrThrow();
    const customer = await db().customer.create({
      data: {
        name: `Session ${uid()}`,
        email:
          opts.email === undefined ? `${uid("sess")}@example.com` : opts.email,
        loyaltyStamps: opts.loyaltyStamps ?? 0,
        marketingConsent: opts.marketingConsent ?? false,
      },
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
        status: opts.status ?? "confirmed",
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

  it("passes the props the receipt template consumes (regression: £0.00 bug)", async () => {
    if (!(await dbReachable())) return;
    const { customer, booking } = await makeBooking();

    const result = await completeSession({
      bookingId: booking.id,
      amountChargedPence: 18000,
      tipPence: 2000,
      bankRef: "TXN-456",
    });
    cleanup.sessions.push(result.session.id);
    const logs = await db().messageLog.findMany({
      where: { relatedBookingId: booking.id },
    });
    cleanup.messages.push(...logs.map((l) => l.id));

    const receipt = sendEmail.mock.calls.find(
      (c) => c[0].type === "receipt",
    )![0];
    expect(receipt.to).toBe(customer.email);
    // Template consumes { customerName, amountPence, bankRef, lineItems } —
    // NOT the old { amountChargedPence, tipPence, completedAt } shape.
    expect(receipt.data.customerName).toBe(customer.name);
    expect(receipt.data.amountPence).toBe(18000);
    expect(receipt.data.bankRef).toBe("TXN-456");
    expect(receipt.data.lineItems).toEqual([
      { label: "Tip", amountPence: 2000 },
    ]);

    // Rendered output contains the formatted amount + customer name.
    const { renderEmail } = await import("../email/render");
    const { html } = await renderEmail("receipt", receipt.data);
    expect(html).toContain("£180.00");
    expect(html).toContain(customer.name);
    expect(html).toContain("£20.00");
  });

  it("skips sending emails when the customer has no email address", async () => {
    if (!(await dbReachable())) return;
    const { customer, booking } = await makeBooking({ email: null });

    const result = await completeSession({
      bookingId: booking.id,
      amountChargedPence: 9000,
    });
    cleanup.sessions.push(result.session.id);

    expect(sendEmail).not.toHaveBeenCalled();
    expect(result.session.receiptSentAt).toBeNull();
    expect(result.session.aftercareSentAt).toBeNull();

    // The rest of the flow still runs: booking completed + stamp awarded.
    const refreshed = await db().booking.findUniqueOrThrow({
      where: { id: booking.id },
    });
    expect(refreshed.status).toBe("completed");
    const c = await db().customer.findUniqueOrThrow({
      where: { id: customer.id },
    });
    expect(c.loyaltyStamps).toBe(1);
  });

  it("rejects completing a cancelled booking with SessionCompletionError", async () => {
    if (!(await dbReachable())) return;
    const { booking } = await makeBooking({ status: "cancelled" });
    await expect(
      completeSession({ bookingId: booking.id, amountChargedPence: 5000 }),
    ).rejects.toBeInstanceOf(SessionCompletionError);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("rejects completing a no_show booking with SessionCompletionError", async () => {
    if (!(await dbReachable())) return;
    const { booking } = await makeBooking({ status: "no_show" });
    await expect(
      completeSession({ bookingId: booking.id, amountChargedPence: 5000 }),
    ).rejects.toBeInstanceOf(SessionCompletionError);
  });

  it("maps the double-complete race (P2002) to SessionCompletionError (→ 409)", async () => {
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

    // The booking is now `completed` (not cancelled/no_show), so the second
    // attempt reaches the unique Session.bookingId constraint — the race path.
    await expect(
      completeSession({ bookingId: booking.id, amountChargedPence: 5000 }),
    ).rejects.toBeInstanceOf(SessionCompletionError);
  });

  it("emails newly unlocked perks to marketing-consented customers", async () => {
    if (!(await dbReachable())) return;
    const config = await db().loyaltyConfig.findFirst({
      where: { active: true },
      orderBy: { createdAt: "asc" },
    });
    const perks = Array.isArray(config?.perks)
      ? (config.perks as { stamps?: number; title?: string }[])
      : [];
    const firstPerk = perks.find((p) => typeof p.stamps === "number");
    if (!firstPerk) {
      console.warn("[sessions] no seeded loyalty perks — skipping");
      return;
    }

    // One stamp short of the first perk threshold → completing unlocks it.
    const { customer, booking } = await makeBooking({
      loyaltyStamps: firstPerk.stamps! - 1,
      marketingConsent: true,
    });

    const result = await completeSession({
      bookingId: booking.id,
      amountChargedPence: 12000,
    });
    cleanup.sessions.push(result.session.id);
    const logs = await db().messageLog.findMany({
      where: { relatedBookingId: booking.id },
    });
    cleanup.messages.push(...logs.map((l) => l.id));

    expect(result.loyalty?.unlockedPerks.length).toBeGreaterThan(0);
    const reward = sendEmail.mock.calls.find(
      (c) => c[0].type === "loyalty_reward",
    );
    expect(reward).toBeTruthy();
    expect(reward![0].to).toBe(customer.email);
    expect(reward![0].data.customerName).toBe(customer.name);
    expect(String(reward![0].data.rewardLabel)).toContain(firstPerk.title);
    expect(reward![0].data.stamps).toBe(firstPerk.stamps);
  });

  it("does NOT email perks without marketing consent", async () => {
    if (!(await dbReachable())) return;
    const config = await db().loyaltyConfig.findFirst({
      where: { active: true },
      orderBy: { createdAt: "asc" },
    });
    const perks = Array.isArray(config?.perks)
      ? (config.perks as { stamps?: number }[])
      : [];
    const firstPerk = perks.find((p) => typeof p.stamps === "number");
    if (!firstPerk) return;

    const { booking } = await makeBooking({
      loyaltyStamps: firstPerk.stamps! - 1,
      marketingConsent: false,
    });

    const result = await completeSession({
      bookingId: booking.id,
      amountChargedPence: 12000,
    });
    cleanup.sessions.push(result.session.id);
    const logs = await db().messageLog.findMany({
      where: { relatedBookingId: booking.id },
    });
    cleanup.messages.push(...logs.map((l) => l.id));

    expect(result.loyalty?.unlockedPerks.length).toBeGreaterThan(0);
    const types = sendEmail.mock.calls.map((c) => c[0].type);
    expect(types).not.toContain("loyalty_reward");
  });
});
