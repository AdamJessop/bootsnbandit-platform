import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isEmailReceivedEvent,
  MAX_BODY_HTML_CHARS,
  MAX_BODY_TEXT_CHARS,
  MAX_INBOUND_ATTACHMENTS,
  MAX_INLINE_TOTAL_BYTES,
  parseResendInbound,
  resendInboundDeps,
  type ResendAttachmentLink,
  type ResendInboundDeps,
  type ResendInboundEmail,
  type ResendReceivedEvent,
} from "./email";

// The outbound half talks to Prisma and to the shared sendEmail; both are
// stubbed here so this file stays a pure unit suite (vi.mock is hoisted, so
// the factories are registered before ./email above is evaluated).
const sendEmail = vi.fn();
const findUnique = vi.fn();
vi.mock("@bnb/core/email", () => ({
  sendEmail: (...a: unknown[]) => sendEmail(...a),
}));
vi.mock("@bnb/core/db", () => ({
  prisma: { enquiry: { findUnique: (...a: unknown[]) => findUnique(...a) } },
}));

/**
 * parseResendInbound turns a Resend `email.received` event into everything
 * recordInbound needs. The fixtures are the SDK's documented response shapes;
 * the three network calls are injected, so this suite is pure.
 */

function fixture<T>(name: string): T {
  return JSON.parse(
    readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), "utf8"),
  ) as T;
}

const EVENT = fixture<ResendReceivedEvent>("resend-email-received.json");
const EMAIL = fixture<ResendInboundEmail>("resend-inbound-email.json");
const ATTACHMENTS = fixture<{ data: ResendAttachmentLink[] }>(
  "resend-inbound-attachments.json",
);

const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4,
]);
const NOT_AN_IMAGE = new Uint8Array([0x3c, 0x73, 0x76, 0x67, 0x20]); // "<svg "

const ORIGINAL_DOMAIN = process.env.INBOUND_EMAIL_DOMAIN;

function deps(overrides: Partial<ResendInboundDeps> = {}): ResendInboundDeps {
  return {
    getEmail: vi.fn(async () => structuredClone(EMAIL)),
    listAttachments: vi.fn(async () => structuredClone(ATTACHMENTS.data)),
    download: vi.fn(async () => PNG),
    ...overrides,
  };
}

beforeEach(() => {
  process.env.INBOUND_EMAIL_DOMAIN = "mail.bootsnbandit.test";
});

afterEach(() => {
  if (ORIGINAL_DOMAIN === undefined) delete process.env.INBOUND_EMAIL_DOMAIN;
  else process.env.INBOUND_EMAIL_DOMAIN = ORIGINAL_DOMAIN;
  vi.restoreAllMocks();
});

describe("isEmailReceivedEvent", () => {
  it("accepts the fixture and rejects everything else", () => {
    expect(isEmailReceivedEvent(EVENT)).toBe(true);
    expect(
      isEmailReceivedEvent({
        type: "email.delivered",
        data: { email_id: "x" },
      }),
    ).toBe(false);
    expect(isEmailReceivedEvent({ type: "email.received", data: {} })).toBe(
      false,
    );
    expect(isEmailReceivedEvent(null)).toBe(false);
    expect(isEmailReceivedEvent("email.received")).toBe(false);
  });

  it("rejects an email_id that is not a plain provider id", () => {
    // The id is interpolated into the Resend API path — a traversal or an
    // absurd length must never get that far.
    expect(
      isEmailReceivedEvent({
        type: "email.received",
        data: { email_id: "../../domains" },
      }),
    ).toBe(false);
    expect(
      isEmailReceivedEvent({
        type: "email.received",
        data: { email_id: "a".repeat(129) },
      }),
    ).toBe(false);
    expect(
      isEmailReceivedEvent({
        type: "email.received",
        data: { email_id: "9f1c2f7a-2f18-4a3a-9a0e-1f0c4a6d7b21" },
      }),
    ).toBe(true);
  });
});

