import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signWebhookPayload } from "@bnb/core/services/channels/webhook-signature";

/**
 * The inbound webhook is unauthenticated but signature-verified, and must
 * never answer 5xx for a processing failure — Resend retries on 5xx, and a
 * broken event would storm the endpoint. Failures become a WebhookFailure row
 * plus a 200.
 */

const ingestResendEvent = vi.fn();
const recordWebhookFailure = vi.fn();

vi.mock("@bnb/core/services/channels/email-inbound", () => ({
  ingestResendEvent: (...a: unknown[]) => ingestResendEvent(...a),
}));
vi.mock("@bnb/core/services/webhook-failures", () => ({
  recordWebhookFailure: (...a: unknown[]) => recordWebhookFailure(...a),
}));

import { POST } from "./route";

const SECRET = "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw";
const ORIGINAL = process.env.RESEND_WEBHOOK_SECRET;
const EVENT = {
  type: "email.received",
  data: { email_id: "9f1c2f7a-2f18-4a3a-9a0e-1f0c4a6d7b21" },
};

function signedRequest(
  body: unknown,
  opts: { secret?: string; id?: string; at?: Date; signBody?: string } = {},
) {
  const payload = typeof body === "string" ? body : JSON.stringify(body);
  const id = opts.id ?? "msg_2Xk9QmQ1x7pC4bR";
  const timestamp = Math.floor((opts.at ?? new Date()).getTime() / 1000);
  const signature = signWebhookPayload({
    secret: opts.secret ?? SECRET,
    id,
    timestamp,
    payload: opts.signBody ?? payload,
  });
  return new Request("http://admin.test/api/webhooks/resend", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "svix-id": id,
      "svix-timestamp": String(timestamp),
      "svix-signature": signature,
    },
    body: payload,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.RESEND_WEBHOOK_SECRET = SECRET;
  ingestResendEvent.mockResolvedValue({
    status: "recorded",
    enquiryId: "e1",
    messageId: "m1",
    createdEnquiry: false,
  });
  recordWebhookFailure.mockResolvedValue("wf1");
});

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.RESEND_WEBHOOK_SECRET;
  else process.env.RESEND_WEBHOOK_SECRET = ORIGINAL;
});

