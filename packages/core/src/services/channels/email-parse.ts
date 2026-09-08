import { sniffImageMime } from "@bnb/core/uploads";
import {
  isInlineableAttachment,
  MAX_INLINE_ATTACHMENT_BYTES,
  type StoreAttachmentInput,
} from "../assets";
import {
  emailFromDomain,
  headerValue,
  htmlToText,
  inboundEmailDomain,
  isAutoSubmitted,
  formatMessageId,
  parseAddress,
  parseAddressList,
  stripQuotedReply,
  threadTokenFrom,
  tokenFromText,
} from "./email-format";

/**
 * The email channel.
 *
 * INBOUND: Resend's `email.received` webhook carries metadata only, so the
 * body and the attachment download URLs are fetched from the API. Everything
 * network-facing sits behind `ResendInboundDeps`, so the parsing rules are
 * testable without a key, a socket or a mock server.
 */

/** Cap on attachments processed per email — a mail bomb must not stall the route. */
export const MAX_INBOUND_ATTACHMENTS = 20;

/** Hard ceiling on how long a single attachment download may take. */
const DOWNLOAD_TIMEOUT_MS = 15_000;

/**
 * Total bytes one email may pull into inline attachment rows. Each attachment
 * is already capped at MAX_INLINE_ATTACHMENT_BYTES, but twenty of them are
 * not: without a budget a single message could stream 160 MB into a bytea
 * column inside the ingest transaction. Anything past the budget is still
 * recorded — as a link back to Resend, not as stored bytes.
 */
export const MAX_INLINE_TOTAL_BYTES = 16 * 1024 * 1024;

/**
 * Caps on the stored body. The text is what the inbox renders, so it is
 * truncated with a visible marker; the HTML is only ever an archival copy, so
 * an oversize one is dropped entirely rather than half-stored (a truncated
 * document is invalid markup). Neither loses anything permanently — the
 * original stays retrievable from Resend.
 */
export const MAX_BODY_TEXT_CHARS = 64_000;
export const MAX_BODY_HTML_CHARS = 512_000;

const TRUNCATION_MARKER = "\n\n[… truncated]";

function capBodyText(text: string): string {
  if (text.length <= MAX_BODY_TEXT_CHARS) return text;
  return text.slice(0, MAX_BODY_TEXT_CHARS) + TRUNCATION_MARKER;
}

/** Subset of resend@6's `EmailReceivedEvent` that we rely on. */
export interface ResendReceivedEvent {
  type: string;
  created_at?: string;
  data: {
    email_id: string;
    created_at?: string;
    from?: string;
    to?: string[];
    cc?: string[] | null;
    bcc?: string[] | null;
    subject?: string;
    message_id?: string;
    attachments?: {
      id: string;
      filename?: string | null;
      content_type?: string;
    }[];
  };
}

/** Subset of `GetReceivingEmailResponseSuccess` (GET /emails/receiving/{id}). */
export interface ResendInboundEmail {
  id: string;
  to: string[];
  from: string;
  created_at: string;
  subject: string | null;
  cc: string[] | null;
  bcc: string[] | null;
  reply_to: string[] | null;
  html: string | null;
  text: string | null;
  headers: Record<string, string> | null;
  message_id: string;
  attachments: {
    id: string;
    filename: string | null;
    size: number;
    content_type: string;
    content_id: string | null;
    content_disposition: string | null;
  }[];
}

/** Subset of `AttachmentData` (GET /emails/receiving/{id}/attachments). */
export interface ResendAttachmentLink {
  id: string;
  filename?: string | null;
  size: number;
  content_type: string;
  content_disposition?: string | null;
  download_url: string;
  expires_at?: string;
}

export interface ResendInboundDeps {
  getEmail(emailId: string): Promise<ResendInboundEmail>;
  listAttachments(emailId: string): Promise<ResendAttachmentLink[]>;
  /** Resolves null when the body is missing, too large or unreadable. */
  download(url: string, maxBytes: number): Promise<Uint8Array | null>;
}

export interface ParsedInboundEmail {
  /** Resend's email id — the idempotency key on EnquiryMessage.externalId. */
  externalId: string;
  /** RFC 5322 Message-ID, angle-wrapped, for our reply's In-Reply-To. */
  messageId: string | null;
  fromAddress: string;
  fromName: string | null;
  toAddresses: string[];
  ccAddresses: string[];
  subject: string | null;
  /** Quoted history removed — what the customer actually wrote. */
  bodyText: string;
  /** The original HTML, untouched. */
  bodyHtml: string | null;
  threadToken: string | null;
  receivedAt: Date;
  autoSubmitted: boolean;
  attachments: StoreAttachmentInput[];
}

export function isEmailReceivedEvent(
  value: unknown,
): value is ResendReceivedEvent {
  if (typeof value !== "object" || value === null) return false;
  const event = value as { type?: unknown; data?: { email_id?: unknown } };
  return (
    event.type === "email.received" &&
    typeof event.data === "object" &&
    event.data !== null &&
    typeof event.data.email_id === "string" &&
    // The id goes straight into a Resend API path, so it must look like a
    // provider id and nothing else — no traversal, no separators, no novel.
    EMAIL_ID.test(event.data.email_id)
  );
}