describe("parseResendInbound", () => {
  it("normalises the sender, recipients, subject and timestamps", async () => {
    const parsed = await parseResendInbound(EVENT, deps());
    expect(parsed.externalId).toBe("9f1c2f7a-2f18-4a3a-9a0e-1f0c4a6d7b21");
    expect(parsed.fromAddress).toBe("amy.jones@example.com");
    expect(parsed.fromName).toBe("Amy Jones");
    expect(parsed.toAddresses).toEqual([
      "enq-clw9k2x0a0001qq3f8h2m5t7z@mail.bootsnbandit.test",
    ]);
    expect(parsed.ccAddresses).toEqual(["hello@bootsnbandit.test"]);
    expect(parsed.subject).toBe("Re: Sleeve idea");
    expect(parsed.messageId).toBe("<CAF7n8Qk9m0v2s7YfQ@mail.gmail.com>");
    expect(parsed.receivedAt.toISOString()).toBe("2026-09-08T09:14:01.902Z");
    expect(parsed.autoSubmitted).toBe(false);
  });

  it("reads the thread token off the reply address", async () => {
    const parsed = await parseResendInbound(EVENT, deps());
    expect(parsed.threadToken).toBe("clw9k2x0a0001qq3f8h2m5t7z");
  });

  it("falls back to the References header when the token is not a recipient", async () => {
    const email = structuredClone(EMAIL);
    email.to = ["hello@bootsnbandit.test"];
    email.cc = null;
    email.headers = {
      References:
        "<0100019255ab@resend.dev> <enq-clw9k2x0a0001qq3f8h2m5t7z@mail.bootsnbandit.test>",
    };
    const parsed = await parseResendInbound(
      EVENT,
      deps({ getEmail: vi.fn(async () => email) }),
    );
    expect(parsed.threadToken).toBe("clw9k2x0a0001qq3f8h2m5t7z");
  });

  it("has no token when nothing addresses our domain", async () => {
    const email = structuredClone(EMAIL);
    email.to = ["hello@bootsnbandit.test"];
    email.cc = null;
    email.headers = null;
    const parsed = await parseResendInbound(
      EVENT,
      deps({ getEmail: vi.fn(async () => email) }),
    );
    expect(parsed.threadToken).toBeNull();
  });

  it("strips the quoted history from bodyText but keeps the full html", async () => {
    const parsed = await parseResendInbound(EVENT, deps());
    expect(parsed.bodyText).toBe("Tuesday works for me, reference attached.");
    expect(parsed.bodyText).not.toContain("wrote:");
    expect(parsed.bodyHtml).toContain("gmail_quote");
  });

  it("derives text from the html when the email is html-only", async () => {
    const email = structuredClone(EMAIL);
    email.text = null;
    const parsed = await parseResendInbound(
      EVENT,
      deps({ getEmail: vi.fn(async () => email) }),
    );
    expect(parsed.bodyText).toBe("Tuesday works for me, reference attached.");
  });

  it("never leaves an empty body", async () => {
    const email = structuredClone(EMAIL);
    email.text = "   ";
    email.html = null;
    const parsed = await parseResendInbound(
      EVENT,
      deps({ getEmail: vi.fn(async () => email) }),
    );
    expect(parsed.bodyText).toBe("(no message body)");
  });

  it("truncates a huge plain-text body and marks the cut", async () => {
    const email = structuredClone(EMAIL);
    email.text = "z".repeat(100_000);
    email.html = null;
    const parsed = await parseResendInbound(
      EVENT,
      deps({ getEmail: vi.fn(async () => email) }),
    );
    expect(parsed.bodyText.length).toBeLessThanOrEqual(
      MAX_BODY_TEXT_CHARS + 20,
    );
    expect(parsed.bodyText.startsWith("z".repeat(1000))).toBe(true);
    expect(parsed.bodyText.endsWith("[… truncated]")).toBe(true);
  });

  it("drops an oversize html body but still derives text from it", async () => {
    const email = structuredClone(EMAIL);
    email.text = null;
    email.html = `<p>Tuesday works for me.</p><p>${"y".repeat(
      MAX_BODY_HTML_CHARS + 1,
    )}</p>`;
    const parsed = await parseResendInbound(
      EVENT,
      deps({ getEmail: vi.fn(async () => email) }),
    );
    expect(parsed.bodyHtml).toBeNull();
    expect(parsed.bodyText.startsWith("Tuesday works for me.")).toBe(true);
  });

  it("flags an auto-reply so the caller can drop it", async () => {
    const email = structuredClone(EMAIL);
    email.headers = { "Auto-Submitted": "auto-replied" };
    const parsed = await parseResendInbound(
      EVENT,
      deps({ getEmail: vi.fn(async () => email) }),
    );
    expect(parsed.autoSubmitted).toBe(true);
  });

  it("stores an image inline under the SNIFFED mime and links the rest", async () => {
    const download = vi.fn(async () => PNG);
    const parsed = await parseResendInbound(EVENT, deps({ download }));
    expect(parsed.attachments).toHaveLength(2);

    const [image, pdf] = parsed.attachments;
    expect(image.mime).toBe("image/png");
    expect(image.filename).toBe("reference.png");
    expect(image.bytes).toEqual(PNG);
    expect(image.url).toBeUndefined();

    expect(pdf.mime).toBe("application/pdf");
    expect(pdf.bytes).toBeUndefined();
    expect(pdf.url).toBe(
      "https://attachments.resend.test/att_01HZX9Q0000000000000000002?sig=def",
    );
    // Only the image was downloaded — the 240 KB PDF stays a link.
    expect(download).toHaveBeenCalledTimes(1);
  });

  it("trusts the sniff, not the declared type: a lying image becomes a link", async () => {
    const parsed = await parseResendInbound(
      EVENT,
      deps({ download: vi.fn(async () => NOT_AN_IMAGE) }),
    );
    const image = parsed.attachments[0];
    expect(image.bytes).toBeUndefined();
    expect(image.url).toContain("att_01HZX9Q0000000000000000001");
  });

  it("re-labels an image whose declared type is wrong with the sniffed one", async () => {
    const email = structuredClone(EMAIL);
    email.attachments[0].content_type = "image/jpeg";
    const links = structuredClone(ATTACHMENTS.data);
    links[0].content_type = "image/jpeg";
    const parsed = await parseResendInbound(
      EVENT,
      deps({
        getEmail: vi.fn(async () => email),
        listAttachments: vi.fn(async () => links),
      }),
    );
    expect(parsed.attachments[0].mime).toBe("image/png");
  });

  it("links an oversize image instead of downloading it", async () => {
    const email = structuredClone(EMAIL);
    email.attachments[0].size = 9 * 1024 * 1024;
    const download = vi.fn(async () => PNG);
    const parsed = await parseResendInbound(
      EVENT,
      deps({ getEmail: vi.fn(async () => email), download }),
    );
    expect(download).not.toHaveBeenCalled();
    expect(parsed.attachments[0].bytes).toBeUndefined();
    expect(parsed.attachments[0].url).toContain("att_01HZX9Q");
  });

  it("survives a failed attachment listing and a failed download", async () => {
    const noLinks = await parseResendInbound(
      EVENT,
      deps({
        listAttachments: vi.fn(async () => {
          throw new Error("attachment API down");
        }),
      }),
    );
    // Nothing reachable, so nothing recorded — never a row with neither
    // bytes nor url.
    expect(noLinks.attachments).toEqual([]);

    const noBytes = await parseResendInbound(
      EVENT,
      deps({ download: vi.fn(async () => null) }),
    );
    expect(noBytes.attachments[0].bytes).toBeUndefined();
    expect(noBytes.attachments[0].url).toContain("att_01HZX9Q");
  });

  it("propagates a failed email fetch so the caller records a WebhookFailure", async () => {
    await expect(
      parseResendInbound(
        EVENT,
        deps({
          getEmail: vi.fn(async () => {
            throw new Error("Resend 500");
          }),
        }),
      ),
    ).rejects.toThrow(/Resend 500/);
  });
});

