import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildConvertInput, validateReply } from "./enquiry-helpers";

/**
 * Enquiry triage actions. The pure input contracts live in enquiry-helpers;
 * replyToEnquiry's send/log behaviour is unit-tested here with the server
 * modules mocked (auth, prisma, email service).
 */

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@bnb/core/auth", () => ({ requireRole: vi.fn() }));
vi.mock("@bnb/core/db", () => ({
  prisma: {
    enquiry: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
    messageLog: { create: vi.fn() },
  },
}));
vi.mock("@bnb/core/email", () => ({ sendEmail: vi.fn() }));
vi.mock("@bnb/core/services/enquiries", () => ({
  updateEnquiryStatus: vi.fn(),
}));
vi.mock("@bnb/core/services/bookings", () => ({
  BookingConflictError: class BookingConflictError extends Error {},
  createBooking: vi.fn(),
}));

const { requireRole } = await import("@bnb/core/auth");
const { prisma } = await import("@bnb/core/db");
const { sendEmail } = await import("@bnb/core/email");
const { updateEnquiryStatus } = await import("@bnb/core/services/enquiries");
const { replyToEnquiry } = await import("./actions");

const OWNER = {
  id: "u1",
  email: "o@x",
  role: "OWNER" as const,
  displayName: "Owner",
};

const ENQUIRY = {
  id: "e1",
  customerId: "c1",
  contactEmail: "amy@example.com",
  contactName: "Amy",
  preferredArtistId: "art1",
  style: "fine line",
  placement: "arm",
  source: "web" as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireRole).mockResolvedValue(OWNER);
  vi.mocked(prisma.enquiry.findUniqueOrThrow).mockResolvedValue(
    ENQUIRY as never,
  );
  vi.mocked(sendEmail).mockResolvedValue({ id: "m1", status: "sent" });
});

describe("replyToEnquiry", () => {
  it("emails the customer via sendEmail (staff_reply) and marks replied", async () => {
    const res = await replyToEnquiry("e1", { message: "Hi Amy, yes we can!" });

    expect(res.ok).toBe(true);
    expect(sendEmail).toHaveBeenCalledWith({
      to: "amy@example.com",
      type: "staff_reply",
      customerId: "c1",
      data: { customerName: "Amy", body: "Hi Amy, yes we can!" },
    });
    // sendEmail writes the MessageLog itself — no double-logging here.
    expect(prisma.messageLog.create).not.toHaveBeenCalled();
    expect(updateEnquiryStatus).toHaveBeenCalledWith("e1", "replied");
  });

  it("reports a log-only outcome when email delivery is not configured", async () => {
    vi.mocked(sendEmail).mockResolvedValue({ id: "m1", status: "skipped" });
    const res = await replyToEnquiry("e1", { message: "Hello" });
    expect(res.ok).toBe(true);
    expect(res.message).toMatch(/logged/i);
    expect(updateEnquiryStatus).toHaveBeenCalledWith("e1", "replied");
  });

  it("falls back to a log-only reply when the enquiry has no email", async () => {
    vi.mocked(prisma.enquiry.findUniqueOrThrow).mockResolvedValue({
      ...ENQUIRY,
      contactEmail: null,
    } as never);

    const res = await replyToEnquiry("e1", { message: "Hello" });

    expect(res.ok).toBe(true);
    expect(res.message).toMatch(/no email on file/i);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(prisma.messageLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        customerId: "c1",
        type: "staff_reply",
        status: "logged",
        body: "Hello",
      }),
    });
    expect(updateEnquiryStatus).toHaveBeenCalledWith("e1", "replied");
  });

  it("surfaces a failed send and does not mark the enquiry replied", async () => {
    vi.mocked(sendEmail).mockResolvedValue({ id: "m1", status: "failed" });
    const res = await replyToEnquiry("e1", { message: "Hello" });
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/failed/i);
    expect(updateEnquiryStatus).not.toHaveBeenCalled();
  });

  it("rejects an empty reply without sending", async () => {
    const res = await replyToEnquiry("e1", { message: "   " });
    expect(res.ok).toBe(false);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("still forbids artists from replying to another artist's enquiry (RBAC)", async () => {
    vi.mocked(requireRole).mockResolvedValue({
      id: "u2",
      email: "a@x",
      role: "ARTIST",
      displayName: "Artist",
      artistId: "someone_else",
    } as never);

    await expect(replyToEnquiry("e1", { message: "Hi" })).rejects.toThrow(
      /forbidden/i,
    );
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

describe("enquiry actions input contracts", () => {
  it("rejects an empty reply", () => {
    expect(validateReply({ message: "" }).ok).toBe(false);
  });

  it("builds a pending booking on convert", () => {
    const r = buildConvertInput({
      customerId: "c1",
      artistId: "a1",
      startISO: "2026-07-01T10:00:00Z",
      durationMin: 60,
      type: "consult",
    });
    expect(r.ok).toBe(true);
  });
});

describe("artist access + claiming", () => {
  const ARTIST = {
    id: "u2",
    email: "a@x",
    role: "ARTIST" as const,
    displayName: "Art",
    artistId: "art9",
  };

  it("forbids an artist replying to another artist's enquiry", async () => {
    vi.mocked(requireRole).mockResolvedValue(ARTIST);
    await expect(replyToEnquiry("e1", { message: "hi" })).rejects.toThrow(
      /Forbidden/,
    );
  });

  it("lets an artist reply to an open Inkling board and claims it", async () => {
    vi.mocked(requireRole).mockResolvedValue(ARTIST);
    vi.mocked(prisma.enquiry.findUniqueOrThrow).mockResolvedValue({
      ...ENQUIRY,
      source: "inkling",
      preferredArtistId: null,
    } as never);
    const res = await replyToEnquiry("e1", { message: "Love this — let's talk." });
    expect(res.ok).toBe(true);
    expect(prisma.enquiry.update).toHaveBeenCalledWith({
      where: { id: "e1" },
      data: { preferredArtistId: "art9" },
    });
  });

  it("claimEnquiry assigns an open board to the artist, refuses taken ones", async () => {
    const { claimEnquiry } = await import("./actions");
    vi.mocked(requireRole).mockResolvedValue(ARTIST);
    vi.mocked(prisma.enquiry.findUniqueOrThrow).mockResolvedValue({
      ...ENQUIRY,
      source: "inkling",
      preferredArtistId: null,
    } as never);
    expect((await claimEnquiry("e1")).ok).toBe(true);
    vi.mocked(prisma.enquiry.findUniqueOrThrow).mockResolvedValue({
      ...ENQUIRY,
      source: "inkling",
      preferredArtistId: "art1",
    } as never);
    await expect(claimEnquiry("e1")).rejects.toThrow(/Forbidden/);
  });
});
