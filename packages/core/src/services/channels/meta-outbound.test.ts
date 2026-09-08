import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { MetaWindowClosedError } from "./meta";

const getConnection = vi.fn();
const recordOutbound = vi.fn();

vi.mock("../channel-connections", () => ({
  getConnection: (...a: unknown[]) => getConnection(...a),
}));
vi.mock("../enquiry-messages", () => ({
  recordOutbound: (...a: unknown[]) => recordOutbound(...a),
}));

const {
  loadMetaReplyTarget,
  MetaSendError,
  sendEnquiryMetaMessage,
  sendMetaMessage,
} = await import("./meta-outbound");

const CONNECTION = {
  id: "conn1",
  channel: "messenger" as const,
  externalId: "102938475610293",
  pageId: "102938475610293",
  igAccountId: "17841400000000000",
  name: "Boots 'n' Bandit",
  active: true,
  webhookSubscribedAt: new Date("2026-09-01T00:00:00Z"),
  lastEventAt: null,
  connectedAt: new Date("2026-09-01T00:00:00Z"),
  accessToken: "EAAG_synthetic_page_token",
};

const NOW = new Date("2026-09-08T12:00:00Z");
const RECENT = new Date("2026-09-08T09:00:00Z");
const STALE = new Date("2026-09-06T09:00:00Z");

function okFetch(ids: string[]): typeof fetch {
  let i = 0;
  return vi.fn(async () =>
    Response.json({ recipient_id: "7213456789012345", message_id: ids[i++] }),
  ) as unknown as typeof fetch;
}

const CONTEXT = {
  enquiryId: "enq1",
  threadToken: "tok12345678",
  customerId: "cus1",
  contactName: "Amy Rowe",
  contactEmail: null,
  subject: null,
  artistName: "Sarah North",
  lastInboundChannel: "messenger" as const,
  lastInboundMessageId: null,
  lastInboundSubject: null,
  lastInboundFromAddress: "7213456789012345",
  lastInboundConnectionId: "conn1",
  lastInboundAt: RECENT,
};

beforeEach(() => {
  vi.clearAllMocks();
  getConnection.mockResolvedValue(CONNECTION);
  recordOutbound.mockResolvedValue({ id: "msg1", enquiryId: "enq1" });
});

describe("loadMetaReplyTarget", () => {
  it("resolves the connection and recipient of the last inbound Meta message", async () => {
    expect(await loadMetaReplyTarget(CONTEXT)).toEqual({
      connection: CONNECTION,
      channel: "messenger",
      recipientId: "7213456789012345",
    });
  });

  it("is null for a non-Meta thread, or one missing either half", async () => {
    expect(
      await loadMetaReplyTarget({ ...CONTEXT, lastInboundChannel: "email" }),
    ).toBeNull();
    expect(
      await loadMetaReplyTarget({ ...CONTEXT, lastInboundConnectionId: null }),
    ).toBeNull();
    expect(
      await loadMetaReplyTarget({ ...CONTEXT, lastInboundFromAddress: null }),
    ).toBeNull();
    expect(getConnection).not.toHaveBeenCalled();
  });

  it("is null when the connection is gone, disconnected, or unreadable", async () => {
    getConnection.mockResolvedValue(null);
    expect(await loadMetaReplyTarget(CONTEXT)).toBeNull();
    getConnection.mockResolvedValue({ ...CONNECTION, active: false });
    expect(await loadMetaReplyTarget(CONTEXT)).toBeNull();
  });
});