/**
 * Hostile and degenerate inputs. Inbound mail is attacker-shaped by default:
 * the recipient list, the headers and the declared content types all come
 * from the sender.
 */
describe("parseResendInbound — hostile inputs", () => {
  it("finds the token when it is only in Cc", async () => {
    const email = structuredClone(EMAIL);
    email.to = ["hello@bootsnbandit.test"];
    email.cc = ["enq-clw9k2x0a0001qq3f8h2m5t7z@mail.bootsnbandit.test"];
    const parsed = await parseResendInbound(
      EVENT,
      deps({ getEmail: vi.fn(async () => email) }),
    );
    expect(parsed.threadToken).toBe("clw9k2x0a0001qq3f8h2m5t7z");
  });

  it("takes the first To token when several thread tokens are addressed", async () => {
    const email = structuredClone(EMAIL);
    email.to = [
      "enq-clw9k2x0a0001qq3f8h2m5t7z@mail.bootsnbandit.test",
      "enq-zzzzzzzzzzzzzzzzzzzzzzzzz@mail.bootsnbandit.test",
    ];
    email.cc = ["enq-yyyyyyyyyyyyyyyyyyyyyyyyy@mail.bootsnbandit.test"];
    const parsed = await parseResendInbound(
      EVENT,
      deps({ getEmail: vi.fn(async () => email) }),
    );
    expect(parsed.threadToken).toBe("clw9k2x0a0001qq3f8h2m5t7z");
  });

  it("ignores a token minted on somebody else's domain", async () => {
    const email = structuredClone(EMAIL);
    email.to = ["enq-clw9k2x0a0001qq3f8h2m5t7z@mail.evil.test"];
    email.cc = null;
    email.headers = null;
    const parsed = await parseResendInbound(
      EVENT,
      deps({ getEmail: vi.fn(async () => email) }),
    );
    expect(parsed.threadToken).toBeNull();
  });

  it("flags mail sent from our own inbound domain as a loop", async () => {
    const email = structuredClone(EMAIL);
    email.from = "Sarah at Boots 'n' Bandit <enquiries@mail.bootsnbandit.test>";
    const parsed = await parseResendInbound(
      EVENT,
      deps({ getEmail: vi.fn(async () => email) }),
    );
    expect(parsed.autoSubmitted).toBe(true);
  });

  it("flags our own mail by EMAIL_FROM when no inbound domain is configured", async () => {
    const originalFrom = process.env.EMAIL_FROM;
    delete process.env.INBOUND_EMAIL_DOMAIN;
    process.env.EMAIL_FROM = "Boots 'n' Bandit <hello@studio.test>";
    try {
      const email = structuredClone(EMAIL);
      email.from = "Boots 'n' Bandit <hello@studio.test>";
      const parsed = await parseResendInbound(
        EVENT,
        deps({ getEmail: vi.fn(async () => email) }),
      );
      expect(parsed.autoSubmitted).toBe(true);

      const other = structuredClone(EMAIL);
      other.from = "Amy Jones <amy@example.com>";
      const outside = await parseResendInbound(
        EVENT,
        deps({ getEmail: vi.fn(async () => other) }),
      );
      expect(outside.autoSubmitted).toBe(false);
    } finally {
      if (originalFrom === undefined) delete process.env.EMAIL_FROM;
      else process.env.EMAIL_FROM = originalFrom;
    }
  });

  it("copes with a near-empty email: no subject, headers, cc or attachments", async () => {
    const email = {
      ...structuredClone(EMAIL),
      subject: "",
      cc: null,
      bcc: null,
      headers: null,
      message_id: "",
      attachments: [],
    } as ResendInboundEmail;
    const listAttachments = vi.fn(async () =>
      structuredClone(ATTACHMENTS.data),
    );
    const parsed = await parseResendInbound(
      EVENT,
      deps({ getEmail: vi.fn(async () => email), listAttachments }),
    );
    expect(parsed.subject).toBeNull();
    expect(parsed.ccAddresses).toEqual([]);
    expect(parsed.attachments).toEqual([]);
    // No attachment metadata means the listing call is never made.
    expect(listAttachments).not.toHaveBeenCalled();
    // Falls back to the event's message_id when the email carries none.
    expect(parsed.messageId).toBe("<CAF7n8Qk9m0v2s7YfQ@mail.gmail.com>");
  });

  it("falls back to now when every timestamp is missing or unparseable", async () => {
    const email = structuredClone(EMAIL);
    email.created_at = "not a date";
    const event = structuredClone(EVENT);
    delete event.data.created_at;
    delete event.created_at;
    const before = Date.now();
    const parsed = await parseResendInbound(
      event,
      deps({ getEmail: vi.fn(async () => email) }),
    );
    expect(parsed.receivedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(Number.isNaN(parsed.receivedAt.getTime())).toBe(false);
  });

  it("has a null fromName when the sender has no display name", async () => {
    const email = structuredClone(EMAIL);
    email.from = "amy.jones@example.com";
    const parsed = await parseResendInbound(
      EVENT,
      deps({ getEmail: vi.fn(async () => email) }),
    );
    expect(parsed.fromName).toBeNull();
    expect(parsed.fromAddress).toBe("amy.jones@example.com");
  });

  it("throws when the From header cannot be parsed at all", async () => {
    const email = structuredClone(EMAIL);
    email.from = "not-an-address";
    const event = structuredClone(EVENT);
    event.data.from = "also not an address";
    await expect(
      parseResendInbound(event, deps({ getEmail: vi.fn(async () => email) })),
    ).rejects.toThrow(/unparseable From/i);
  });

  it("caps a mail bomb at MAX_INBOUND_ATTACHMENTS", async () => {
    const count = MAX_INBOUND_ATTACHMENTS + 5;
    const email = structuredClone(EMAIL);
    email.attachments = Array.from({ length: count }, (_, i) => ({
      id: `att_${i}`,
      filename: `doc-${i}.pdf`,
      size: 1024,
      content_type: "application/pdf",
      content_id: null,
      content_disposition: "attachment",
    }));
    const links: ResendAttachmentLink[] = email.attachments.map((a) => ({
      id: a.id,
      filename: a.filename,
      size: a.size,
      content_type: a.content_type,
      download_url: `https://attachments.resend.test/${a.id}`,
    }));
    const parsed = await parseResendInbound(
      EVENT,
      deps({
        getEmail: vi.fn(async () => email),
        listAttachments: vi.fn(async () => links),
      }),
    );
    expect(parsed.attachments).toHaveLength(MAX_INBOUND_ATTACHMENTS);
  });

  it("stops inlining once the per-email byte budget is spent", async () => {
    const each = 7 * 1024 * 1024;
    expect(each * 2).toBeLessThanOrEqual(MAX_INLINE_TOTAL_BYTES);
    expect(each * 3).toBeGreaterThan(MAX_INLINE_TOTAL_BYTES);

    const email = structuredClone(EMAIL);
    email.attachments = [0, 1, 2].map((i) => ({
      id: `att_big_${i}`,
      filename: `big-${i}.png`,
      size: each,
      content_type: "image/png",
      content_id: null,
      content_disposition: "attachment",
    }));
    const links: ResendAttachmentLink[] = email.attachments.map((a) => ({
      id: a.id,
      filename: a.filename,
      size: a.size,
      content_type: a.content_type,
      download_url: `https://attachments.resend.test/${a.id}`,
    }));
    const download = vi.fn(async () => PNG);
    const parsed = await parseResendInbound(
      EVENT,
      deps({
        getEmail: vi.fn(async () => email),
        listAttachments: vi.fn(async () => links),
        download,
      }),
    );

    expect(download).toHaveBeenCalledTimes(2);
    expect(parsed.attachments[0].bytes).toBeTruthy();
    expect(parsed.attachments[1].bytes).toBeTruthy();
    expect(parsed.attachments[2].bytes).toBeFalsy();
    expect(parsed.attachments[2].url).toBe(
      "https://attachments.resend.test/att_big_2",
    );
  });

  it("drops an attachment that has no download link at all", async () => {
    const parsed = await parseResendInbound(
      EVENT,
      // Only the PDF comes back with a link; the image is unreachable.
      deps({
        listAttachments: vi.fn(async () =>
          structuredClone(ATTACHMENTS.data).slice(1),
        ),
      }),
    );
    expect(parsed.attachments).toHaveLength(1);
    expect(parsed.attachments[0].filename).toBe("consent.pdf");
  });

  it("normalises a parameterised content type and defaults a missing one", async () => {
    const email = structuredClone(EMAIL);
    email.attachments[1].content_type = "Application/PDF; name=consent.pdf";
    const links = structuredClone(ATTACHMENTS.data);
    links[1].content_type = "Application/PDF; name=consent.pdf";
    const parsed = await parseResendInbound(
      EVENT,
      deps({
        getEmail: vi.fn(async () => email),
        listAttachments: vi.fn(async () => links),
      }),
    );
    expect(parsed.attachments[1].mime).toBe("application/pdf");
  });

  it("links rather than inlines when the download itself throws", async () => {
    const parsed = await parseResendInbound(
      EVENT,
      deps({
        download: vi.fn(async () => {
          throw new Error("socket hang up");
        }),
      }),
    );
    expect(parsed.attachments[0].bytes).toBeUndefined();
    expect(parsed.attachments[0].url).toContain("att_01HZX9Q");
  });

  it("finds no token at all when the inbound domain is unconfigured", async () => {
    delete process.env.INBOUND_EMAIL_DOMAIN;
    const parsed = await parseResendInbound(EVENT, deps());
    expect(parsed.threadToken).toBeNull();
    expect(parsed.autoSubmitted).toBe(false);
  });
});

/**
 * resendInboundDeps().download streams the body itself rather than trusting
 * Content-Length, so a host that omits or lies about that header can't force
 * an unbounded buffer. `fetchImpl` is injected so these never touch a socket.
 */
describe("resendInboundDeps().download", () => {
  function streamResponse(
    chunks: Uint8Array[],
    init: ResponseInit = {},
  ): Response {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(chunk);
        controller.close();
      },
    });
    return new Response(stream, init);
  }

  it("degrades to no bytes when a content-length-less stream exceeds the cap", async () => {
    const chunks = [new Uint8Array(6), new Uint8Array(6)]; // 12 bytes total
    const fetchImpl = vi.fn(async () => streamResponse(chunks));
    const bytes = await resendInboundDeps(
      fetchImpl as unknown as typeof fetch,
    ).download("https://attachments.resend.test/big", 10);
    expect(bytes).toBeNull();
  });

  it("stores the bytes when the streamed body is under the cap", async () => {
    const chunks = [
      new Uint8Array([1, 2, 3]),
      new Uint8Array([4, 5, 6, 7]),
    ];
    const fetchImpl = vi.fn(async () => streamResponse(chunks));
    const bytes = await resendInboundDeps(
      fetchImpl as unknown as typeof fetch,
    ).download("https://attachments.resend.test/small", 100);
    expect(bytes).toEqual(new Uint8Array([1, 2, 3, 4, 5, 6, 7]));
  });
});

