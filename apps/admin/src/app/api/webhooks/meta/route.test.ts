import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signMetaPayload } from "@bnb/core/services/channels/meta";
import messengerText from "@bnb/core/services/channels/__fixtures__/meta-messenger-text.json";
import delivery from "@bnb/core/services/channels/__fixtures__/meta-delivery.json";

/**
 * Unauthenticated but signature-verified, and it must never answer 5xx for a
 * processing failure — Meta disables a webhook that keeps erroring. Failures
 * become a WebhookFailure row (one per event, so Retry replays exactly what
 * broke) plus a 200.
 */
const ingestMetaEvent = vi.fn();
const recordWebhookFailure = vi.fn();

vi.mock("@bnb/core/services/channels/meta-inbound", () => ({
  ingestMetaEvent: (...a: unknown[]) => ingestMetaEvent(...a),
}));
vi.mock("@bnb/core/services/webhook-failures", () => ({
  recordWebhookFailure: (...a: unknown[]) => recordWebhookFailure(...a),
}));

import { GET, POST } from "./route";

const APP_SECRET = "synthetic-app-secret-not-a-real-one";
const VERIFY_TOKEN = "synthetic-verify-token";
const ORIGINAL = {
  secret: process.env.META_APP_SECRET,
  token: process.env.META_VERIFY_TOKEN,
};

function signedRequest(
  body: unknown,
  opts: { secret?: string; header?: string | null; signBody?: string } = {},
) {
  const payload = typeof body === "string" ? body : JSON.stringify(body);
  const header =
    opts.header === undefined
      ? signMetaPayload(opts.secret ?? APP_SECRET, opts.signBody ?? payload)
      : opts.header;
  return new Request("http://admin.test/api/webhooks/meta", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(header ? { "x-hub-signature-256": header } : {}),
    },
    body: payload,
  });
}

function getRequest(query: Record<string, string>) {
  const url = new URL("http://admin.test/api/webhooks/meta");
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  return new Request(url, { method: "GET" });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.META_APP_SECRET = APP_SECRET;
  process.env.META_VERIFY_TOKEN = VERIFY_TOKEN;
  ingestMetaEvent.mockResolvedValue({
    status: "recorded",
    direction: "inbound",
    enquiryId: "enq1",
    messageId: "msg1",
    createdEnquiry: true,
  });
  recordWebhookFailure.mockResolvedValue("wf1");
});

afterEach(() => {
  if (ORIGINAL.secret === undefined) delete process.env.META_APP_SECRET;
  else process.env.META_APP_SECRET = ORIGINAL.secret;
  if (ORIGINAL.token === undefined) delete process.env.META_VERIFY_TOKEN;
  else process.env.META_VERIFY_TOKEN = ORIGINAL.token;
});

