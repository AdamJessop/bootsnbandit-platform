import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseMetaWebhook } from "./meta";
import messengerText from "./__fixtures__/meta-messenger-text.json";
import messengerImage from "./__fixtures__/meta-messenger-image.json";
import instagramText from "./__fixtures__/meta-instagram-text.json";
import echo from "./__fixtures__/meta-echo.json";
import delivery from "./__fixtures__/meta-delivery.json";
import postback from "./__fixtures__/meta-postback.json";

/**
 * The whole inbound Meta path with the database, the identity resolver, the
 * threading rule and the network all mocked — so what is under test is the
 * decision-making, not Prisma.
 */
// One mock per Prisma model, never one shared `findUnique`: a shared spy makes
// every assertion depend on the order the two lookups happen to run in.
const messageFindUnique = vi.fn();
const identityFindUnique = vi.fn();
const deleteMany = vi.fn();
const lookupConnectionByExternalId = vi.fn();
const touchConnectionEvent = vi.fn();
const findOrCreateCustomer = vi.fn();
const resolveThread = vi.fn();
const recordInbound = vi.fn();
const recordOutbound = vi.fn();

vi.mock("@bnb/core/db", () => ({
  prisma: {
    enquiryMessage: { findUnique: (...a: unknown[]) => messageFindUnique(...a) },
    customerIdentity: {
      findUnique: (...a: unknown[]) => identityFindUnique(...a),
    },
    enquiry: { deleteMany: (...a: unknown[]) => deleteMany(...a) },
  },
}));
vi.mock("../channel-connections", () => ({
  lookupConnectionByExternalId: (...a: unknown[]) =>
    lookupConnectionByExternalId(...a),
  touchConnectionEvent: (...a: unknown[]) => touchConnectionEvent(...a),
}));
vi.mock("../contact-identity", () => ({
  findOrCreateCustomer: (...a: unknown[]) => findOrCreateCustomer(...a),
}));
vi.mock("../enquiry-threading", () => ({
  resolveThread: (...a: unknown[]) => resolveThread(...a),
}));
vi.mock("../enquiry-messages", () => ({
  recordInbound: (...a: unknown[]) => recordInbound(...a),
  recordOutbound: (...a: unknown[]) => recordOutbound(...a),
}));

const {
  ingestMetaEvent,
  MAX_ATTACHMENT_WALL_MS,
  MAX_META_ATTACHMENTS,
  META_INBOX_AUTHOR,
  UNKNOWN_SENDER_NAME,
} = await import("./meta-inbound");

const CONNECTION = {
  id: "conn1",
  channel: "messenger" as const,
  externalId: "102938475610293",
  pageId: "102938475610293",
  igAccountId: null,
  name: "Boots 'n' Bandit",
  active: true,
  webhookSubscribedAt: null,
  lastEventAt: null,
  connectedAt: new Date("2026-09-01T00:00:00Z"),
  tokenReadable: true,
  accessToken: "EAAG_synthetic",
};

/** What `lookupConnectionByExternalId` answers for a healthy row. */
const OK_LOOKUP = { kind: "ok" as const, connection: CONNECTION };

/** A valid PNG header so sniffImageMime accepts it. */
function png(size = 64): Uint8Array {
  const bytes = new Uint8Array(size);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return bytes;
}

function deps(over: Partial<{ profile: unknown; bytes: Uint8Array | null }> = {}) {
  return {
    // `in`, not `??`: `{ profile: null }` means "the fetch failed", which is a
    // meaningful case here — `??` would silently fall through to a real name.
    fetchProfile: vi.fn(
      async () => ("profile" in over ? over.profile : { name: "Amy Rowe" }) as never,
    ),
    download: vi.fn(async () => (over.bytes === undefined ? png() : over.bytes)),
  };
}

/**
 * Deps with a clock the test drives by hand: each download costs `costMs`, so
 * the attachment wall budget can be crossed without waiting for it.
 */
function slowDeps(costMs: number) {
  let clock = 0;
  return {
    fetchProfile: vi.fn(async () => ({ name: "Amy Rowe" }) as never),
    download: vi.fn(async () => {
      clock += costMs;
      return png();
    }),
    now: () => clock,
  };
}

const first = (body: unknown) => parseMetaWebhook(body)[0];