describe("sendMetaMessage", () => {
  it("posts to the PAGE messages endpoint with the token in the body", async () => {
    const fetchImpl = okFetch(["m_out_1"]);
    const parts = await sendMetaMessage({
      connection: CONNECTION,
      channel: "messenger",
      recipientId: "7213456789012345",
      text: "Sarah has space in October — shall I book you a consult?",
      lastInboundAt: RECENT,
      now: NOW,
      fetchImpl,
    });

    expect(parts).toEqual([
      {
        text: "Sarah has space in October — shall I book you a consult?",
        messageId: "m_out_1",
      },
    ]);
    const [url, init] = vi.mocked(fetchImpl).mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      "https://graph.facebook.com/v21.0/102938475610293/messages",
    );
    // The token must NOT be in the URL — query strings land in access logs.
    expect(url).not.toContain("access_token");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      recipient: { id: "7213456789012345" },
      messaging_type: "RESPONSE",
      message: { text: "Sarah has space in October — shall I book you a consult?" },
      access_token: "EAAG_synthetic_page_token",
    });
  });

  it("sends an Instagram reply through the same page endpoint", async () => {
    const fetchImpl = okFetch(["m_out_ig"]);
    await sendMetaMessage({
      connection: { ...CONNECTION, channel: "instagram", externalId: "17841400000000000" },
      channel: "instagram",
      recipientId: "6011223344556677",
      text: "It is still available!",
      lastInboundAt: RECENT,
      now: NOW,
      fetchImpl,
    });
    const [url] = vi.mocked(fetchImpl).mock.calls[0] as [string];
    expect(url).toBe(
      "https://graph.facebook.com/v21.0/102938475610293/messages",
    );
  });

  it("splits an over-long reply into consecutive sends", async () => {
    const fetchImpl = okFetch(["m_a", "m_b"]);
    const parts = await sendMetaMessage({
      connection: CONNECTION,
      channel: "messenger",
      recipientId: "7213456789012345",
      text: "word ".repeat(600), // 3000 chars
      lastInboundAt: RECENT,
      now: NOW,
      fetchImpl,
    });
    expect(parts.map((p) => p.messageId)).toEqual(["m_a", "m_b"]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("refuses before the request when the 24-hour window has shut", async () => {
    const fetchImpl = okFetch(["never"]);
    await expect(
      sendMetaMessage({
        connection: CONNECTION,
        channel: "messenger",
        recipientId: "7213456789012345",
        text: "Too late",
        lastInboundAt: STALE,
        now: NOW,
        fetchImpl,
      }),
    ).rejects.toBeInstanceOf(MetaWindowClosedError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("maps Graph's own window rejection to the same error", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json(
        {
          error: {
            message: "This message is sent outside of allowed window.",
            code: 10,
            error_subcode: 2018278,
          },
        },
        { status: 400 },
      ),
    ) as unknown as typeof fetch;
    await expect(
      sendMetaMessage({
        connection: CONNECTION,
        channel: "messenger",
        recipientId: "7213456789012345",
        text: "Racing the window",
        lastInboundAt: RECENT,
        now: NOW,
        fetchImpl,
      }),
    ).rejects.toBeInstanceOf(MetaWindowClosedError);
  });

  it("raises a MetaSendError for any other Graph failure, without the token", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json(
        { error: { message: "Invalid OAuth access token.", code: 190 } },
        { status: 401 },
      ),
    ) as unknown as typeof fetch;
    const promise = sendMetaMessage({
      connection: CONNECTION,
      channel: "messenger",
      recipientId: "7213456789012345",
      text: "Hello",
      lastInboundAt: RECENT,
      now: NOW,
      fetchImpl,
    });
    await expect(promise).rejects.toBeInstanceOf(MetaSendError);
    await expect(promise).rejects.toThrow(/Invalid OAuth access token/);
    await expect(promise).rejects.not.toThrow(/EAAG_synthetic_page_token/);
  });
});

describe("sendEnquiryMetaMessage", () => {
  it("records ONE outbound message per part, each keyed by its own mid", async () => {
    const fetchImpl = okFetch(["m_a", "m_b"]);
    const result = await sendEnquiryMetaMessage({
      context: CONTEXT,
      target: {
        connection: CONNECTION,
        channel: "messenger",
        recipientId: "7213456789012345",
      },
      body: "word ".repeat(600),
      authorUserId: "u1",
      now: NOW,
      fetchImpl,
    });

    expect(result.messageIds).toEqual(["m_a", "m_b"]);
    expect(recordOutbound).toHaveBeenCalledTimes(2);
    expect(recordOutbound.mock.calls[0][0]).toMatchObject({
      enquiryId: "enq1",
      customerId: "cus1",
      channel: "messenger",
      authorUserId: "u1",
      fromAddress: "7213456789012345",
      connectionId: "conn1",
      externalId: "m_a",
      deliveryStatus: "sent",
    });
    expect(recordOutbound.mock.calls[1][0]).toMatchObject({ externalId: "m_b" });
  });
});

// ---------------------------------------------------------------------------
// Hostile inputs
// ---------------------------------------------------------------------------