/** Shape of a Resend email id: an opaque, bounded, path-safe token. */
const EMAIL_ID = /^[A-Za-z0-9_-]{1,128}$/;

function requireApiKey(): string {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "RESEND_API_KEY is not configured — inbound email cannot be fetched.",
    );
  }
  return key;
}

/**
 * The real network deps. Only ever constructed on the webhook/retry path.
 * `fetchImpl` defaults to the global `fetch` — tests inject their own to
 * exercise `download`'s streaming/cap logic without touching the network.
 */
export function resendInboundDeps(
  fetchImpl: typeof fetch = fetch,
): ResendInboundDeps {
  return {
    async getEmail(emailId) {
      const { Resend } = await import("resend");
      const resend = new Resend(requireApiKey());
      const { data, error } = await resend.emails.receiving.get(emailId);
      if (error || !data) {
        throw new Error(
          `Resend inbound fetch failed for ${emailId}: ${error?.message ?? "no data"}`,
        );
      }
      return data as unknown as ResendInboundEmail;
    },
    async listAttachments(emailId) {
      const { Resend } = await import("resend");
      const resend = new Resend(requireApiKey());
      const { data, error } = await resend.emails.receiving.attachments.list({
        emailId,
      });
      if (error || !data) {
        throw new Error(
          `Resend attachment listing failed for ${emailId}: ${error?.message ?? "no data"}`,
        );
      }
      return data.data as unknown as ResendAttachmentLink[];
    },
    async download(url, maxBytes) {
      try {
        const res = await fetchImpl(url, {
          signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
        });
        if (!res.ok) return null;
        const declared = Number(res.headers.get("content-length") ?? "0");
        if (declared > maxBytes) return null;
        if (!res.body) {
          const bytes = new Uint8Array(await res.arrayBuffer());
          return bytes.byteLength > 0 && bytes.byteLength <= maxBytes
            ? bytes
            : null;
        }

        // Content-Length can be absent or lie, so the cap is enforced on the
        // actual bytes seen — the reader is aborted the instant the running
        // total crosses maxBytes, never buffering an unbounded body.
        const reader = res.body.getReader();
        const chunks: Uint8Array[] = [];
        let total = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!value) continue;
          total += value.byteLength;
          if (total > maxBytes) {
            await reader.cancel();
            return null;
          }
          chunks.push(value);
        }
        if (total === 0) return null;
        const bytes = new Uint8Array(total);
        let offset = 0;
        for (const chunk of chunks) {
          bytes.set(chunk, offset);
          offset += chunk.byteLength;
        }
        return bytes;
      } catch {
        return null;
      }
    },
  };
}

/** `image/png; charset=x` → `image/png`. */
function baseMime(raw: string | null | undefined): string {
  const value = raw?.split(";")[0]?.trim().toLowerCase();
  return value || "application/octet-stream";
}

/**
 * Images become inline rows, everything else a link.
 *
 * The security rule (carried from the Phase-1 review): bytes are stored ONLY
 * when `sniffImageMime` recognises them, and the row records the **sniffed**
 * mime, never the sender's `content_type` — an `image/png` label on an SVG or
 * an HTML payload must not end up served back to staff as an image.
 *
 * A row with neither bytes nor url is unreachable in the inbox, so it is
 * dropped rather than written.
 */
