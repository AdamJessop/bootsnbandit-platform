import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * resendReceipt (BACKOFHOUSE-IA G3), unit-tested with the server modules
 * mocked: re-sends the receipt with completeSession's exact data keys,
 * refreshes receiptSentAt, and enforces owner-or-self RBAC.
 */

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@bnb/core/auth", () => ({ requireRole: vi.fn() }));
vi.mock("@bnb/core/db", () => ({
  prisma: {
    session: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
  },
}));
vi.mock("@bnb/core/email", () => ({ sendEmail: vi.fn() }));

const { requireRole } = await import("@bnb/core/auth");
const { prisma } = await import("@bnb/core/db");
const { sendEmail } = await import("@bnb/core/email");
const { resendReceipt } = await import("./actions");

const OWNER = {
  id: "u1",
  email: "o@x",
  role: "OWNER" as const,
  displayName: "Owner",
};

const SESSION = {
  id: "s1",
  bookingId: "b1",
  amountChargedPence: 12500,
  tipPence: 1000,
  bankRef: "BNB-123",
  receiptSentAt: null,
  booking: {
    id: "b1",
    artistId: "art1",
    customerId: "c1",
    customer: { name: "Amy", email: "amy@example.com" },
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireRole).mockResolvedValue(OWNER);
  vi.mocked(prisma.session.findUniqueOrThrow).mockResolvedValue(
    SESSION as never,
  );
  vi.mocked(sendEmail).mockResolvedValue({ id: "m1", status: "sent" });
});

describe("resendReceipt", () => {
  it("re-sends the receipt with completeSession's data keys and updates receiptSentAt", async () => {
    const res = await resendReceipt("s1");

    expect(res.ok).toBe(true);
    expect(sendEmail).toHaveBeenCalledWith({
      to: "amy@example.com",
      type: "receipt",
      customerId: "c1",
      relatedBookingId: "b1",
      data: {
        customerName: "Amy",
        amountPence: 12500,
        bankRef: "BNB-123",
        lineItems: [{ label: "Tip", amountPence: 1000 }],
      },
    });
    expect(prisma.session.update).toHaveBeenCalledWith({
      where: { id: "s1" },
      data: { receiptSentAt: expect.any(Date) },
    });
  });

  it("lets an artist resend their own session's receipt", async () => {
    vi.mocked(requireRole).mockResolvedValue({
      id: "u2",
      email: "a@x",
      role: "ARTIST",
      displayName: "Artist",
      artistId: "art1",
    } as never);

    const res = await resendReceipt("s1");
    expect(res.ok).toBe(true);
    expect(sendEmail).toHaveBeenCalled();
  });

  it("forbids an artist from resending another artist's receipt (RBAC)", async () => {
    vi.mocked(requireRole).mockResolvedValue({
      id: "u2",
      email: "a@x",
      role: "ARTIST",
      displayName: "Artist",
      artistId: "someone_else",
    } as never);

    const res = await resendReceipt("s1");
    expect(res.ok).toBe(false);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(prisma.session.update).not.toHaveBeenCalled();
  });

  it("errors when the customer has no email", async () => {
    vi.mocked(prisma.session.findUniqueOrThrow).mockResolvedValue({
      ...SESSION,
      booking: {
        ...SESSION.booking,
        customer: { name: "Amy", email: null },
      },
    } as never);

    const res = await resendReceipt("s1");
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/no email/i);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("surfaces a failed send without touching receiptSentAt", async () => {
    vi.mocked(sendEmail).mockResolvedValue({ id: "m1", status: "failed" });
    const res = await resendReceipt("s1");
    expect(res.ok).toBe(false);
    expect(prisma.session.update).not.toHaveBeenCalled();
  });
});
