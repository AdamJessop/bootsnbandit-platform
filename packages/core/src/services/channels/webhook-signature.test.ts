import { describe, expect, it } from "vitest";
import {
  signWebhookPayload,
  verifyWebhookSignature,
  WEBHOOK_TOLERANCE_SECONDS,
} from "./webhook-signature";

const SECRET = "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw";
const ID = "msg_2Xk9QmQ1x7pC4bR";
const PAYLOAD = JSON.stringify({ type: "email.received", data: { n: 1 } });
const NOW = new Date("2026-09-08T09:14:02.000Z");

function headersFor(overrides: Record<string, string> = {}, at = NOW) {
  const timestamp = Math.floor(at.getTime() / 1000);
  return {
    "svix-id": ID,
    "svix-timestamp": String(timestamp),
    "svix-signature": signWebhookPayload({
      secret: SECRET,
      id: ID,
      timestamp,
      payload: PAYLOAD,
    }),
    ...overrides,
  };
}

describe("signWebhookPayload", () => {
  it("is deterministic and versioned", () => {
    const a = signWebhookPayload({
      secret: SECRET,
      id: ID,
      timestamp: NOW,
      payload: PAYLOAD,
    });
    const b = signWebhookPayload({
      secret: SECRET,
      id: ID,
      timestamp: Math.floor(NOW.getTime() / 1000),
      payload: PAYLOAD,
    });
    expect(a).toBe(b);
    expect(a.startsWith("v1,")).toBe(true);
  });

  it("changes with the id, the timestamp, the body and the secret", () => {
    const base = { secret: SECRET, id: ID, timestamp: NOW, payload: PAYLOAD };
    const sig = signWebhookPayload(base);
    expect(signWebhookPayload({ ...base, id: "other" })).not.toBe(sig);
    expect(
      signWebhookPayload({ ...base, timestamp: new Date(NOW.getTime() + 1000) }),
    ).not.toBe(sig);
    expect(signWebhookPayload({ ...base, payload: `${PAYLOAD} ` })).not.toBe(sig);
    expect(
      signWebhookPayload({ ...base, secret: "whsec_AAAAAAAAAAAAAAAAAAAAAA==" }),
    ).not.toBe(sig);
  });
});

describe("verifyWebhookSignature", () => {
  it("accepts a correctly signed payload", () => {
    expect(
      verifyWebhookSignature({
        secret: SECRET,
        payload: PAYLOAD,
        headers: headersFor(),
        now: NOW,
      }),
    ).toEqual({ ok: true });
  });

  it("accepts a Headers object and the webhook-* header aliases", () => {
    const h = headersFor();
    expect(
      verifyWebhookSignature({
        secret: SECRET,
        payload: PAYLOAD,
        headers: new Headers(h),
        now: NOW,
      }).ok,
    ).toBe(true);
    expect(
      verifyWebhookSignature({
        secret: SECRET,
        payload: PAYLOAD,
        headers: {
          "webhook-id": h["svix-id"],
          "webhook-timestamp": h["svix-timestamp"],
          "webhook-signature": h["svix-signature"],
        },
        now: NOW,
      }).ok,
    ).toBe(true);
  });

  it("accepts one matching signature among several", () => {
    const h = headersFor();
    const many = `v1,ZmFrZQ== ${h["svix-signature"]} v2,ignored`;
    expect(
      verifyWebhookSignature({
        secret: SECRET,
        payload: PAYLOAD,
        headers: { ...h, "svix-signature": many },
        now: NOW,
      }).ok,
    ).toBe(true);
  });

  it("rejects a tampered body, a wrong secret and a wrong id", () => {
    const h = headersFor();
    expect(
      verifyWebhookSignature({
        secret: SECRET,
        payload: `${PAYLOAD} `,
        headers: h,
        now: NOW,
      }),
    ).toEqual({ ok: false, reason: "no_matching_signature" });
    expect(
      verifyWebhookSignature({
        secret: "whsec_AAAAAAAAAAAAAAAAAAAAAA==",
        payload: PAYLOAD,
        headers: h,
        now: NOW,
      }).ok,
    ).toBe(false);
    expect(
      verifyWebhookSignature({
        secret: SECRET,
        payload: PAYLOAD,
        headers: { ...h, "svix-id": "msg_other" },
        now: NOW,
      }).ok,
    ).toBe(false);
  });

  it("rejects missing headers and an unconfigured secret", () => {
    expect(
      verifyWebhookSignature({
        secret: SECRET,
        payload: PAYLOAD,
        headers: {},
        now: NOW,
      }),
    ).toEqual({ ok: false, reason: "missing_headers" });
    expect(
      verifyWebhookSignature({
        secret: "",
        payload: PAYLOAD,
        headers: headersFor(),
        now: NOW,
      }),
    ).toEqual({ ok: false, reason: "no_secret" });
  });

  it("enforces the five-minute replay window in both directions", () => {
    const stale = new Date(NOW.getTime() - (WEBHOOK_TOLERANCE_SECONDS + 5) * 1000);
    expect(
      verifyWebhookSignature({
        secret: SECRET,
        payload: PAYLOAD,
        headers: headersFor({}, stale),
        now: NOW,
      }),
    ).toEqual({ ok: false, reason: "timestamp_too_old" });

    const future = new Date(NOW.getTime() + (WEBHOOK_TOLERANCE_SECONDS + 5) * 1000);
    expect(
      verifyWebhookSignature({
        secret: SECRET,
        payload: PAYLOAD,
        headers: headersFor({}, future),
        now: NOW,
      }),
    ).toEqual({ ok: false, reason: "timestamp_too_new" });

    const edge = new Date(NOW.getTime() - (WEBHOOK_TOLERANCE_SECONDS - 5) * 1000);
    expect(
      verifyWebhookSignature({
        secret: SECRET,
        payload: PAYLOAD,
        headers: headersFor({}, edge),
        now: NOW,
      }).ok,
    ).toBe(true);
  });

  it("rejects a non-numeric timestamp", () => {
    expect(
      verifyWebhookSignature({
        secret: SECRET,
        payload: PAYLOAD,
        headers: { ...headersFor(), "svix-timestamp": "soon" },
        now: NOW,
      }),
    ).toEqual({ ok: false, reason: "bad_timestamp" });
  });

  it("interoperates with Resend's own verifier (standardwebhooks)", async () => {
    // Proves the wire format matches byte for byte. `new Resend()` throws
    // without a key even though verify() makes no request, hence the stub.
    const { Resend } = await import("resend");
    const resend = new Resend("re_test_key_not_used_for_verify");
    const now = new Date();
    const timestamp = Math.floor(now.getTime() / 1000);
    const signature = signWebhookPayload({
      secret: SECRET,
      id: ID,
      timestamp,
      payload: PAYLOAD,
    });
    const event = resend.webhooks.verify({
      payload: PAYLOAD,
      headers: { id: ID, timestamp: String(timestamp), signature },
      webhookSecret: SECRET,
    });
    expect(event.type).toBe("email.received");
  });
});