describe("sendMetaMessage under hostile input", () => {
  it("treats a last inbound EXACTLY 24 hours old as outside the window", async () => {
    const fetchImpl = okFetch(["never"]);
    await expect(
      sendMetaMessage({
        connection: CONNECTION,
        channel: "messenger",
        recipientId: "7213456789012345",
        text: "One second too late",
        lastInboundAt: new Date(NOW.getTime() - 86_400_000),
        now: NOW,
        fetchImpl,
      }),
    ).rejects.toBeInstanceOf(MetaWindowClosedError);
    // …and one millisecond inside it still goes.
    const ok = okFetch(["m_edge"]);
    await expect(
      sendMetaMessage({
        connection: CONNECTION,
        channel: "messenger",
        recipientId: "7213456789012345",
        text: "Just in time",
        lastInboundAt: new Date(NOW.getTime() - 86_400_000 + 1),
        now: NOW,
        fetchImpl: ok,
      }),
    ).resolves.toHaveLength(1);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("fails a 200 response that carries an error body", async () => {
    // Graph is not consistent about status codes; the body is the verdict.
    const fetchImpl = vi.fn(async () =>
      Response.json({
        error: { message: "(#100) Invalid parameter", code: 100 },
      }),
    ) as unknown as typeof fetch;
    await expect(
      sendMetaMessage({
        connection: CONNECTION,
        channel: "messenger",
        recipientId: "7213456789012345",
        text: "Hello",
        lastInboundAt: RECENT,
        now: NOW,
        fetchImpl,
      }),
    ).rejects.toBeInstanceOf(MetaSendError);
  });

  it("treats code 551 (user unavailable) as the window being shut", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json(
        {
          error: {
            message: "This person isn't available right now.",
            code: 551,
          },
        },
        { status: 400 },
      ),
    ) as unknown as typeof fetch;
    await expect(
      sendMetaMessage({
        connection: CONNECTION,
        channel: "messenger",
        recipientId: "7213456789012345",
        text: "Hello?",
        lastInboundAt: RECENT,
        now: NOW,
        fetchImpl,
      }),
    ).rejects.toBeInstanceOf(MetaWindowClosedError);
  });

  it("never leaks the token through a transport failure", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("fetch failed: ECONNRESET");
    }) as unknown as typeof fetch;
    const promise = sendMetaMessage({
      connection: CONNECTION,
      channel: "messenger",
      recipientId: "7213456789012345",
      text: "Hello",
      lastInboundAt: RECENT,
      now: NOW,
      fetchImpl,
    });
    await expect(promise).rejects.toBeInstanceOf(MetaSendError);
    await expect(promise).rejects.not.toThrow(/EAAG_synthetic_page_token/);
  });

  it("proves the app secret when one is configured, and never in the URL", async () => {
    const fetchImpl = okFetch(["m_proof"]);
    await sendMetaMessage({
      connection: CONNECTION,
      channel: "messenger",
      recipientId: "7213456789012345",
      text: "Hello",
      lastInboundAt: RECENT,
      now: NOW,
      fetchImpl,
      env: { META_APP_SECRET: "app_secret_value" },
    });
    const [url, init] = vi.mocked(fetchImpl).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).not.toContain("appsecret_proof");
    expect(JSON.parse(String(init.body)).appsecret_proof).toBe(
      createHmac("sha256", "app_secret_value")
        .update("EAAG_synthetic_page_token")
        .digest("hex"),
    );
  });
});

describe("sendEnquiryMetaMessage under hostile input", () => {
  it("keeps the parts the customer already received when a later part fails", async () => {
    // 4001 characters → three messages. Graph accepts the first and rejects
    // the second: part one IS on the customer's phone, so it must stay on the
    // thread rather than vanishing with the error.
    let call = 0;
    const fetchImpl = vi.fn(async () => {
      call += 1;
      if (call === 1) {
        return Response.json({ message_id: "m_a" });
      }
      return Response.json(
        { error: { message: "(#100) Invalid parameter", code: 100 } },
        { status: 400 },
      );
    }) as unknown as typeof fetch;

    await expect(
      sendEnquiryMetaMessage({
        context: CONTEXT,
        target: {
          connection: CONNECTION,
          channel: "messenger",
          recipientId: "7213456789012345",
        },
        body: "word ".repeat(800) + "a",
        authorUserId: "u1",
        now: NOW,
        fetchImpl,
      }),
    ).rejects.toBeInstanceOf(MetaSendError);

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(recordOutbound).toHaveBeenCalledTimes(1);
    expect(recordOutbound.mock.calls[0][0]).toMatchObject({
      externalId: "m_a",
      channel: "messenger",
    });
  });

  it("records the parts of a long reply in order", async () => {
    const fetchImpl = okFetch(["m_1", "m_2", "m_3"]);
    const result = await sendEnquiryMetaMessage({
      context: CONTEXT,
      target: {
        connection: CONNECTION,
        channel: "messenger",
        recipientId: "7213456789012345",
      },
      body: "word ".repeat(800) + "a", // 4001 chars
      authorUserId: "u1",
      now: NOW,
      fetchImpl,
    });
    expect(result.messageIds).toEqual(["m_1", "m_2", "m_3"]);
    expect(recordOutbound.mock.calls.map((c) => c[0].externalId)).toEqual([
      "m_1",
      "m_2",
      "m_3",
    ]);
    // The parts reassemble into the reply: nothing dropped, nothing reordered.
    expect(
      recordOutbound.mock.calls.map((c) => c[0].bodyText).join(" "),
    ).toBe(("word ".repeat(800) + "a").trim());
  });
});
