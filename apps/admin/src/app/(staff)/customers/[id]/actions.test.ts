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
vi.mock("@bnb/core/services/identity-linking", () => ({
  linkIdentityToCustomer: vi.fn(),
  listLinkableIdentities: vi.fn(),
}));

const { requireRole } = await import("@bnb/core/auth");
const { prisma } = await import("@bnb/core/db");
const { sendEmail } = await import("@bnb/core/email");
const { linkIdentityToCustomer, listLinkableIdentities } = await import(
  "@bnb/core/services/identity-linking"
);
const {
  linkIdentityAction,
  loadLinkableIdentitiesAction,
  sendManualEmail,
} = await import("./actions");

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

describe("linkIdentityAction", () => {
  it("is owner-only", async () => {
    vi.mocked(requireRole).mockRejectedValue(new Error("Forbidden"));
    await expect(linkIdentityAction("c1", "i1")).rejects.toThrow(/forbidden/i);
    expect(linkIdentityToCustomer).not.toHaveBeenCalled();
    // requireRole("OWNER") is the guard — an artist must not be able to fold
    // one customer record into another.
    expect(requireRole).toHaveBeenCalledWith("OWNER");
  });

  it("reports what the merge moved", async () => {
    vi.mocked(requireRole).mockResolvedValue(OWNER as never);
    vi.mocked(linkIdentityToCustomer).mockResolvedValue({
      ok: true,
      merged: true,
      movedEnquiries: 2,
      movedMessages: 7,
    });
    const res = await linkIdentityAction("c1", "i1");
    expect(res.ok).toBe(true);
    expect(res.message).toBe(
      "Handle linked — 2 enquiries and 7 messages moved onto this customer.",
    );
  });

  it("passes a refusal straight through", async () => {
    vi.mocked(requireRole).mockResolvedValue(OWNER as never);
    vi.mocked(linkIdentityToCustomer).mockResolvedValue({
      ok: false,
      reason: "in_use",
      message: "That handle already belongs to a customer…",
    });
    const res = await linkIdentityAction("c1", "i1");
    expect(res).toEqual({
      ok: false,
      message: "That handle already belongs to a customer…",
    });
  });
});

describe("loadLinkableIdentitiesAction", () => {
  it("is owner-only", async () => {
    vi.mocked(requireRole).mockRejectedValue(new Error("Forbidden"));
    await expect(loadLinkableIdentitiesAction("c1")).rejects.toThrow(
      /forbidden/i,
    );
    // An artist must never be handed a list of other customers' handles —
    // and the list is only fetched at all once an owner asks for it.
    expect(requireRole).toHaveBeenCalledWith("OWNER");
    expect(listLinkableIdentities).not.toHaveBeenCalled();
  });

  it("excludes this customer's own handles and labels the rest", async () => {
    vi.mocked(requireRole).mockResolvedValue(OWNER as never);
    vi.mocked(listLinkableIdentities).mockResolvedValue([
      {
        id: "i1",
        channel: "instagram",
        displayName: "amy.ink",
        customerId: "stub1",
        customerName: "Instagram user",
        createdAt: new Date("2026-09-01T10:00:00.000Z"),
      },
      {
        id: "i2",
        channel: "messenger",
        displayName: null,
        customerId: "stub2",
        customerName: "Messenger user",
        createdAt: new Date("2026-09-02T10:00:00.000Z"),
      },
    ]);

    const options = await loadLinkableIdentitiesAction("c1");

    expect(listLinkableIdentities).toHaveBeenCalledWith({
      excludeCustomerId: "c1",
    });
    expect(options).toEqual([
      {
        id: "i1",
        channel: "instagram",
        label: "amy.ink · Instagram (from Instagram user)",
      },
      {
        id: "i2",
        channel: "messenger",
        label: "Unnamed · Messenger (from Messenger user)",
      },
    ]);
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