async function collectAttachments(
  email: ResendInboundEmail,
  deps: ResendInboundDeps,
): Promise<StoreAttachmentInput[]> {
  const metas = (email.attachments ?? []).slice(0, MAX_INBOUND_ATTACHMENTS);
  if (metas.length === 0) return [];

  let links: ResendAttachmentLink[] = [];
  try {
    links = await deps.listAttachments(email.id);
  } catch (err) {
    console.error(
      `[email] attachment listing failed for ${email.id} — recording none:`,
      err,
    );
    return [];
  }
  const byId = new Map(links.map((link) => [link.id, link]));

  const out: StoreAttachmentInput[] = [];
  // Bytes already pulled down for this email. Once the next candidate would
  // push it past the budget the download is skipped outright, so the cap
  // bounds the work done, not just what is written.
  let spent = 0;
  for (const meta of metas) {
    const link = byId.get(meta.id) ?? null;
    const url = link?.download_url ?? null;
    const declared = baseMime(meta.content_type ?? link?.content_type);
    const filename = meta.filename ?? link?.filename ?? null;
    const size = meta.size ?? link?.size ?? 0;

    let bytes: Uint8Array | null = null;
    let mime = declared;
    // What is left of the 16 MB budget, and what this attachment could cost
    // at worst. `size` is the sender's declaration and may be absent or a
    // lie, so an unknown/zero size is priced at the full per-file cap: the
    // budget must bound the work DONE, not just what ends up stored.
    const remaining = MAX_INLINE_TOTAL_BYTES - spent;
    const projected = Math.min(
      size > 0 ? size : MAX_INLINE_ATTACHMENT_BYTES,
      MAX_INLINE_ATTACHMENT_BYTES,
    );
    if (url && projected <= remaining && isInlineableAttachment(declared, size)) {
      let downloaded: Uint8Array | null = null;
      try {
        // The stream is cut the instant it crosses whichever is smaller: the
        // per-file cap or what remains of the budget. `download` returns null
        // when it does, so an over-budget attachment costs the transfer of
        // the remaining budget and nothing more.
        downloaded = await deps.download(
          url,
          Math.min(MAX_INLINE_ATTACHMENT_BYTES, remaining),
        );
      } catch (err) {
        console.error(
          `[email] attachment download failed for ${meta.id}:`,
          err,
        );
      }
      // Charged whether or not the bytes end up stored — a failed sniff still
      // cost the transfer. An aborted download charges the whole allowance it
      // was given, because that is what was pulled over the wire.
      spent += downloaded
        ? Math.max(size, downloaded.byteLength)
        : Math.min(projected, remaining);
      const sniffed = downloaded ? sniffImageMime(downloaded) : null;
      if (downloaded && sniffed) {
        bytes = downloaded;
        mime = sniffed;
      }
    }

    if (bytes) out.push({ mime, filename, bytes });
    else if (url) out.push({ mime: declared, filename, url });
    // else: neither reachable nor storable — skip it entirely.
  }
  return out;
}

export async function parseResendInbound(
  event: ResendReceivedEvent,
  deps: ResendInboundDeps = resendInboundDeps(),
): Promise<ParsedInboundEmail> {
  const email = await deps.getEmail(event.data.email_id);

  const sender =
    parseAddress(email.from) ?? parseAddress(event.data.from ?? "");
  if (!sender) {
    throw new Error(
      `Inbound email ${email.id} has an unparseable From header: ${email.from}`,
    );
  }

  const toAddresses = parseAddressList(email.to).map((a) => a.address);
  const ccAddresses = parseAddressList(email.cc).map((a) => a.address);

  const domain = inboundEmailDomain();
  // The reply address is authoritative; References is the fallback for
  // clients that rewrite the recipient list on reply.
  const threadToken =
    threadTokenFrom([...toAddresses, ...ccAddresses], domain) ??
    tokenFromText(
      `${headerValue(email.headers, "references") ?? ""} ${
        headerValue(email.headers, "in-reply-to") ?? ""
      }`,
      domain,
    );

  const text = email.text?.trim() ? email.text : htmlToText(email.html);
  // Cap AFTER the quoted history is stripped: the quote is usually the bulk
  // of a long reply, so truncating first would cut the customer's own words.
  const bodyText = capBodyText(stripQuotedReply(text) || "(no message body)");
  const html = email.html ?? null;
  // Dropped, not truncated — half a document is not valid HTML, and the
  // original is always retrievable from Resend.
  const bodyHtml = html && html.length > MAX_BODY_HTML_CHARS ? null : html;

  const receivedRaw =
    email.created_at ?? event.data.created_at ?? event.created_at;
  const receivedAt = receivedRaw ? new Date(receivedRaw) : new Date();

  return {
    externalId: email.id,
    messageId: formatMessageId(
      // `||` not `??`: Resend types Message-ID as a non-null string, so an
      // absent one arrives as "" and must fall through to the header/event.
      email.message_id ||
        headerValue(email.headers, "message-id") ||
        event.data.message_id,
    ),
    fromAddress: sender.address,
    fromName: sender.name,
    toAddresses,
    ccAddresses,
    subject: email.subject?.trim() || null,
    bodyText,
    bodyHtml,
    threadToken,
    receivedAt: Number.isNaN(receivedAt.getTime()) ? new Date() : receivedAt,
    // Auto-replies, bounces and list traffic are flagged, and so is anything
    // sent from our own inbound domain — that is our own outbound mail (or a
    // forward of it) coming back around, and recording it would loop the
    // thread against itself.
    autoSubmitted:
      isAutoSubmitted(email.headers) || isOwnDomain(sender.address, domain),
    attachments: await collectAttachments(email, deps),
  };
}

/**
 * True when the sender is one of OUR OWN send domains — i.e. our own mail,
 * looping. Both identities count: the inbound domain replies are sent from,
 * and the `EMAIL_FROM` host every transactional email leaves from. The second
 * is what catches a loop on a deployment that never configured
 * `INBOUND_EMAIL_DOMAIN` — exactly the deployment most likely to have one.
 */
export function isOwnDomain(address: string, domain: string | null): boolean {
  const host = address.slice(address.lastIndexOf("@") + 1).toLowerCase();
  if (!host) return false;
  const ours = [domain?.trim().toLowerCase() || null, emailFromDomain()];
  return ours.some((candidate) => candidate !== null && candidate === host);
}
