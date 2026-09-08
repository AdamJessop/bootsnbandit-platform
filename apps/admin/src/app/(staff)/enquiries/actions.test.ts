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
    enquiry: {
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    messageLog: { create: vi.fn() },
  },
}));
vi.mock("@bnb/core/email", () => ({ sendEmail: vi.fn() }));
// The row → context mapper stays REAL: the action now maps the row it already
// read instead of issuing a second query, so mocking the mapper would mock the
// very thing under test.
vi.mock("@bnb/core/services/channels/email", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@bnb/core/services/channels/email")>();
  return {
    ...actual,
    loadEnquiryEmailContext: vi.fn(),
    sendEnquiryEmail: vi.fn(),
  };
});
// The Meta send path is mocked whole: its own suite in @bnb/core proves the
// Graph call, the window and the per-part recording.
vi.mock("@bnb/core/services/channels/meta-outbound", () => ({
  loadMetaReplyTarget: vi.fn(),
  sendEnquiryMetaMessage: vi.fn(),
  MetaSendError: class MetaSendError extends Error {},
}));
vi.mock("@bnb/core/services/enquiries", () => ({
  updateEnquiryStatus: vi.fn(),
}));
vi.mock("@bnb/core/services/bookings", () => ({
  BookingConflictError: class BookingConflictError extends Error {},
  createBooking: vi.fn(),
}));
vi.mock("@bnb/core/services/enquiry-messages", () => ({
  markRead: vi.fn(),
  recordNote: vi.fn(),
  recordOutbound: vi.fn(),
}));

const { requireRole } = await import("@bnb/core/auth");
const { prisma } = await import("@bnb/core/db");
const { sendEmail } = await import("@bnb/core/email");
const { loadEnquiryEmailContext, sendEnquiryEmail } = await import(
  "@bnb/core/services/channels/email"
);
const { loadMetaReplyTarget, sendEnquiryMetaMessage } = await import(
  "@bnb/core/services/channels/meta-outbound"
);
const { MetaWindowClosedError } = await import(
  "@bnb/core/services/channels/meta"
);

const META_TARGET = {
  connection: { id: "conn1", pageId: "102938475610293", accessToken: "x" },
  channel: "messenger" as const,
  recipientId: "7213456789012345",
};

const CONTEXT = {
  enquiryId: "e1",
  threadToken: "tok123456",
  customerId: "c1",
  contactName: "Amy",
  contactEmail: "amy@example.com",
  subject: "Sleeve idea",
  artistName: "Sarah North",
  lastInboundChannel: "email" as const,
  lastInboundMessageId: "<abc@x.test>",
  lastInboundSubject: "Re: Sleeve idea",
  lastInboundFromAddress: "amy@example.com",
  lastInboundConnectionId: null,
  lastInboundAt: null,
};
const { updateEnquiryStatus } = await import("@bnb/core/services/enquiries");
const { markRead, recordNote, recordOutbound } = await import(
  "@bnb/core/services/enquiry-messages"
);
const { replyToEnquiry } = await import("./actions");

const OWNER = {
  id: "u1",
  email: "o@x",
  role: "OWNER" as const,
  displayName: "Owner",
};

/**
 * One read now serves both the RBAC scope check and the email context, so the
 * stub carries ENQUIRY_EMAIL_CONTEXT_SELECT's fields too — mapping this row
 * through `toEnquiryEmailContext` produces exactly CONTEXT.
 */
const ENQUIRY = {
  id: "e1",
  customerId: "c1",
  contactEmail: "amy@example.com",
  contactName: "Amy",
  threadToken: "tok123456",
  subject: "Sleeve idea",
  lastInboundAt: null,
  preferredArtist: { name: "Sarah North" },
  customer: { email: "amy@example.com" },
  messages: [
    {
      channel: "email" as const,
      subject: "Re: Sleeve idea",
      messageIdHeader: "<abc@x.test>",
      fromAddress: "amy@example.com",
      connectionId: null,
    },
  ],
  preferredArtistId: "art1",
  style: "fine line",
  placement: "arm",
  source: "web" as const,
  status: "new" as const,
};

