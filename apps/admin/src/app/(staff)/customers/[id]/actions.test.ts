import { beforeEach, describe, expect, it, vi } from "vitest";
import { validateManualEmail, validateNotes } from "./action-helpers";

/**
 * Customer-detail actions. The pure validators live in action-helpers;
 * sendManualEmail's send/log behaviour is unit-tested here with the server
 * modules mocked (auth, prisma, email service).
 */

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@bnb/core/auth", () => ({ requireRole: vi.fn() }));
vi.mock("@bnb/core/db", () => ({
  prisma: {
    customer: {
      findUniqueOrThrow: vi.fn(),
      findFirstOrThrow: vi.fn(),
      update: vi.fn(),
    },
    messageLog: { create: vi.fn() },
  },
}));
vi.mock("@bnb/core/email", () => ({ sendEmail: vi.fn() }));

const { requireRole } = await import("@bnb/core/auth");
const { prisma } = await import("@bnb/core/db");
const { sendEmail } = await import("@bnb/core/email");
const { sendManualEmail } = await import("./actions");

const OWNER = {
  id: "u1",
  email: "o@x",
  role: "OWNER" as const,
  displayName: "Owner",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireRole).mockResolvedValue(OWNER);
  vi.mocked(prisma.customer.findUniqueOrThrow).mockResolvedValue({
    email: "amy@example.com",
    name: "Amy",
  } as never);
  vi.mocked(sendEmail).mockResolvedValue({ id: "m1", status: "sent" });
});

describe("sendManualEmail", () => {
  it("sends via sendEmail (staff_reply) with the subject + body", async () => {
    const res = await sendManualEmail("c1", {
      subject: "Your consult",
      body: "See you Friday!",
    });

    expect(res.ok).toBe(true);
    expect(sendEmail).toHaveBeenCalledWith({
      to: "amy@example.com",
      type: "staff_reply",
      customerId: "c1",
      data: {
        customerName: "Amy",
        subject: "Your consult",
        body: "See you Friday!",
      },
    });
    // sendEmail writes the MessageLog itself — no double-logging here.
    expect(prisma.messageLog.create).not.toHaveBeenCalled();
  });

  it("reports log-only delivery when email sending is not configured", async () => {
    vi.mocked(sendEmail).mockResolvedValue({ id: "m1", status: "skipped" });
    const res = await sendManualEmail("c1", { subject: "S", body: "B" });
    expect(res.ok).toBe(true);
    expect(res.message).toMatch(/logged/i);
  });

  it("errors when the customer has no email on file", async () => {
    vi.mocked(prisma.customer.findUniqueOrThrow).mockResolvedValue({
      email: null,
      name: "Amy",
    } as never);
    const res = await sendManualEmail("c1", { subject: "S", body: "B" });
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/no email/i);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("surfaces a failed send", async () => {
    vi.mocked(sendEmail).mockResolvedValue({ id: "m1", status: "failed" });
    const res = await sendManualEmail("c1", { subject: "S", body: "B" });
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/failed/i);
  });

  it("scopes non-owners to customers they share a booking with (RBAC)", async () => {
    vi.mocked(requireRole).mockResolvedValue({
      id: "u2",
      email: "a@x",
      role: "ARTIST",
      displayName: "Artist",
      artistId: "art1",
    } as never);
    vi.mocked(prisma.customer.findFirstOrThrow).mockResolvedValue({
      email: "amy@example.com",
      name: "Amy",
    } as never);

    const res = await sendManualEmail("c1", { subject: "S", body: "B" });

    expect(res.ok).toBe(true);
    expect(prisma.customer.findFirstOrThrow).toHaveBeenCalledWith({
      where: {
        id: "c1",
        bookings: { some: { artistId: "art1" } },
      },
      select: { email: true, name: true },
    });
  });
});

describe("customer actions input contracts", () => {
  it("rejects an empty manual email", () => {
    expect(validateManualEmail({ subject: "", body: "" }).ok).toBe(false);
  });

  it("normalises a notes patch", () => {
    expect(validateNotes({ notes: " x ", marketingConsent: true })).toEqual({
      notes: "x",
      marketingConsent: true,
    });
  });
});
