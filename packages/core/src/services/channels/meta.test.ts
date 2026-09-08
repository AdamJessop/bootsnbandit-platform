import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_META_GRAPH_VERSION,
  isAllowedMetaAttachmentUrl,
  isWindowGraphError,
  isWithinSendWindow,
  MAX_META_MESSAGE_CHARS,
  metaGraphUrl,
  metaGraphVersion,
  META_SEND_WINDOW_MS,
  parseMetaWebhook,
  signMetaPayload,
  singleEventBody,
  splitOutboundText,
  verifyHubChallenge,
  verifyMetaSignature,
} from "./meta";
import messengerText from "./__fixtures__/meta-messenger-text.json";
import messengerImage from "./__fixtures__/meta-messenger-image.json";
import instagramText from "./__fixtures__/meta-instagram-text.json";
import echo from "./__fixtures__/meta-echo.json";
import delivery from "./__fixtures__/meta-delivery.json";
import postback from "./__fixtures__/meta-postback.json";

const APP_SECRET = "synthetic-app-secret-not-a-real-one";

describe("verifyMetaSignature", () => {
  const payload = JSON.stringify(messengerText);

  it("accepts the signature Meta documents (sha256=<hex> over the raw body)", () => {
    const expected = `sha256=${createHmac("sha256", APP_SECRET).update(payload, "utf8").digest("hex")}`;
    expect(signMetaPayload(APP_SECRET, payload)).toBe(expected);
    expect(
      verifyMetaSignature({ appSecret: APP_SECRET, payload, header: expected }),
    ).toEqual({ ok: true });
  });

  it("rejects a body that changed by a single byte", () => {
    const header = signMetaPayload(APP_SECRET, payload);
    expect(
      verifyMetaSignature({ appSecret: APP_SECRET, payload: `${payload} `, header }),
    ).toEqual({ ok: false, reason: "no_match" });
  });

  it("rejects the wrong secret", () => {
    const header = signMetaPayload("other-secret", payload);
    expect(
      verifyMetaSignature({ appSecret: APP_SECRET, payload, header }),
    ).toEqual({ ok: false, reason: "no_match" });
  });

  it("names why it refused, without leaking anything", () => {
    expect(
      verifyMetaSignature({ appSecret: "", payload, header: "sha256=aa" }),
    ).toEqual({ ok: false, reason: "no_secret" });
    expect(
      verifyMetaSignature({ appSecret: APP_SECRET, payload, header: null }),
    ).toEqual({ ok: false, reason: "missing_header" });
    expect(
      verifyMetaSignature({ appSecret: APP_SECRET, payload, header: "sha1=deadbeef" }),
    ).toEqual({ ok: false, reason: "bad_format" });
    expect(
      verifyMetaSignature({ appSecret: APP_SECRET, payload, header: "sha256=nothex" }),
    ).toEqual({ ok: false, reason: "bad_format" });
  });
});

describe("verifyHubChallenge", () => {
  function params(o: Record<string, string>): URLSearchParams {
    return new URLSearchParams(o);
  }

  it("echoes the challenge for a correct subscribe handshake", () => {
    expect(
      verifyHubChallenge(
        params({
          "hub.mode": "subscribe",
          "hub.verify_token": "tok",
          "hub.challenge": "1158201444",
        }),
        "tok",
      ),
    ).toEqual({ ok: true, challenge: "1158201444" });
  });

  it("refuses a wrong token, a wrong mode, a missing challenge, or no config", () => {
    const good = {
      "hub.mode": "subscribe",
      "hub.verify_token": "tok",
      "hub.challenge": "1",
    };
    expect(verifyHubChallenge(params(good), "other")).toEqual({
      ok: false,
      reason: "bad_token",
    });
    expect(
      verifyHubChallenge(params({ ...good, "hub.mode": "unsubscribe" }), "tok"),
    ).toEqual({ ok: false, reason: "bad_mode" });
    expect(
      verifyHubChallenge(
        params({ "hub.mode": "subscribe", "hub.verify_token": "tok" }),
        "tok",
      ),
    ).toEqual({ ok: false, reason: "no_challenge" });
    expect(verifyHubChallenge(params(good), null)).toEqual({
      ok: false,
      reason: "not_configured",
    });
  });
});

