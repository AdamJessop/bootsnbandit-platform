import { describe, expect, it } from "vitest";
import {
  firstName,
  formatFromHeader,
  formatMessageId,
  fromDisplayName,
  headerValue,
  htmlToText,
  inboundEmailDomain,
  isAutoSubmitted,
  outboundAddressFor,
  parseAddress,
  parseAddressList,
  replyAddressFor,
  replySubject,
  stripQuotedReply,
  threadTokenFrom,
  tokenFromAddress,
  tokenFromText,
} from "./email-format";

const DOMAIN = "mail.bootsnbandit.test";
const TOKEN = "clw9k2x0a0001qq3f8h2m5t7z";

describe("parseAddress", () => {
  it("splits a display name from the address and lowercases the address", () => {
    expect(parseAddress("Amy Jones <Amy.Jones@Example.COM>")).toEqual({
      name: "Amy Jones",
      address: "amy.jones@example.com",
    });
  });

  it("unquotes and unescapes a quoted display name", () => {
    expect(parseAddress('"Jones, Amy" <amy@example.com>')?.name).toBe(
      "Jones, Amy",
    );
    expect(parseAddress('"Amy \\"AJ\\" Jones" <amy@example.com>')?.name).toBe(
      'Amy "AJ" Jones',
    );
  });

  it("accepts a bare address and rejects junk", () => {
    expect(parseAddress("amy@example.com")).toEqual({
      name: null,
      address: "amy@example.com",
    });
    expect(parseAddress("   ")).toBeNull();
    expect(parseAddress(null)).toBeNull();
    expect(parseAddress("not an address")).toBeNull();
    expect(parseAddress("Amy Jones <not-an-address>")).toBeNull();
  });
});

describe("parseAddressList", () => {
  it("accepts an array as Resend sends it", () => {
    expect(
      parseAddressList(["a@x.test", "Bee <b@x.test>"]).map((p) => p.address),
    ).toEqual(["a@x.test", "b@x.test"]);
  });

  it("splits a comma-joined header without breaking quoted names", () => {
    expect(
      parseAddressList('"Jones, Amy" <a@x.test>, b@x.test').map(
        (p) => p.address,
      ),
    ).toEqual(["a@x.test", "b@x.test"]);
  });

  it("drops unparseable entries instead of throwing", () => {
    expect(parseAddressList(["", "nope", "c@x.test"])).toHaveLength(1);
    expect(parseAddressList(null)).toEqual([]);
  });
});

describe("reply-token addressing", () => {
  it("builds the per-enquiry reply address and the studio send address", () => {
    expect(replyAddressFor(TOKEN, DOMAIN)).toBe(`enq-${TOKEN}@${DOMAIN}`);
    expect(outboundAddressFor(DOMAIN)).toBe(`enquiries@${DOMAIN}`);
  });

  it("reads the token back out, case-insensitively and through a display name", () => {
    expect(tokenFromAddress(`ENQ-${TOKEN}@${DOMAIN.toUpperCase()}`, DOMAIN)).toBe(
      TOKEN,
    );
    expect(
      tokenFromAddress(`Studio <enq-${TOKEN}@${DOMAIN}>`, DOMAIN),
    ).toBe(TOKEN);
  });

  it("tolerates sub-addressing added by a forwarding MTA", () => {
    expect(tokenFromAddress(`enq-${TOKEN}+fwd@${DOMAIN}`, DOMAIN)).toBe(TOKEN);
  });

  it("ignores other mailboxes and other domains", () => {
    expect(tokenFromAddress(`hello@${DOMAIN}`, DOMAIN)).toBeNull();
    expect(tokenFromAddress(`enq-${TOKEN}@evil.test`, DOMAIN)).toBeNull();
    expect(tokenFromAddress("rubbish", DOMAIN)).toBeNull();
  });

  it("scans every to/cc address and returns the first token found", () => {
    expect(
      threadTokenFrom(
        ["studio@example.com", null, `enq-${TOKEN}@${DOMAIN}`],
        DOMAIN,
      ),
    ).toBe(TOKEN);
    expect(threadTokenFrom([`enq-${TOKEN}@${DOMAIN}`], null)).toBeNull();
    expect(threadTokenFrom(["studio@example.com"], DOMAIN)).toBeNull();
  });

  it("finds a token inside a References header as a secondary source", () => {
    expect(
      tokenFromText(
        `<abc@x> <enq-${TOKEN}@${DOMAIN}> <def@y>`,
        DOMAIN,
      ),
    ).toBe(TOKEN);
    expect(tokenFromText("<abc@x>", DOMAIN)).toBeNull();
    expect(tokenFromText(null, DOMAIN)).toBeNull();
  });
});

describe("inboundEmailDomain", () => {
  it("normalises and tolerates a leading @", () => {
    expect(inboundEmailDomain({ INBOUND_EMAIL_DOMAIN: " @Mail.Example.COM " })).toBe(
      "mail.example.com",
    );
    expect(inboundEmailDomain({})).toBeNull();
    expect(inboundEmailDomain({ INBOUND_EMAIL_DOMAIN: "  " })).toBeNull();
  });
});

