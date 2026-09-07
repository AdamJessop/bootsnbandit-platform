/**
 * Pure email shaping for the enquiry channel — no I/O, no Prisma, no env
 * beyond one explicit lookup, so every rule here is unit-testable.
 *
 * The load-bearing idea is the reply token: every outbound enquiry email sets
 * `Reply-To: enq-<threadToken>@<INBOUND_EMAIL_DOMAIN>`, so when the customer
 * hits reply the inbound webhook can read the enquiry straight off the
 * recipient address instead of guessing from the sender.
 */

export const STUDIO_NAME = "Boots 'n' Bandit";
/** Local-part prefix of the per-enquiry reply address. */
export const INBOUND_LOCAL_PREFIX = "enq-";
/** Local-part every enquiry reply is sent FROM. */
export const OUTBOUND_LOCAL_PART = "enquiries";

/**
 * The subdomain whose MX points at Resend — both the inbound mailbox domain
 * and the outbound From domain. Null when unconfigured, which the callers
 * treat as "email replies fall back to the plain studio address".
 */
export function inboundEmailDomain(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const raw = env.INBOUND_EMAIL_DOMAIN?.trim().toLowerCase().replace(/^@/, "");
  return raw ? raw : null;
}

/**
 * Fallback identity domain: the host of `EMAIL_FROM`, i.e. the domain every
 * transactional email actually leaves from. Used only to recognise our OWN
 * mail coming back at us when `INBOUND_EMAIL_DOMAIN` is unset — without it a
 * misconfigured deployment threads its own bounces as customer replies. The
 * default mirrors `sendEmail`'s, so an unset var still identifies real mail.
 */
export function emailFromDomain(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const parsed = parseAddress(
    env.EMAIL_FROM?.trim() || "Boots 'n' Bandit <hello@bootsnbandit.co.uk>",
  );
  if (!parsed) return null;
  return parsed.address.slice(parsed.address.lastIndexOf("@") + 1) || null;
}

export interface ParsedAddress {
  name: string | null;
  address: string;
}

const BARE_ADDRESS = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]{2,}$/;

/** `Amy Jones <amy@x.test>` / `"Jones, Amy" <amy@x.test>` / `amy@x.test`. */
export function parseAddress(
  raw: string | null | undefined,
): ParsedAddress | null {
  const value = raw?.trim();
  if (!value) return null;

  const angled = /^([\s\S]*?)<([^<>]+)>\s*$/.exec(value);
  if (angled) {
    const address = angled[2].trim().toLowerCase();
    if (!BARE_ADDRESS.test(address)) return null;
    const name = angled[1]
      .trim()
      .replace(/^"([\s\S]*)"$/, "$1")
      .replace(/\\(.)/g, "$1")
      .trim();
    return { name: name || null, address };
  }

  const address = value.toLowerCase();
  if (!BARE_ADDRESS.test(address)) return null;
  return { name: null, address };
}

/** Split a header on commas that are outside quotes and angle brackets. */
function splitAddresses(raw: string): string[] {
  const out: string[] = [];
  let buf = "";
  let quoted = false;
  let depth = 0;
  for (const ch of raw) {
    if (ch === '"') quoted = !quoted;
    else if (!quoted && ch === "<") depth += 1;
    else if (!quoted && ch === ">") depth = Math.max(0, depth - 1);
    if (ch === "," && !quoted && depth === 0) {
      out.push(buf);
      buf = "";
      continue;
    }
    buf += ch;
  }
  out.push(buf);
  return out.map((s) => s.trim()).filter(Boolean);
}

/**
 * Resend hands us `to`/`cc` as arrays, but each element may still be a full
 * `Name <addr>, Other <addr>` header, so both shapes are accepted. Anything
 * unparseable is dropped rather than thrown — a malformed Cc must not lose us
 * the whole email.
 */
export function parseAddressList(
  raw: string | string[] | null | undefined,
): ParsedAddress[] {
  const items = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const out: ParsedAddress[] = [];
  for (const item of items) {
    if (typeof item !== "string") continue;
    for (const piece of splitAddresses(item)) {
      const parsed = parseAddress(piece);
      if (parsed) out.push(parsed);
    }
  }
  return out;
}

export function replyAddressFor(threadToken: string, domain: string): string {
  return `${INBOUND_LOCAL_PREFIX}${threadToken}@${domain}`;
}