describe("POST /api/webhooks/resend", () => {
  it("processes a correctly signed event and reports the outcome", async () => {
    const res = await POST(signedRequest(EVENT));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; status: string };
    expect(body).toMatchObject({ ok: true, status: "recorded" });
    expect(ingestResendEvent).toHaveBeenCalledWith(EVENT);
    expect(recordWebhookFailure).not.toHaveBeenCalled();
  });

  it("503s when the signing secret is not configured, without processing", async () => {
    delete process.env.RESEND_WEBHOOK_SECRET;
    const res = await POST(signedRequest(EVENT));
    expect(res.status).toBe(503);
    expect(ingestResendEvent).not.toHaveBeenCalled();
  });

  it("401s an unsigned request", async () => {
    const res = await POST(
      new Request("http://admin.test/api/webhooks/resend", {
        method: "POST",
        body: JSON.stringify(EVENT),
      }),
    );
    expect(res.status).toBe(401);
    expect(ingestResendEvent).not.toHaveBeenCalled();
    expect(recordWebhookFailure).not.toHaveBeenCalled();
  });

  it("401s a wrongly signed request and a tampered body", async () => {
    const wrongSecret = await POST(
      signedRequest(EVENT, { secret: "whsec_AAAAAAAAAAAAAAAAAAAAAA==" }),
    );
    expect(wrongSecret.status).toBe(401);

    const tampered = await POST(
      signedRequest(EVENT, { signBody: JSON.stringify({ type: "other" }) }),
    );
    expect(tampered.status).toBe(401);
    expect(ingestResendEvent).not.toHaveBeenCalled();
  });

  it("401s a replayed request outside the tolerance window", async () => {
    const res = await POST(
      signedRequest(EVENT, { at: new Date(Date.now() - 10 * 60_000) }),
    );
    expect(res.status).toBe(401);
    expect(ingestResendEvent).not.toHaveBeenCalled();
  });

  it("200s with a WebhookFailure row when processing throws", async () => {
    ingestResendEvent.mockRejectedValue(new Error("Resend 500"));
    const res = await POST(signedRequest(EVENT));
    expect(res.status).toBe(200);
    expect((await res.json()) as unknown).toMatchObject({
      ok: false,
      status: "failed",
    });
    expect(recordWebhookFailure).toHaveBeenCalledWith({
      provider: "resend",
      externalId: "9f1c2f7a-2f18-4a3a-9a0e-1f0c4a6d7b21",
      payload: EVENT,
      error: "Resend 500",
    });
  });

  it("200s with a WebhookFailure row when the signed body is not JSON", async () => {
    const res = await POST(signedRequest("not json at all"));
    expect(res.status).toBe(200);
    expect(ingestResendEvent).not.toHaveBeenCalled();
    expect(recordWebhookFailure).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "resend", error: expect.stringMatching(/json/i) }),
    );
  });

  it("still answers 200 when even the failure write fails", async () => {
    ingestResendEvent.mockRejectedValue(new Error("boom"));
    recordWebhookFailure.mockRejectedValue(new Error("db down"));
    const res = await POST(signedRequest(EVENT));
    expect(res.status).toBe(200);
  });

  it("reports an ignored event without recording a failure", async () => {
    ingestResendEvent.mockResolvedValue({
      status: "ignored",
      reason: "auto_reply",
    });
    const res = await POST(signedRequest(EVENT));
    expect(res.status).toBe(200);
    expect((await res.json()) as unknown).toMatchObject({
      ok: true,
      status: "ignored",
      reason: "auto_reply",
    });
    expect(recordWebhookFailure).not.toHaveBeenCalled();
  });

  it("200s with a WebhookFailure row when processing rejects with a plain string", async () => {
    ingestResendEvent.mockRejectedValue("boom");
    const res = await POST(signedRequest(EVENT));
    expect(res.status).toBe(200);
    expect((await res.json()) as unknown).toMatchObject({
      ok: false,
      status: "failed",
    });
    expect(recordWebhookFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "resend",
        error: expect.any(String),
      }),
    );
    const call = recordWebhookFailure.mock.calls[0]?.[0] as { error: string };
    expect(call.error.length).toBeGreaterThan(0);
  });

  it("200s with a WebhookFailure row when processing rejects with a plain object", async () => {
    ingestResendEvent.mockRejectedValue({ code: "ESOCKET" });
    const res = await POST(signedRequest(EVENT));
    expect(res.status).toBe(200);
    expect((await res.json()) as unknown).toMatchObject({
      ok: false,
      status: "failed",
    });
    expect(recordWebhookFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "resend",
        error: expect.any(String),
      }),
    );
    const call = recordWebhookFailure.mock.calls[0]?.[0] as { error: string };
    expect(call.error.length).toBeGreaterThan(0);
  });

  it("413s a request whose declared content-length exceeds the cap", async () => {
    const payload = JSON.stringify(EVENT);
    const id = "msg_2Xk9QmQ1x7pC4bR";
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = signWebhookPayload({ secret: SECRET, id, timestamp, payload });
    const res = await POST(
      new Request("http://admin.test/api/webhooks/resend", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "svix-id": id,
          "svix-timestamp": String(timestamp),
          "svix-signature": signature,
          "content-length": String(1_048_576 + 1),
        },
        body: payload,
      }),
    );
    expect(res.status).toBe(413);
    expect(ingestResendEvent).not.toHaveBeenCalled();
    expect(recordWebhookFailure).not.toHaveBeenCalled();
  });

  it("413s an undeclared oversize body even with a valid signature", async () => {
    const big = "x".repeat(1_048_576 + 1);
    const res = await POST(signedRequest(big));
    expect(res.status).toBe(413);
    expect(ingestResendEvent).not.toHaveBeenCalled();
    expect(recordWebhookFailure).not.toHaveBeenCalled();
  });
});