describe("outbound identity", () => {
  it("uses the artist's first name in the From display name", () => {
    expect(firstName("Sarah North")).toBe("Sarah");
    expect(firstName("  ")).toBeNull();
    expect(fromDisplayName("Sarah North")).toBe("Sarah at Boots 'n' Bandit");
    expect(fromDisplayName(null)).toBe("Boots 'n' Bandit");
  });

  it("quotes and escapes the display name in the From header", () => {
    expect(
      formatFromHeader("Sarah at Boots 'n' Bandit", "enquiries@mail.test"),
    ).toBe(`"Sarah at Boots 'n' Bandit" <enquiries@mail.test>`);
    expect(formatFromHeader('He said "hi"', "a@b.test")).toBe(
      '"He said \\"hi\\"" <a@b.test>',
    );
  });

  it("angle-wraps a Message-ID exactly once", () => {
    expect(formatMessageId("abc@x.test")).toBe("<abc@x.test>");
    expect(formatMessageId("<abc@x.test>")).toBe("<abc@x.test>");
    expect(formatMessageId("  ")).toBeNull();
    expect(formatMessageId(null)).toBeNull();
  });

  it("prefixes Re: once and falls back when there is no subject", () => {
    expect(replySubject("Sleeve idea")).toBe("Re: Sleeve idea");
    expect(replySubject("Re: Sleeve idea")).toBe("Re: Sleeve idea");
    expect(replySubject("RE: Sleeve idea")).toBe("RE: Sleeve idea");
    expect(replySubject(null)).toBe("Re: your enquiry");
  });
});

describe("headers", () => {
  it("reads a header case-insensitively", () => {
    expect(headerValue({ "Message-ID": "<a@b>" }, "message-id")).toBe("<a@b>");
    expect(headerValue(null, "message-id")).toBeNull();
  });

  it("detects auto-replies and bulk mail", () => {
    expect(isAutoSubmitted({ "Auto-Submitted": "auto-replied" })).toBe(true);
    expect(isAutoSubmitted({ "auto-submitted": "no" })).toBe(false);
    expect(isAutoSubmitted({ Precedence: "bulk" })).toBe(true);
    expect(isAutoSubmitted({ "X-Autoreply": "yes" })).toBe(true);
    expect(isAutoSubmitted({ Subject: "hi" })).toBe(false);
    expect(isAutoSubmitted(null)).toBe(false);
  });
});

describe("htmlToText", () => {
  it("drops the quoted blockquote, scripts and styles, and keeps the prose", () => {
    const text = htmlToText(
      '<style>p{}</style><script>evil()</script><div>Tuesday works<br>for me</div>' +
        '<blockquote class="gmail_quote"><p>On Mon, Sarah wrote:</p></blockquote>',
    );
    expect(text).toContain("Tuesday works");
    expect(text).toContain("for me");
    expect(text).not.toContain("evil()");
    expect(text).not.toContain("Sarah wrote");
  });

  it("decodes the common entities and collapses blank runs", () => {
    expect(htmlToText("<p>Boots &amp; Bandit</p><p>&nbsp;</p><p>ok</p>")).toBe(
      "Boots & Bandit\n\nok",
    );
    expect(htmlToText(null)).toBe("");
  });
});

describe("stripQuotedReply", () => {
  it("cuts a Gmail attribution line and everything after it", () => {
    const body = [
      "Tuesday works for me.",
      "",
      "On Mon, 7 Sep 2026 at 10:04, Sarah <enquiries@mail.test> wrote:",
      "> Hi Amy, how about Tuesday?",
      "> — Sarah",
    ].join("\n");
    expect(stripQuotedReply(body)).toBe("Tuesday works for me.");
  });

  it("cuts a wrapped Gmail attribution split over two lines", () => {
    const body = [
      "Sounds good.",
      "",
      "On Mon, 7 Sep 2026 at 10:04, Sarah North",
      "<enquiries@mail.test> wrote:",
      "> Hi Amy",
    ].join("\n");
    expect(stripQuotedReply(body)).toBe("Sounds good.");
  });

  it("cuts an Outlook original-message block and its divider", () => {
    expect(
      stripQuotedReply("Yes please.\n\n-----Original Message-----\nFrom: Sarah"),
    ).toBe("Yes please.");
    expect(
      stripQuotedReply(`Yes please.\n\n${"_".repeat(32)}\nFrom: Sarah`),
    ).toBe("Yes please.");
  });

  it("cuts an Outlook quoted header block", () => {
    const body = [
      "Booked.",
      "",
      "From: Sarah <enquiries@mail.test>",
      "Sent: 07 September 2026 10:04",
      "To: Amy Jones",
      "Subject: Your enquiry",
      "",
      "Hi Amy",
    ].join("\n");
    expect(stripQuotedReply(body)).toBe("Booked.");
  });

  it("cuts a bare quoted block", () => {
    expect(stripQuotedReply("Yes.\n> previous message")).toBe("Yes.");
  });

  it("leaves an unquoted message and a lone 'From:' sentence alone", () => {
    expect(stripQuotedReply("Hi there,\n\nCan I book in?")).toBe(
      "Hi there,\n\nCan I book in?",
    );
    expect(stripQuotedReply("From: the tattoo I sent you")).toBe(
      "From: the tattoo I sent you",
    );
    expect(stripQuotedReply("On Tuesday, I am free all day.")).toBe(
      "On Tuesday, I am free all day.",
    );
  });

  it("never returns empty — a fully-quoted reply keeps its original text", () => {
    const quoted = "> only quoted text";
    expect(stripQuotedReply(quoted)).toBe(quoted);
    expect(stripQuotedReply("   ")).toBe("");
    expect(stripQuotedReply(null)).toBe("");
  });
});