describe("parseMetaWebhook", () => {
  it("reads a Messenger text message", () => {
    const [event, ...rest] = parseMetaWebhook(messengerText);
    expect(rest).toHaveLength(0);
    expect(event).toMatchObject({
      object: "page",
      channel: "messenger",
      entryId: "102938475610293",
      senderId: "7213456789012345",
      recipientId: "102938475610293",
      customerId: "7213456789012345",
      mid: "m_AbC0dEf1GhI2jKl3MnO4pQ",
      text: "Hiya, do you have any space for a small linework piece?",
      isEcho: false,
      kind: "message",
      attachments: [],
    });
    expect(event.timestamp.toISOString()).toBe("2026-09-08T20:00:00.000Z");
  });

  it("reads an Instagram message as the instagram channel", () => {
    const [event] = parseMetaWebhook(instagramText);
    expect(event).toMatchObject({
      object: "instagram",
      channel: "instagram",
      entryId: "17841400000000000",
      senderId: "6011223344556677",
      customerId: "6011223344556677",
      kind: "message",
    });
  });

  it("keeps attachment type and url, in order", () => {
    const [event] = parseMetaWebhook(messengerImage);
    expect(event.attachments).toEqual([
      {
        type: "image",
        url: "https://scontent.xx.fbcdn.net/v/t1.0-9/synthetic-reference.jpg",
      },
      { type: "file", url: "https://lookaside.fbsbx.com/synthetic/brief.pdf" },
    ]);
  });

  it("reads an Instagram share / story mention without throwing", () => {
    // Instagram sends attachment types Messenger never does, sometimes with no
    // payload url at all. They are not images and must not become one; the
    // point is that the parser keeps the type word and carries on.
    const [event] = parseMetaWebhook({
      object: "instagram",
      entry: [
        {
          id: "17841400000000000",
          time: 1788000000000,
          messaging: [
            {
              sender: { id: "6011223344556677" },
              recipient: { id: "17841400000000000" },
              timestamp: 1788000000000,
              message: {
                mid: "m_ig_share_1",
                attachments: [
                  { type: "share", payload: { url: "https://l.instagram.com/x" } },
                  { type: "story_mention", payload: {} },
                ],
              },
            },
          ],
        },
      ],
    });
    expect(event.kind).toBe("message");
    expect(event.text).toBeNull();
    expect(event.attachments).toEqual([
      { type: "share", url: "https://l.instagram.com/x" },
      { type: "story_mention", url: null },
    ]);
    // Neither is an image, so neither can ever be fetched as one.
    expect(event.attachments.every((a) => a.type !== "image")).toBe(true);
  });

  it("flags an echo and reports the CUSTOMER as the recipient side", () => {
    const [event] = parseMetaWebhook(echo);
    expect(event).toMatchObject({
      isEcho: true,
      senderId: "102938475610293",
      recipientId: "7213456789012345",
      // The customer is who we are threading against — on an echo that is the
      // recipient, not the sender (the sender is our own Page).
      customerId: "7213456789012345",
      kind: "message",
    });
  });

  it("classifies receipts and postbacks so the caller can ignore them", () => {
    expect(parseMetaWebhook(delivery).map((e) => e.kind)).toEqual([
      "receipt",
      "receipt",
    ]);
    expect(parseMetaWebhook(postback).map((e) => e.kind)).toEqual(["postback"]);
  });

  it("returns nothing for junk instead of throwing", () => {
    expect(parseMetaWebhook(null)).toEqual([]);
    expect(parseMetaWebhook({})).toEqual([]);
    expect(parseMetaWebhook({ object: "user", entry: [] })).toEqual([]);
    expect(parseMetaWebhook({ object: "page", entry: "nope" })).toEqual([]);
    expect(
      parseMetaWebhook({ object: "page", entry: [{ id: 5, messaging: [{}] }] }),
    ).toEqual([]);
  });

  it("rebuilds a replayable single-event body", () => {
    const [event] = parseMetaWebhook(messengerText);
    const body = singleEventBody(event);
    const [again] = parseMetaWebhook(body);
    expect(again).toMatchObject({
      mid: event.mid,
      senderId: event.senderId,
      entryId: event.entryId,
      channel: "messenger",
    });
  });
});