describe("loadEnquiryEmailContext", () => {
  it("flattens the enquiry, its artist and its last inbound message", async () => {
    const { loadEnquiryEmailContext } = await import("./email");
    findUnique.mockResolvedValue({
      id: "e1",
      threadToken: "tok123456",
      customerId: "c1",
      contactName: "Amy Jones",
      contactEmail: "amy@example.com",
      subject: "Sleeve idea",
      preferredArtist: { name: "Sarah North" },
      messages: [
        {
          channel: "email",
          subject: "Re: Sleeve idea",
          messageIdHeader: "<abc@x.test>",
        },
      ],
    });
    expect(await loadEnquiryEmailContext("e1")).toEqual({
      enquiryId: "e1",
      threadToken: "tok123456",
      customerId: "c1",
      contactName: "Amy Jones",
      contactEmail: "amy@example.com",
      subject: "Sleeve idea",
      artistName: "Sarah North",
      lastInboundChannel: "email",
      lastInboundMessageId: "<abc@x.test>",
      lastInboundSubject: "Re: Sleeve idea",
    });
  });

  it("nulls the last-inbound fields when the thread has none, and 404s cleanly", async () => {
    const { loadEnquiryEmailContext } = await import("./email");
    findUnique.mockResolvedValue({
      id: "e1",
      threadToken: "tok123456",
      customerId: null,
      contactName: "Amy",
      contactEmail: null,
      subject: null,
      preferredArtist: null,
      messages: [],
    });
    const ctx = await loadEnquiryEmailContext("e1");
    expect(ctx?.artistName).toBeNull();
    expect(ctx?.lastInboundChannel).toBeNull();
    expect(ctx?.lastInboundMessageId).toBeNull();

    findUnique.mockResolvedValue(null);
    expect(await loadEnquiryEmailContext("gone")).toBeNull();
  });

  it("falls back to the last inbound sender, then the CRM address", async () => {
    const { loadEnquiryEmailContext } = await import("./email");
    findUnique.mockResolvedValue({
      id: "e1",
      threadToken: "tok123456",
      customerId: "c1",
      contactName: "Amy",
      contactEmail: null,
      subject: null,
      preferredArtist: null,
      customer: { email: "crm@example.com" },
      messages: [
        {
          channel: "email",
          subject: null,
          messageIdHeader: null,
          fromAddress: "amy@example.com",
        },
      ],
    });
    expect((await loadEnquiryEmailContext("e1"))?.contactEmail).toBe(
      "amy@example.com",
    );

    findUnique.mockResolvedValue({
      id: "e1",
      threadToken: "tok123456",
      customerId: "c1",
      contactName: "Amy",
      contactEmail: null,
      subject: null,
      preferredArtist: null,
      customer: { email: "crm@example.com" },
      messages: [],
    });
    expect((await loadEnquiryEmailContext("e1"))?.contactEmail).toBe(
      "crm@example.com",
    );

    findUnique.mockResolvedValue({
      id: "e1",
      threadToken: "tok123456",
      customerId: null,
      contactName: "Amy",
      contactEmail: null,
      subject: null,
      preferredArtist: null,
      customer: null,
      messages: [{ channel: "web", subject: null, messageIdHeader: null, fromAddress: null }],
    });
    expect((await loadEnquiryEmailContext("e1"))?.contactEmail).toBeNull();
  });
});