describe("GET /api/webhooks/meta", () => {
  it("echoes hub.challenge as plain text for a correct handshake", async () => {
    const res = await GET(
      getRequest({
        "hub.mode": "subscribe",
        "hub.verify_token": VERIFY_TOKEN,
        "hub.challenge": "1158201444",
      }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/plain");
    // Verbatim: Meta compares the body byte for byte, so no JSON, no newline.
    expect(await res.text()).toBe("1158201444");
  });

  it("403s a wrong verify token", async () => {
    const res = await GET(
      getRequest({
        "hub.mode": "subscribe",
        "hub.verify_token": "wrong",
        "hub.challenge": "1",
      }),
    );
    expect(res.status).toBe(403);
  });

  it("503s when the verify token is not configured", async () => {
    delete process.env.META_VERIFY_TOKEN;
    const res = await GET(
      getRequest({
        "hub.mode": "subscribe",
        "hub.verify_token": VERIFY_TOKEN,
        "hub.challenge": "1",
      }),
    );
    expect(res.status).toBe(503);
  });
});

describe("POST /api/webhooks/meta", () => {
  it("processes every messaging event in a signed delivery", async () => {
    const res = await POST(signedRequest(messengerText));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; outcomes: unknown[] };
    expect(body.ok).toBe(true);
    expect(body.outcomes).toHaveLength(1);
    expect(ingestMetaEvent).toHaveBeenCalledTimes(1);
    expect(ingestMetaEvent.mock.calls[0][0]).toMatchObject({
      mid: "m_AbC0dEf1GhI2jKl3MnO4pQ",
      channel: "messenger",
    });
    expect(recordWebhookFailure).not.toHaveBeenCalled();
  });

  it("processes a multi-event delivery sequentially", async () => {
    const order: string[] = [];
    ingestMetaEvent.mockImplementation(async (event: { timestamp: Date }) => {
      order.push(event.timestamp.toISOString());
      return { status: "ignored", reason: "unsupported" };
    });
    const res = await POST(signedRequest(delivery));
    expect(res.status).toBe(200);
    expect(order).toEqual([
      "2026-09-08T20:06:40.000Z",
      "2026-09-08T20:06:41.000Z",
    ]);
  });

  it("503s when the app secret is not configured, without processing", async () => {
    delete process.env.META_APP_SECRET;
    const res = await POST(signedRequest(messengerText));
    expect(res.status).toBe(503);
    expect(ingestMetaEvent).not.toHaveBeenCalled();
  });

  it("401s an unsigned request, and records nothing", async () => {
    const res = await POST(signedRequest(messengerText, { header: null }));
    expect(res.status).toBe(401);
    expect(ingestMetaEvent).not.toHaveBeenCalled();
    expect(recordWebhookFailure).not.toHaveBeenCalled();
  });

  it("401s a body that was altered after signing", async () => {
    const res = await POST(
      signedRequest(messengerText, { signBody: '{"object":"page"}' }),
    );
    expect(res.status).toBe(401);
    expect(ingestMetaEvent).not.toHaveBeenCalled();
  });

  it("413s an oversize body without buffering it", async () => {
    const huge = "x".repeat(1_048_577);
    const req = new Request("http://admin.test/api/webhooks/meta", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": String(huge.length),
        "x-hub-signature-256": signMetaPayload(APP_SECRET, huge),
      },
      body: huge,
    });
    const res = await POST(req);
    expect(res.status).toBe(413);
    expect(recordWebhookFailure).not.toHaveBeenCalled();
  });

  it("records a failure and still answers 200 when an event throws", async () => {
    ingestMetaEvent.mockRejectedValue(new Error("Graph is down"));
    const res = await POST(signedRequest(messengerText));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(false);
    expect(recordWebhookFailure).toHaveBeenCalledWith({
      provider: "meta",
      externalId: "m_AbC0dEf1GhI2jKl3MnO4pQ",
      // The single-event body, so Retry replays exactly what broke.
      payload: {
        object: "page",
        entry: [
          expect.objectContaining({ id: "102938475610293" }),
        ],
      },
      error: "Graph is down",
    });
  });

  it("keeps going after one event fails", async () => {
    ingestMetaEvent
      .mockRejectedValueOnce(new Error("first blew up"))
      .mockResolvedValueOnce({ status: "ignored", reason: "unsupported" });
    const res = await POST(signedRequest(delivery));
    expect(res.status).toBe(200);
    expect(ingestMetaEvent).toHaveBeenCalledTimes(2);
    expect(recordWebhookFailure).toHaveBeenCalledTimes(1);
  });

  it("200s a correctly signed body that is not JSON, recording it once", async () => {
    const res = await POST(signedRequest("not json at all"));
    expect(res.status).toBe(200);
    expect(recordWebhookFailure).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "meta", externalId: null }),
    );
    expect(ingestMetaEvent).not.toHaveBeenCalled();
  });

  it("200s a signed body with no messaging events at all", async () => {
    const res = await POST(signedRequest({ object: "page", entry: [] }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; outcomes: unknown[] };
    expect(body).toMatchObject({ ok: true, outcomes: [] });
    expect(recordWebhookFailure).not.toHaveBeenCalled();
  });
});
