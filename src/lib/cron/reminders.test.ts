import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Unit tests for the reminders cron job. prisma + sendEmail are mocked so the
 * job runs without a DB. The job is idempotent: a confirmed booking that
 * already has a `reminder` MessageLog must NOT be re-emailed.
 */

const bookingFindMany = vi.fn();
const messageCount = vi.fn();
const sendEmail = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    booking: { findMany: (...a: unknown[]) => bookingFindMany(...a) },
    messageLog: { count: (...a: unknown[]) => messageCount(...a) },
  },
}));
vi.mock("@/lib/email", () => ({ sendEmail: (...a: unknown[]) => sendEmail(...a) }));

const { runReminders } = await import("./reminders");

function booking(id: string, hoursAhead: number) {
  const start = new Date(Date.now() + hoursAhead * 3600_000);
  return {
    id,
    customerId: `c-${id}`,
    artistId: "a1",
    start,
    end: new Date(start.getTime() + 3600_000),
    placement: "Arm",
    remindersOptIn: true,
    customer: { name: "Ada Lovelace", email: "ada@x.test" },
    artist: { name: "Marnie" },
  };
}

beforeEach(() => {
  bookingFindMany.mockReset();
  messageCount.mockReset();
  sendEmail.mockReset();
  sendEmail.mockResolvedValue({ id: "m1", status: "sent" });
});

describe("runReminders", () => {
  it("sends a reminder for a confirmed booking ~24h out with no prior reminder", async () => {
    bookingFindMany.mockResolvedValue([booking("b1", 24)]);
    messageCount.mockResolvedValue(0);
    const res = await runReminders();
    expect(sendEmail).toHaveBeenCalledOnce();
    const arg = sendEmail.mock.calls[0][0] as { type: string; to: string };
    expect(arg.type).toBe("reminder");
    expect(arg.to).toBe("ada@x.test");
    expect(res.sent).toBe(1);
  });

  it("is idempotent: skips a booking that already has a reminder in the window", async () => {
    bookingFindMany.mockResolvedValue([booking("b1", 24)]);
    messageCount.mockResolvedValue(1); // existing reminder
    const res = await runReminders();
    expect(sendEmail).not.toHaveBeenCalled();
    expect(res.sent).toBe(0);
    expect(res.skipped).toBe(1);
  });

  it("skips bookings with no customer email", async () => {
    const b = booking("b1", 24);
    b.customer.email = null as unknown as string;
    bookingFindMany.mockResolvedValue([b]);
    messageCount.mockResolvedValue(0);
    const res = await runReminders();
    expect(sendEmail).not.toHaveBeenCalled();
    expect(res.sent).toBe(0);
  });
});