describe("sendEnquiryEmail", () => {
  const CONTEXT = {
    enquiryId: "e1",
    threadToken: "tok123456",
    customerId: "c1",
    contactName: "Amy Jones",
    contactEmail: "amy@example.com",
    subject: "Sleeve idea",
    artistName: "Sarah North",
    lastInboundChannel: "email" as const,
    lastInboundMessageId: "<abc@x.test>",
    lastInboundSubject: "Re: Sleeve idea",
  };

  beforeEach(() => {
    sendEmail.mockReset().mockResolvedValue({ id: "m1", status: "sent" });
  });

  it("sends as the artist from the studio address, with the reply token", async () => {
    const { sendEnquiryEmail } = await import("./email");
    const result = await sendEnquiryEmail({
      context: CONTEXT,
      body: "Tuesday works",
      authorUserId: "u1",
      authorDisplayName: "Owner Olive",
    });
    expect(result).toEqual({ id: "m1", status: "sent" });
    expect(sendEmail).toHaveBeenCalledWith({
      to: "amy@example.com",
      type: "staff_reply",
      customerId: "c1",
      enquiryId: "e1",
      authorUserId: "u1",
      from: `"Sarah at Boots 'n' Bandit" <enquiries@mail.bootsnbandit.test>`,
      replyTo: "enq-tok123456@mail.bootsnbandit.test",
      headers: { "In-Reply-To": "<abc@x.test>", References: "<abc@x.test>" },
      data: {
        customerName: "Amy Jones",
        body: "Tuesday works",
        subject: "Re: Sleeve idea",
      },
    });
  });

  it("falls back to the replying staff member's name when no artist is assigned", async () => {
    const { sendEnquiryEmail } = await import("./email");
    await sendEnquiryEmail({
      context: { ...CONTEXT, artistName: null },
      body: "Hi",
      authorUserId: "u1",
      authorDisplayName: "Olive Boots",
    });
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: `"Olive at Boots 'n' Bandit" <enquiries@mail.bootsnbandit.test>`,
      }),
    );
  });

  it("omits the threading headers when there is no inbound message id", async () => {
    const { sendEnquiryEmail } = await import("./email");
    await sendEnquiryEmail({
      context: {
        ...CONTEXT,
        lastInboundMessageId: null,
        lastInboundSubject: null,
      },
      body: "Hi",
      authorUserId: "u1",
    });
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: undefined,
        data: expect.objectContaining({ subject: "Re: Sleeve idea" }),
      }),
    );
  });

  it("falls back to the plain studio identity when no inbound domain is set", async () => {
    delete process.env.INBOUND_EMAIL_DOMAIN;
    const { sendEnquiryEmail } = await import("./email");
    await sendEnquiryEmail({
      context: CONTEXT,
      body: "Hi",
      authorUserId: "u1",
    });
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ from: null, replyTo: null }),
    );
  });

  it("refuses to send to an enquiry with no email address", async () => {
    const { sendEnquiryEmail } = await import("./email");
    await expect(
      sendEnquiryEmail({
        context: { ...CONTEXT, contactEmail: null },
        body: "Hi",
        authorUserId: "u1",
      }),
    ).rejects.toThrow(/no email address/i);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