export function outboundAddressFor(domain: string): string {
  return `${OUTBOUND_LOCAL_PART}@${domain}`;
}

/**
 * The token out of one recipient address, or null. Sub-addressing (`+tag`) is
 * tolerated because forwarding MTAs add it; a different domain is never a
 * match, so another studio's token can't steer our threading.
 */
export function tokenFromAddress(raw: string, domain: string): string | null {
  const parsed = parseAddress(raw);
  if (!parsed) return null;
  const at = parsed.address.lastIndexOf("@");
  const local = parsed.address.slice(0, at).split("+")[0];
  const host = parsed.address.slice(at + 1);
  if (host !== domain.trim().toLowerCase()) return null;
  const match = /^enq-([a-z0-9]{8,})$/i.exec(local);
  return match ? match[1] : null;
}

/** First token across every to/cc address. The primary threading signal. */
export function threadTokenFrom(
  addresses: (string | null | undefined)[],
  domain: string | null,
): string | null {
  if (!domain) return null;
  for (const address of addresses) {
    if (!address) continue;
    const token = tokenFromAddress(address, domain);
    if (token) return token;
  }
  return null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Secondary source: some clients drop our reply address from `To` but keep it
 * inside `References`/`In-Reply-To`. Used only when the recipient scan fails.
 */
export function tokenFromText(
  text: string | null | undefined,
  domain: string | null,
): string | null {
  if (!text || !domain) return null;
  const re = new RegExp(
    `enq-([a-z0-9]{8,})@${escapeRegExp(domain.trim().toLowerCase())}`,
    "i",
  );
  const match = re.exec(text);
  return match ? match[1] : null;
}

/**
 * Header values (subjects, display names, Message-IDs) can originate from
 * attacker-controlled inbound mail. Strip ASCII control characters (this
 * removes the CR/LF that would otherwise let a value smuggle a second header
 * line, e.g. a `Bcc:`) and collapse whitespace runs so nothing but plain text
 * survives into an outbound header.
 */
function sanitizeHeaderValue(value: string): string {
  // eslint-disable-next-line no-control-regex -- deliberately stripping control chars
  return value
    .replace(/[\x00-\x1f\x7f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function firstName(full: string | null | undefined): string | null {
  const trimmed = full?.trim();
  if (!trimmed) return null;
  return trimmed.split(/\s+/)[0] || null;
}

/** Decision 6: the studio address, wearing the artist's name. */
export function fromDisplayName(artistName: string | null | undefined): string {
  const first = firstName(artistName);
  return first ? `${first} at ${STUDIO_NAME}` : STUDIO_NAME;
}

/** Header lines are finite: cap what an inbound value can grow to. */
export const MAX_DISPLAY_NAME_CHARS = 100;
export const MAX_SUBJECT_CHARS = 200;

/** RFC 5322 quoted-string display name — the studio name contains an apostrophe. */
export function formatFromHeader(displayName: string, address: string): string {
  const sanitized = sanitizeHeaderValue(displayName).slice(
    0,
    MAX_DISPLAY_NAME_CHARS,
  );
  const escaped = sanitized.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${escaped}" <${address}>`;
}

/** A bare Message-ID local@domain, no whitespace or angle brackets/@ inside either part. */
const BARE_MESSAGE_ID = /^[^\s<>@]+@[^\s<>@]+$/;

export function formatMessageId(raw: string | null | undefined): string | null {
  const value = raw ? sanitizeHeaderValue(raw) : "";
  if (!value) return null;
  const bare = value.replace(/^<+/, "").replace(/>+$/, "").trim();
  if (!bare || !BARE_MESSAGE_ID.test(bare)) return null;
  return `<${bare}>`;
}

export function replySubject(subject: string | null | undefined): string {
  const value = subject
    ? sanitizeHeaderValue(subject).slice(0, MAX_SUBJECT_CHARS)
    : "";
  if (!value) return "Re: your enquiry";
  return /^re:\s/i.test(value) ? value : `Re: ${value}`;
}

export function headerValue(
  headers: Record<string, string> | null | undefined,
  name: string,
): string | null {
  if (!headers) return null;
  const wanted = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === wanted) return value;
  }
  return null;
}

/**
 * Out-of-office replies, bounce notifications and mailing-list traffic must
 * not create enquiries or flip a thread to `customer_replied` — they are not
 * the customer talking to us.
 */
export function isAutoSubmitted(
  headers: Record<string, string> | null | undefined,
): boolean {
  const auto = headerValue(headers, "auto-submitted")?.trim().toLowerCase();
  if (auto && auto !== "no") return true;
  const precedence = headerValue(headers, "precedence")?.trim().toLowerCase();
  if (precedence && ["bulk", "list", "junk", "auto_reply"].includes(precedence)) {
    return true;
  }
  return Boolean(headerValue(headers, "x-autoreply"));
}

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
};

/**
 * Last-resort plain text when Resend gives us HTML only. `<blockquote>` is
 * dropped wholesale — in an HTML reply that element *is* the quoted history.
 */
export function htmlToText(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<blockquote\b[^>]*>[\s\S]*?<\/blockquote>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&[a-z#0-9]+;/gi, (m) => ENTITIES[m.toLowerCase()] ?? m)
    // Every horizontal run (spaces, tabs, the NBSP that &nbsp; decoded to)
    // collapses to one space; newlines are handled separately below.
    .replace(/[^\S\n]+/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** A line that starts a quoted-history block on its own. */
const CUT_LINE: RegExp[] = [
  /^-{2,}\s*original message\s*-{2,}$/i,
  /^_{10,}$/,
  /^on\b.*\bwrote:$/i,
  /^>/,
];

/** A mobile mail-app footer, matched only as the very last content line. */
const SIGNATURE_LINE: RegExp[] = [
  /^sent from my (iphone|ipad|galaxy|samsung device|android)$/i,
  /^get outlook for (ios|android)$/i,
  /^sent from (yahoo|outlook|mail) for .+$/i,
];

/**
 * Trim a trailing mobile-app signature ("Sent from my iPhone" and its kin) —
 * only when it is the last non-blank line, so a sentence that merely mentions
 * a phone is never touched.
 */
function stripTrailingSignature(text: string): string {
  const lines = text.split("\n");
  let end = lines.length;
  while (end > 0 && lines[end - 1].trim() === "") end -= 1;
  if (end === 0) return text;
  const last = lines[end - 1].trim();
  if (!SIGNATURE_LINE.some((re) => re.test(last))) return text;
  return lines.slice(0, end - 1).join("\n");
}

/**
 * Remove the quoted history from a plain-text reply so the inbox shows what
 * the customer actually wrote. Deliberately conservative:
 *
 * - only well-known *structural* markers cut (Gmail's "On … wrote:", Outlook's
 *   original-message divider and its `From:/Sent:/To:` block, a `>` quote run);
 * - free-text signatures are NOT stripped — a lone `--` in a body is too easy
 *   to hit by accident — but a small, narrowly-anchored set of mobile mail-app
 *   footers ("Sent from my iPhone" and its kin) is trimmed when it is the
 *   very last line, since customers rarely delete those on a phone reply;
 * - if stripping would leave nothing, the original text is returned, because
 *   an empty thread bubble is worse than a quoted one.
 *
 * The untouched original always survives in `bodyHtml` (or the raw email at
 * Resend), so nothing is ever actually lost.
 */
export function stripQuotedReply(text: string | null | undefined): string {
  const source = text?.replace(/\r\n/g, "\n") ?? "";
  if (!source.trim()) return source.trim();

  const lines = source.split("\n");
  let cut = -1;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (CUT_LINE.some((re) => re.test(line))) {
      cut = i;
      break;
    }
    // Gmail wraps a long attribution over two lines: "On <date>, <name>" then
    // "<addr> wrote:". Only treat "On …" as a cut when the continuation
    // actually ends in "wrote:".
    if (/^on\b/i.test(line)) {
      const next = lines[i + 1]?.trim() ?? "";
      if (/\bwrote:$/i.test(next)) {
        cut = i;
        break;
      }
    }
    // Outlook's quoted header block: "From: …" followed within a few lines by
    // another header. A prose sentence starting "From:" has no such follow-up.
    if (/^from:\s*\S/i.test(line)) {
      const follows = lines
        .slice(i + 1, i + 5)
        .some((l) => /^(sent|date|to|cc|subject):\s*\S/i.test(l.trim()));
      if (follows) {
        cut = i;
        break;
      }
    }
  }

  const kept = stripTrailingSignature(
    (cut === -1 ? lines : lines.slice(0, cut)).join("\n"),
  )
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return kept || source.trim();
}
