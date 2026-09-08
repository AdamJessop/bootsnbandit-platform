import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetInboundDomainWarnings,
  firstName,
  formatFromHeader,
  formatMessageId,
  fromDisplayName,
  headerValue,
  htmlToText,
  emailFromDomain,
  inboundEmailDomain,
  isAutoSubmitted,
  outboundAddressFor,
  parseAddress,
  parseAddressList,
  parseAuthenticationResults,
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

/**
 * A misconfigured value must degrade EXACTLY like an absent one (null), and
 * say so once — a URL or a bare mailbox pasted into the var would otherwise
 * end up in a Reply-To header and produce silently unreachable mail.
 */
describe("inboundEmailDomain validation", () => {
  beforeEach(() => {
    // The warn-once ledger is module-level, so each case starts from a clean
    // one rather than inheriting whatever an earlier suite already said.
    __resetInboundDomainWarnings();
  });

  it("accepts a plain hostname, stripping a leading @ and casing", () => {
    expect(
      inboundEmailDomain({
        INBOUND_EMAIL_DOMAIN: "@Mail.Example.TEST",
      } as NodeJS.ProcessEnv),
    ).toBe("mail.example.test");
  });

  it("treats a value that is not a hostname as unset, and warns once", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const env = {
      INBOUND_EMAIL_DOMAIN: "https://mail.example.test/inbox",
    } as NodeJS.ProcessEnv;
    expect(inboundEmailDomain(env)).toBeNull();
    expect(inboundEmailDomain(env)).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain("INBOUND_EMAIL_DOMAIN");
    warn.mockRestore();
  });

  it("warns once for an unset value too", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(inboundEmailDomain({} as NodeJS.ProcessEnv)).toBeNull();
    expect(
      inboundEmailDomain({ INBOUND_EMAIL_DOMAIN: "" } as NodeJS.ProcessEnv),
    ).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it("rejects a header-injection payload and never logs the raw CRLF", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(
      inboundEmailDomain({
        INBOUND_EMAIL_DOMAIN: "mail.example.test\r\nBcc: x",
      } as NodeJS.ProcessEnv),
    ).toBeNull();
    expect(String(warn.mock.calls[0][0])).not.toMatch(/[\r\n]/);
    warn.mockRestore();
  });
});

describe("emailFromDomain", () => {
  it("reads the host out of EMAIL_FROM, defaulting to the studio address", () => {
    expect(
      emailFromDomain({ EMAIL_FROM: "Boots 'n' Bandit <Hello@Mail.Example.com>" }),
    ).toBe("mail.example.com");
    expect(emailFromDomain({ EMAIL_FROM: "hello@example.test" })).toBe(
      "example.test",
    );
    // Unset falls back to the same default `sendEmail` actually sends from.
    expect(emailFromDomain({})).toBe("bootsnbandit.co.uk");
    // Unparseable is null rather than a bogus host.
    expect(emailFromDomain({ EMAIL_FROM: "not an address" })).toBeNull();
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

  it("strips CR/LF so a header value can't smuggle an injected header", () => {
    const payload = "Sarah\r\nBcc: attacker@evil.test";

    const from = formatFromHeader(payload, "enquiries@mail.test");
    expect(from).not.toMatch(/[\r\n]/);
    expect(from).not.toContain("Bcc: attacker@evil.test\n");

    const subject = replySubject(`Sleeve idea${payload}`);
    expect(subject).not.toMatch(/[\r\n]/);
    expect(subject).not.toContain("Bcc: attacker@evil.test\n");

    expect(formatMessageId(`abc@x.test${payload}`)).toBeNull();
  });

  it("caps the length of the values it puts on a header line", () => {
    const from = formatFromHeader("N".repeat(500), "enquiries@mail.test");
    expect(from).toBe(`"${"N".repeat(100)}" <enquiries@mail.test>`);

    const subject = replySubject("S".repeat(500));
    expect(subject).toBe(`Re: ${"S".repeat(200)}`);
    // An already-prefixed subject is capped too, prefix included.
    expect(replySubject(`Re: ${"S".repeat(500)}`).length).toBe(200);
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

describe("parseAuthenticationResults", () => {
  it("is null when the header is absent — unknown, not unverified", () => {
    expect(parseAuthenticationResults(null)).toBeNull();
    expect(parseAuthenticationResults({})).toBeNull();
    expect(parseAuthenticationResults({ Subject: "hi" })).toBeNull();
  });

  it("is true on a DMARC pass", () => {
    expect(
      parseAuthenticationResults({
        "Authentication-Results":
          "mx.resend.com; spf=pass smtp.mailfrom=example.test; dkim=pass header.d=example.test; dmarc=pass header.from=example.test",
      }),
    ).toBe(true);
  });

  it("is true when SPF and DKIM both pass without DMARC", () => {
    expect(
      parseAuthenticationResults({
        "authentication-results": "mx.resend.com; spf=pass; dkim=pass",
      }),
    ).toBe(true);
  });

  it("is false when the header exists but the checks do not pass", () => {
    expect(
      parseAuthenticationResults({
        "Authentication-Results":
          "mx.resend.com; spf=fail; dkim=none; dmarc=fail",
      }),
    ).toBe(false);
    expect(
      parseAuthenticationResults({
        "Authentication-Results": "mx.resend.com; spf=pass; dkim=none",
      }),
    ).toBe(false);
  });

  it("does not let a lookalike token forge a pass", () => {
    expect(
      parseAuthenticationResults({
        "Authentication-Results": "mx.resend.com; xspf=pass; dkim=pass",
      }),
    ).toBe(false);
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

describe("htmlToText numeric entities", () => {
  it("decodes decimal and hex character references", () => {
    expect(htmlToText("<p>It&#8217;s here</p>")).toBe("It’s here");
    expect(htmlToText("<p>It&#x2019;s here</p>")).toBe("It’s here");
    expect(htmlToText("<p>caf&#233;</p>")).toBe("café");
  });

  it("leaves an unresolvable reference alone rather than mangling it", () => {
    expect(htmlToText("<p>&#xZZ; &notanentity;</p>")).toBe(
      "&#xZZ; &notanentity;",
    );
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

  it("cuts a trailing mobile mail-app signature", () => {
    expect(stripQuotedReply("Yes Tuesday works.\n\nSent from my iPhone")).toBe(
      "Yes Tuesday works.",
    );
    expect(
      stripQuotedReply("Yes Tuesday works.\n\nGet Outlook for iOS"),
    ).toBe("Yes Tuesday works.");
    expect(
      stripQuotedReply("Yes Tuesday works.\n\nSent from Yahoo for iPhone"),
    ).toBe("Yes Tuesday works.");
  });

  it("falls back to the original when the body is only a signature", () => {
    const signature = "Sent from my iPhone";
    expect(stripQuotedReply(signature)).toBe(signature);
  });
});