beforeEach(() => {
  vi.clearAllMocks();
  lookupConnectionByExternalId.mockResolvedValue(OK_LOOKUP);
  messageFindUnique.mockResolvedValue(null);
  identityFindUnique.mockResolvedValue(null);
  findOrCreateCustomer.mockResolvedValue({
    id: "cus1",
    name: "Amy Rowe",
    phone: null,
  });
  resolveThread.mockResolvedValue({ enquiryId: "enq1", created: true });
  recordInbound.mockResolvedValue({ id: "msg1", enquiryId: "enq1" });
  recordOutbound.mockResolvedValue({ id: "msg2", enquiryId: "enq1" });
  deleteMany.mockResolvedValue({ count: 0 });
});

describe("ingestMetaEvent", () => {
  it("records a Messenger message against a new customer and thread", async () => {
    const d = deps();
    const outcome = await ingestMetaEvent(first(messengerText), d);

    expect(outcome).toEqual({
      status: "recorded",
      direction: "inbound",
      enquiryId: "enq1",
      messageId: "msg1",
      createdEnquiry: true,
    });
    expect(findOrCreateCustomer).toHaveBeenCalledWith({
      name: "Amy Rowe",
      identityCustomerId: null,
      identity: {
        channel: "messenger",
        externalId: "7213456789012345",
        displayName: "Amy Rowe",
      },
    });
    expect(resolveThread).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: "cus1",
        channel: "messenger",
        contactName: "Amy Rowe",
        threadToken: null,
      }),
    );
    expect(recordInbound).toHaveBeenCalledWith(
      expect.objectContaining({
        enquiryId: "enq1",
        customerId: "cus1",
        channel: "messenger",
        externalId: "m_AbC0dEf1GhI2jKl3MnO4pQ",
        fromAddress: "7213456789012345",
        fromName: "Amy Rowe",
        connectionId: "conn1",
        bodyText: "Hiya, do you have any space for a small linework piece?",
      }),
    );
    expect(touchConnectionEvent).toHaveBeenCalledWith(
      "conn1",
      expect.any(Date),
    );
  });

  it("threads an Instagram message on the instagram channel", async () => {
    lookupConnectionByExternalId.mockResolvedValue({
      kind: "ok",
      connection: {
        ...CONNECTION,
        id: "conn2",
        channel: "instagram",
        externalId: "17841400000000000",
      },
    });
    await ingestMetaEvent(first(instagramText), deps());
    expect(resolveThread).toHaveBeenCalledWith(
      expect.objectContaining({ channel: "instagram" }),
    );
    expect(recordInbound).toHaveBeenCalledWith(
      expect.objectContaining({ channel: "instagram", connectionId: "conn2" }),
    );
  });

  it("only fetches a profile for a handle we have never seen", async () => {
    identityFindUnique.mockResolvedValue({
      customerId: "cus1",
      displayName: "Amy Rowe",
    });
    const d = deps();
    await ingestMetaEvent(first(messengerText), d);
    expect(d.fetchProfile).not.toHaveBeenCalled();
    // The identity row was already read here, so the resolver is told which
    // customer it names rather than reading the same row a second time.
    expect(findOrCreateCustomer).toHaveBeenCalledWith(
      expect.objectContaining({ identityCustomerId: "cus1" }),
    );
  });

  it("names the customer for the channel when the profile fetch fails", async () => {
    const d = deps({ profile: null });
    await ingestMetaEvent(first(messengerText), d);
    expect(findOrCreateCustomer).toHaveBeenCalledWith({
      name: UNKNOWN_SENDER_NAME.messenger,
      identityCustomerId: null,
      identity: {
        channel: "messenger",
        externalId: "7213456789012345",
        displayName: UNKNOWN_SENDER_NAME.messenger,
      },
    });
    expect(UNKNOWN_SENDER_NAME).toEqual({
      messenger: "Messenger user",
      instagram: "Instagram user",
    });
  });

  it("stores an image attachment inline and a non-image as a link", async () => {
    const d = deps();
    await ingestMetaEvent(first(messengerImage), d);
    const attachments = recordInbound.mock.calls[0][0].attachments;
    expect(attachments).toHaveLength(2);
    expect(attachments[0]).toMatchObject({ mime: "image/png" });
    expect(attachments[0].bytes).toBeInstanceOf(Uint8Array);
    expect(attachments[1]).toEqual({
      mime: "application/octet-stream",
      filename: null,
      url: "https://lookaside.fbsbx.com/synthetic/brief.pdf",
    });
    // Only the image was fetched — the file is a link, never downloaded.
    expect(d.download).toHaveBeenCalledTimes(1);
  });

  it("never downloads from a host outside Meta's CDNs", async () => {
    const event = first(messengerImage);
    event.attachments = [{ type: "image", url: "http://169.254.169.254/x.png" }];
    const d = deps();
    await ingestMetaEvent(event, d);
    expect(d.download).not.toHaveBeenCalled();
    expect(recordInbound.mock.calls[0][0].attachments).toEqual([
      {
        mime: "application/octet-stream",
        filename: null,
        url: "http://169.254.169.254/x.png",
      },
    ]);
  });

  it("downgrades bytes that are not really an image to a link", async () => {
    const d = deps({ bytes: new Uint8Array([0x3c, 0x73, 0x76, 0x67]) }); // "<svg"
    await ingestMetaEvent(first(messengerImage), d);
    const attachments = recordInbound.mock.calls[0][0].attachments;
    expect(attachments[0].bytes).toBeUndefined();
    expect(attachments[0].url).toBe(
      "https://scontent.xx.fbcdn.net/v/t1.0-9/synthetic-reference.jpg",
    );
  });

  it("records an unknown echo as OUTBOUND from the Meta inbox", async () => {
    const outcome = await ingestMetaEvent(first(echo), deps());
    expect(outcome).toMatchObject({
      status: "recorded",
      direction: "outbound",
      messageId: "msg2",
    });
    expect(recordInbound).not.toHaveBeenCalled();
    expect(recordOutbound).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "messenger",
        authorUserId: null,
        fromName: META_INBOX_AUTHOR,
        fromAddress: "7213456789012345",
        externalId: "m_EcHo1EcHo2EcHo3EcHo4E",
        connectionId: "conn1",
      }),
    );
  });

  it("ignores an echo of a message we already sent ourselves", async () => {
    messageFindUnique.mockResolvedValue({ id: "msg9", enquiryId: "enq9" });
    expect(await ingestMetaEvent(first(echo), deps())).toEqual({
      status: "ignored",
      reason: "echo_known",
    });
    expect(recordOutbound).not.toHaveBeenCalled();
    // Our own message coming back is not the customer reaching us, so it is
    // not a liveness signal either.
    expect(touchConnectionEvent).not.toHaveBeenCalled();
  });

  it("reports a replayed inbound message as a duplicate", async () => {
    messageFindUnique.mockResolvedValue({ id: "msg9", enquiryId: "enq9" });
    expect(await ingestMetaEvent(first(messengerText), deps())).toEqual({
      status: "duplicate",
      enquiryId: "enq9",
      messageId: "msg9",
    });
    expect(recordInbound).not.toHaveBeenCalled();
    // A redelivery is still traffic arriving on the connection — the Channels
    // panel's liveness signal should reflect it.
    expect(touchConnectionEvent).toHaveBeenCalledWith("conn1", expect.any(Date));
  });

  it("ignores delivery/read receipts and postbacks", async () => {
    for (const event of parseMetaWebhook(delivery)) {
      expect(await ingestMetaEvent(event, deps())).toEqual({
        status: "ignored",
        reason: "unsupported",
      });
    }
    expect(await ingestMetaEvent(first(postback), deps())).toEqual({
      status: "ignored",
      reason: "unsupported",
    });
  });

  it("ignores an event for a Page nobody connected, and says so in the log", async () => {
    lookupConnectionByExternalId.mockResolvedValue({ kind: "none" });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await ingestMetaEvent(first(messengerText), deps())).toEqual({
      status: "ignored",
      reason: "unknown_page",
    });
    expect(findOrCreateCustomer).not.toHaveBeenCalled();
    // Silently dropping traffic is how an unnoticed misconfiguration eats
    // customer messages — the log names the entry and the message.
    const logged = JSON.stringify(warn.mock.calls);
    expect(logged).toContain("102938475610293");
    expect(logged).toContain("m_AbC0dEf1GhI2jKl3MnO4pQ");
    warn.mockRestore();
  });

  it("THROWS on a connection whose token cannot be read, rather than dropping it", async () => {
    // A rotated SESSION_SECRET must not look like "a Page nobody connected":
    // that would swallow every message with no failed-event row to retry.
    lookupConnectionByExternalId.mockResolvedValue({
      kind: "unreadable",
      row: { ...CONNECTION, tokenReadable: false, accessToken: undefined },
    });
    await expect(ingestMetaEvent(first(messengerText), deps())).rejects.toThrow(
      /conn1 has an unreadable access token/,
    );
    expect(findOrCreateCustomer).not.toHaveBeenCalled();
    expect(recordInbound).not.toHaveBeenCalled();
  });

  it("ignores a message with no mid, and one with nothing in it", async () => {
    const noMid = { ...first(messengerText), mid: null };
    expect(await ingestMetaEvent(noMid, deps())).toEqual({
      status: "ignored",
      reason: "no_message",
    });
    const empty = { ...first(messengerText), text: null, attachments: [] };
    expect(await ingestMetaEvent(empty, deps())).toEqual({
      status: "ignored",
      reason: "no_message",
    });
  });

  it("describes an attachment-only message rather than storing a blank body", async () => {
    const event = { ...first(messengerImage), text: null };
    await ingestMetaEvent(event, deps());
    expect(recordInbound.mock.calls[0][0].bodyText).toBe("(sent 2 attachments)");
  });

  it("still records the message when the profile fetch throws", async () => {
    const d = deps();
    d.fetchProfile.mockRejectedValue(new Error("graph is down") as never);
    const outcome = await ingestMetaEvent(first(messengerText), d);
    expect(outcome).toMatchObject({ status: "recorded", direction: "inbound" });
    expect(recordInbound).toHaveBeenCalledWith(
      expect.objectContaining({ fromName: UNKNOWN_SENDER_NAME.messenger }),
    );
  });

  it("reuses the stored display name for a handle we already know", async () => {
    identityFindUnique.mockResolvedValue({
      customerId: "cus1",
      displayName: "Amy R.",
    });
    await ingestMetaEvent(first(messengerText), deps());
    // The same identity row resolves back to the same customer, so a closed
    // enquiry means a NEW enquiry for the SAME person — never a new contact.
    expect(findOrCreateCustomer).toHaveBeenCalledWith({
      name: "Amy R.",
      identityCustomerId: "cus1",
      identity: {
        channel: "messenger",
        externalId: "7213456789012345",
        displayName: "Amy R.",
      },
    });
  });

  it("caps how many attachments one message can make us fetch", async () => {
    const event = first(messengerImage);
    event.attachments = Array.from({ length: 14 }, (_, i) => ({
      type: "image",
      url: `https://scontent.xx.fbcdn.net/v/t1.0-9/flood-${i}.jpg`,
    }));
    const d = deps();
    await ingestMetaEvent(event, d);
    expect(d.download).toHaveBeenCalledTimes(10);
    expect(recordInbound.mock.calls[0][0].attachments).toHaveLength(10);
  });

  it("stops downloading once one message has spent its wall-clock budget", async () => {
    const event = first(messengerImage);
    event.attachments = [
      {
        type: "image",
        url: "https://scontent.xx.fbcdn.net/v/t1.0-9/slow-1.jpg",
      },
      {
        type: "image",
        url: "https://scontent.xx.fbcdn.net/v/t1.0-9/slow-2.jpg",
      },
    ];
    // The first download eats the whole budget; the second must become a link
    // rather than pushing the webhook POST past Meta's own timeout.
    const d = slowDeps(MAX_ATTACHMENT_WALL_MS + 1);
    await ingestMetaEvent(event, d);

    expect(d.download).toHaveBeenCalledTimes(1);
    const attachments = recordInbound.mock.calls[0][0].attachments;
    expect(attachments).toHaveLength(2);
    expect(attachments[0]).toMatchObject({ mime: "image/png" });
    expect(attachments[1]).toEqual({
      mime: "application/octet-stream",
      filename: null,
      url: "https://scontent.xx.fbcdn.net/v/t1.0-9/slow-2.jpg",
    });
  });

  it("counts only the attachments it will actually keep in the body text", async () => {
    const event = first(messengerImage);
    event.text = null;
    event.attachments = Array.from({ length: 14 }, (_, i) => ({
      type: "file",
      url: `https://lookaside.fbsbx.com/synthetic/${i}.pdf`,
    }));
    await ingestMetaEvent(event, deps());
    // 14 arrived, 10 are kept — saying "14" would describe rows nobody has.
    expect(recordInbound.mock.calls[0][0].bodyText).toBe(
      `(sent ${MAX_META_ATTACHMENTS} attachments)`,
    );
  });

  it("cleans up the enquiry it created when it loses a race", async () => {
    resolveThread.mockResolvedValue({ enquiryId: "enqNew", created: true });
    recordInbound.mockResolvedValue({ id: "msg1", enquiryId: "enqWinner" });
    const outcome = await ingestMetaEvent(first(messengerText), deps());
    expect(outcome).toMatchObject({
      enquiryId: "enqWinner",
      createdEnquiry: false,
    });
    expect(deleteMany).toHaveBeenCalledWith({
      where: { id: "enqNew", messages: { none: {} } },
    });
  });
});