describe("isAllowedMetaAttachmentUrl", () => {
  it("allows Meta's own CDN hosts over https", () => {
    for (const url of [
      "https://scontent.xx.fbcdn.net/v/t1.0-9/x.jpg",
      "https://scontent-lhr8-1.xx.fbcdn.net/v/x.jpg",
      "https://instagram.flhr1-2.fna.cdninstagram.com/v/x.jpg",
      "https://lookaside.fbsbx.com/synthetic/brief.pdf",
    ]) {
      expect(isAllowedMetaAttachmentUrl(url)).toBe(true);
    }
  });

  it("refuses anything that is not one of those hosts, over any scheme", () => {
    for (const url of [
      "http://scontent.xx.fbcdn.net/v/x.jpg",
      "https://evil.test/x.jpg",
      "https://notfbcdn.net/x.jpg",
      "https://fbcdn.net.evil.test/x.jpg",
      "https://user:pass@scontent.xx.fbcdn.net/x.jpg",
      "https://scontent.xx.fbcdn.net:8080/x.jpg",
      "http://169.254.169.254/latest/meta-data/",
      "file:///etc/passwd",
      "not a url",
      "",
      null,
    ]) {
      expect(isAllowedMetaAttachmentUrl(url)).toBe(false);
    }
  });
});

describe("splitOutboundText", () => {
  it("leaves a short message alone", () => {
    expect(splitOutboundText("  Hello  ")).toEqual(["Hello"]);
    expect(splitOutboundText("   ")).toEqual([]);
  });

  it("splits past the 2000-character limit on a word boundary", () => {
    const word = "reference ";
    const text = word.repeat(300); // 3000 chars
    const parts = splitOutboundText(text);
    expect(parts.length).toBe(2);
    for (const part of parts) {
      expect(part.length).toBeLessThanOrEqual(MAX_META_MESSAGE_CHARS);
    }
    expect(parts.join(" ").replace(/\s+/g, " ").trim()).toBe(
      text.replace(/\s+/g, " ").trim(),
    );
  });

  it("hard-cuts a single unbroken run rather than looping forever", () => {
    const parts = splitOutboundText("x".repeat(4500), 2000);
    expect(parts.map((p) => p.length)).toEqual([2000, 2000, 500]);
  });
});

describe("graph version + url", () => {
  it("defaults, and accepts a valid override", () => {
    expect(metaGraphVersion({} as NodeJS.ProcessEnv)).toBe(
      DEFAULT_META_GRAPH_VERSION,
    );
    expect(
      metaGraphVersion({ META_GRAPH_VERSION: "v22.0" } as NodeJS.ProcessEnv),
    ).toBe("v22.0");
  });

  it("ignores a nonsense override rather than building a broken URL", () => {
    expect(
      metaGraphVersion({
        META_GRAPH_VERSION: "../../danger",
      } as NodeJS.ProcessEnv),
    ).toBe(DEFAULT_META_GRAPH_VERSION);
  });

  it("builds an absolute graph.facebook.com URL", () => {
    expect(metaGraphUrl("102938475610293/messages", {} as NodeJS.ProcessEnv)).toBe(
      `https://graph.facebook.com/${DEFAULT_META_GRAPH_VERSION}/102938475610293/messages`,
    );
  });
});

describe("the 24-hour messaging window", () => {
  const now = new Date("2026-09-08T12:00:00Z");

  it("is open inside 24 hours of the last inbound message", () => {
    expect(
      isWithinSendWindow(new Date(now.getTime() - META_SEND_WINDOW_MS + 1000), now),
    ).toBe(true);
  });

  it("is shut past it, and shut when nothing ever came in", () => {
    expect(
      isWithinSendWindow(new Date(now.getTime() - META_SEND_WINDOW_MS - 1000), now),
    ).toBe(false);
    expect(isWithinSendWindow(null, now)).toBe(false);
  });

  it("recognises Graph's own window rejection", () => {
    expect(isWindowGraphError({ code: 10, error_subcode: 2018278 })).toBe(true);
    expect(isWindowGraphError({ code: 10 })).toBe(true);
    expect(isWindowGraphError({ error_subcode: 2018278 })).toBe(true);
    // 551 "this person isn't available right now" is the same verdict wearing
    // a different number, and staff can only do the same thing about it.
    expect(isWindowGraphError({ code: 551 })).toBe(true);
    expect(isWindowGraphError({ code: 190 })).toBe(false);
    expect(isWindowGraphError(null)).toBe(false);
  });
});