/** The same enquiry with nothing to reach the customer on. */
const UNREACHABLE = {
  ...ENQUIRY,
  contactEmail: null,
  customer: null,
  messages: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireRole).mockResolvedValue(OWNER);
  vi.mocked(prisma.enquiry.findUniqueOrThrow).mockResolvedValue(
    ENQUIRY as never,
  );
  vi.mocked(prisma.enquiry.updateMany).mockResolvedValue({ count: 1 } as never);
  vi.mocked(sendEmail).mockResolvedValue({ id: "m1", status: "sent" });
  vi.mocked(sendEnquiryEmail).mockResolvedValue({ id: "m1", status: "sent" });
  // No Meta route by default — every email test below is an email thread.
  vi.mocked(loadMetaReplyTarget).mockResolvedValue(null);
});

describe("replyToEnquiry", () => {
  it("sends via sendEnquiryEmail with the enquiry's context and marks replied", async () => {
    const res = await replyToEnquiry("e1", { message: "Hi Amy, yes we can!" });
    expect(res.ok).toBe(true);
    expect(sendEnquiryEmail).toHaveBeenCalledWith({
      context: CONTEXT,
      body: "Hi Amy, yes we can!",
      authorUserId: "u1",
      authorDisplayName: "Owner",
    });
    // sendEmail writes the MessageLog itself — no double-logging here.
    expect(prisma.messageLog.create).not.toHaveBeenCalled();
    expect(updateEnquiryStatus).toHaveBeenCalledWith("e1", "replied");
  });

  it("reports a log-only outcome when email delivery is not configured", async () => {
    vi.mocked(sendEnquiryEmail).mockResolvedValue({
      id: "m1",
      status: "skipped",
    });
    const res = await replyToEnquiry("e1", { message: "Hello" });
    expect(res.ok).toBe(true);
    expect(res.message).toMatch(/logged/i);
    expect(updateEnquiryStatus).toHaveBeenCalledWith("e1", "replied");
  });

  it("saves an internal note when the customer has no reachable channel", async () => {
    vi.mocked(prisma.enquiry.findUniqueOrThrow).mockResolvedValue(
      UNREACHABLE as never,
    );
    const res = await replyToEnquiry("e1", { message: "Hello" });
    expect(res.ok).toBe(true);
    expect(res.message).toMatch(/no reachable channel/i);
    expect(sendEnquiryEmail).not.toHaveBeenCalled();
    expect(prisma.messageLog.create).not.toHaveBeenCalled();
    expect(recordNote).toHaveBeenCalledWith({
      enquiryId: "e1",
      authorUserId: "u1",
      bodyText: expect.stringContaining("Hello"),
    });
    expect(recordNote).toHaveBeenCalledWith({
      enquiryId: "e1",
      authorUserId: "u1",
      bodyText: expect.stringContaining("Not sent"),
    });
    // Nothing was sent, so the enquiry is not "replied".
    expect(updateEnquiryStatus).not.toHaveBeenCalled();
  });

  it("surfaces a failed send and does not mark the enquiry replied", async () => {
    vi.mocked(sendEnquiryEmail).mockResolvedValue({
      id: "m1",
      status: "failed",
    });
    const res = await replyToEnquiry("e1", { message: "Hello" });
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/failed/i);
    expect(updateEnquiryStatus).not.toHaveBeenCalled();
  });

  it("rejects an empty reply without loading or sending anything", async () => {
    const res = await replyToEnquiry("e1", { message: "   " });
    expect(res.ok).toBe(false);
    expect(sendEnquiryEmail).not.toHaveBeenCalled();
  });

  it("reads the enquiry exactly once when replying", async () => {
    const res = await replyToEnquiry("e1", { message: "Hello" });

    expect(res.ok).toBe(true);
    expect(prisma.enquiry.findUniqueOrThrow).toHaveBeenCalledTimes(1);
    expect(loadEnquiryEmailContext).not.toHaveBeenCalled();
    expect(vi.mocked(sendEnquiryEmail).mock.calls[0][0].context).toMatchObject({
      enquiryId: "e1",
      threadToken: "tok123456",
      contactEmail: "amy@example.com",
    });
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
    expect(sendEnquiryEmail).not.toHaveBeenCalled();
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

describe("artist access + claiming (any unassigned enquiry)", () => {
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

  it("lets an artist reply to an unassigned enquiry and claims it", async () => {
    vi.mocked(requireRole).mockResolvedValue(ARTIST);
    vi.mocked(prisma.enquiry.findUniqueOrThrow).mockResolvedValue({
      ...ENQUIRY,
      preferredArtistId: null,
    } as never);
    const res = await replyToEnquiry("e1", {
      message: "Love this — let's talk.",
    });
    expect(res.ok).toBe(true);
    expect(prisma.enquiry.updateMany).toHaveBeenCalledWith({
      where: { id: "e1", preferredArtistId: null },
      data: { preferredArtistId: "art9", assignedAt: expect.any(Date) },
    });
  });

  it("still sends the reply but does not claim the enquiry when another artist won the race", async () => {
    vi.mocked(requireRole).mockResolvedValue(ARTIST);
    vi.mocked(prisma.enquiry.findUniqueOrThrow).mockResolvedValue({
      ...ENQUIRY,
      preferredArtistId: null,
    } as never);
    vi.mocked(prisma.enquiry.updateMany).mockResolvedValue({
      count: 0,
    } as never);
    const res = await replyToEnquiry("e1", { message: "Love this!" });
    expect(res.ok).toBe(true);
    expect(res.message).toMatch(/taken by another artist/i);
  });

  it("claimEnquiry assigns an unassigned enquiry to the artist, refuses taken ones", async () => {
    const { claimEnquiry } = await import("./actions");
    vi.mocked(requireRole).mockResolvedValue(ARTIST);
    vi.mocked(prisma.enquiry.findUniqueOrThrow).mockResolvedValue({
      ...ENQUIRY,
      preferredArtistId: null,
    } as never);
    expect((await claimEnquiry("e1")).ok).toBe(true);
    expect(prisma.enquiry.updateMany).toHaveBeenCalledWith({
      where: { id: "e1", preferredArtistId: null },
      data: { preferredArtistId: "art9", assignedAt: expect.any(Date) },
    });
    vi.mocked(prisma.enquiry.findUniqueOrThrow).mockResolvedValue({
      ...ENQUIRY,
      preferredArtistId: "art1",
    } as never);
    await expect(claimEnquiry("e1")).rejects.toThrow(/Forbidden/);
  });

  it("claimEnquiry refuses when another artist wins the race (updateMany matches 0 rows)", async () => {
    const { claimEnquiry } = await import("./actions");
    vi.mocked(requireRole).mockResolvedValue(ARTIST);
    vi.mocked(prisma.enquiry.findUniqueOrThrow).mockResolvedValue({
      ...ENQUIRY,
      preferredArtistId: null,
    } as never);
    vi.mocked(prisma.enquiry.updateMany).mockResolvedValue({
      count: 0,
    } as never);
    const res = await claimEnquiry("e1");
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/already been taken/i);
  });
});

describe("assignEnquiry authorisation", () => {
  const ARTIST = {
    id: "u2",
    email: "a@x",
    role: "ARTIST" as const,
    displayName: "Art",
    artistId: "art9",
  };

  it("forbids an artist from assigning an enquiry to another artist", async () => {
    const { assignEnquiry } = await import("./actions");
    vi.mocked(requireRole).mockResolvedValue(ARTIST);
    vi.mocked(prisma.enquiry.findUniqueOrThrow).mockResolvedValue({
      ...ENQUIRY,
      source: "inkling",
      preferredArtistId: null,
    } as never);
    const res = await assignEnquiry("e1", "someone_else");
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/only assign enquiries to yourself/i);
    expect(prisma.enquiry.update).not.toHaveBeenCalled();
  });

  it("lets an artist assign an open board to themselves", async () => {
    const { assignEnquiry } = await import("./actions");
    vi.mocked(requireRole).mockResolvedValue(ARTIST);
    vi.mocked(prisma.enquiry.findUniqueOrThrow).mockResolvedValue({
      ...ENQUIRY,
      source: "inkling",
      preferredArtistId: null,
    } as never);
    const res = await assignEnquiry("e1", "art9");
    expect(res.ok).toBe(true);
    expect(prisma.enquiry.update).toHaveBeenCalledWith({
      where: { id: "e1" },
      data: { preferredArtistId: "art9", assignedAt: expect.any(Date) },
    });
  });

  it("still lets an owner assign to any artist", async () => {
    const { assignEnquiry } = await import("./actions");
    const res = await assignEnquiry("e1", "art2");
    expect(res.ok).toBe(true);
    expect(prisma.enquiry.update).toHaveBeenCalledWith({
      where: { id: "e1" },
      data: { preferredArtistId: "art2", assignedAt: expect.any(Date) },
    });
  });
});

describe("reply threading, notes, read markers and close authorisation", () => {
  const ARTIST = {
    id: "u2",
    email: "a@x",
    role: "ARTIST" as const,
    displayName: "Art",
    artistId: "art1",
  };

  it("threads the reply onto the enquiry via sendEnquiryEmail", async () => {
    await replyToEnquiry("e1", { message: "Tuesday works!" });
    expect(sendEnquiryEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({ enquiryId: "e1" }),
      }),
    );
  });

  it("records an internal note when there is no email to send to", async () => {
    vi.mocked(prisma.enquiry.findUniqueOrThrow).mockResolvedValue(
      UNREACHABLE as never,
    );
    const res = await replyToEnquiry("e1", { message: "Hello" });
    expect(res.ok).toBe(true);
    expect(recordOutbound).not.toHaveBeenCalled();
    expect(recordNote).toHaveBeenCalled();
  });

  it("addInternalNote records an internal message and rejects an empty body", async () => {
    const { addInternalNote } = await import("./actions");
    const ok = await addInternalNote("e1", { body: "  Chased on IG.  " });
    expect(ok.ok).toBe(true);
    expect(recordNote).toHaveBeenCalledWith({
      enquiryId: "e1",
      authorUserId: "u1",
      bodyText: "Chased on IG.",
    });
    vi.mocked(recordNote).mockClear();
    const bad = await addInternalNote("e1", { body: "   " });
    expect(bad.ok).toBe(false);
    expect(recordNote).not.toHaveBeenCalled();
  });

  it("markEnquiryRead marks the thread read for the signed-in user", async () => {
    const { markEnquiryRead } = await import("./actions");
    const res = await markEnquiryRead("e1");
    expect(res.ok).toBe(true);
    expect(markRead).toHaveBeenCalledWith("e1", "u1");
  });

  it("lets an owner close anything but limits artists to their own enquiries", async () => {
    const { closeEnquiry } = await import("./actions");
    expect((await closeEnquiry("e1")).ok).toBe(true);

    vi.mocked(requireRole).mockResolvedValue(ARTIST);
    vi.mocked(prisma.enquiry.findUniqueOrThrow).mockResolvedValue({
      ...ENQUIRY,
      preferredArtistId: "art1",
    } as never);
    expect((await closeEnquiry("e1")).ok).toBe(true);

    vi.mocked(prisma.enquiry.findUniqueOrThrow).mockResolvedValue({
      ...ENQUIRY,
      preferredArtistId: null,
    } as never);
    const refused = await closeEnquiry("e1");
    expect(refused.ok).toBe(false);
    expect(refused.message).toMatch(/assigned artist/i);
  });
});

function metaEnquiry() {
  vi.mocked(requireRole).mockResolvedValue({
    id: "u1",
    role: "OWNER",
    displayName: "Owner",
    artistId: null,
    email: "owner@example.test",
  } as never);
  vi.mocked(prisma.enquiry.findUniqueOrThrow).mockResolvedValue({
    id: "e1",
    customerId: "c1",
    contactEmail: null,
    contactName: "Amy Rowe",
    preferredArtistId: null,
    style: null,
    placement: null,
    source: "web",
    status: "new",
    threadToken: "tok12345678",
    subject: null,
    lastInboundAt: new Date("2026-09-08T09:00:00Z"),
    preferredArtist: null,
    customer: { email: null },
    messages: [
      {
        channel: "messenger",
        subject: null,
        messageIdHeader: null,
        fromAddress: "7213456789012345",
        connectionId: "conn1",
      },
    ],
  } as never);
}

describe("replyToEnquiry on a Meta thread", () => {
  it("sends through the Meta channel and marks the enquiry replied", async () => {
    metaEnquiry();
    vi.mocked(loadMetaReplyTarget).mockResolvedValue(META_TARGET as never);
    vi.mocked(sendEnquiryMetaMessage).mockResolvedValue({
      messageIds: ["m_out_1"],
    });

    const res = await replyToEnquiry("e1", { message: "Yes, October works." });

    expect(res).toEqual({
      ok: true,
      message: "Reply sent on Messenger and enquiry marked replied.",
    });
    expect(sendEnquiryMetaMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        target: META_TARGET,
        body: "Yes, October works.",
        authorUserId: "u1",
      }),
    );
    expect(sendEnquiryEmail).not.toHaveBeenCalled();
    expect(updateEnquiryStatus).toHaveBeenCalledWith("e1", "replied");
  });

  it("surfaces the 24-hour window as a composer error, sending nothing else", async () => {
    metaEnquiry();
    vi.mocked(loadMetaReplyTarget).mockResolvedValue(META_TARGET as never);
    vi.mocked(sendEnquiryMetaMessage).mockRejectedValue(
      new MetaWindowClosedError("messenger"),
    );

    const res = await replyToEnquiry("e1", { message: "Are you still there?" });

    expect(res).toEqual({
      ok: false,
      message:
        "Messenger/Instagram only allows replies within 24 hours of the customer's last message — email them instead.",
    });
    expect(updateEnquiryStatus).not.toHaveBeenCalled();
    expect(sendEnquiryEmail).not.toHaveBeenCalled();
  });

  it("falls back to email when the Page is disconnected", async () => {
    metaEnquiry();
    vi.mocked(prisma.enquiry.findUniqueOrThrow).mockResolvedValue({
      id: "e1",
      customerId: "c1",
      contactEmail: "amy@example.test",
      contactName: "Amy Rowe",
      preferredArtistId: null,
      style: null,
      placement: null,
      source: "web",
      status: "new",
      threadToken: "tok12345678",
      subject: null,
      lastInboundAt: new Date("2026-09-08T09:00:00Z"),
      preferredArtist: null,
      customer: { email: "amy@example.test" },
      messages: [
        {
          channel: "messenger",
          subject: null,
          messageIdHeader: null,
          fromAddress: "7213456789012345",
          connectionId: "conn1",
        },
      ],
    } as never);
    vi.mocked(loadMetaReplyTarget).mockResolvedValue(null);
    vi.mocked(sendEnquiryEmail).mockResolvedValue({ id: "re_1", status: "sent" });

    const res = await replyToEnquiry("e1", { message: "Hello again" });

    expect(res.ok).toBe(true);
    expect(sendEnquiryMetaMessage).not.toHaveBeenCalled();
    expect(sendEnquiryEmail).toHaveBeenCalled();
  });

  it("reports a Meta failure that is not the window, recording nothing", async () => {
    metaEnquiry();
    vi.mocked(loadMetaReplyTarget).mockResolvedValue(META_TARGET as never);
    vi.mocked(sendEnquiryMetaMessage).mockRejectedValue(
      new Error("Meta refused the message: (#100) Invalid parameter"),
    );

    const res = await replyToEnquiry("e1", { message: "Hello?" });

    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/could not be sent on Messenger/i);
    expect(updateEnquiryStatus).not.toHaveBeenCalled();
    expect(recordNote).not.toHaveBeenCalled();
    expect(sendEnquiryEmail).not.toHaveBeenCalled();
  });
});
