import { prisma } from "@bnb/core/db";
import { sendEmail, type SendEmailResult } from "@bnb/core/email";
import { sniffImageMime } from "@bnb/core/uploads";
import {
  isInlineableAttachment,
  MAX_INLINE_ATTACHMENT_BYTES,
  type StoreAttachmentInput,
} from "../assets";
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
  tokenFromText,
} from "./email-format";
import type { MessageChannelKind } from "@prisma/client";

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
    event.data.email_id.length > 0
  );
}

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
  for (const meta of metas) {
    const link = byId.get(meta.id) ?? null;
    const url = link?.download_url ?? null;
    const declared = baseMime(meta.content_type ?? link?.content_type);
    const filename = meta.filename ?? link?.filename ?? null;
    const size = meta.size ?? link?.size ?? 0;

    let bytes: Uint8Array | null = null;
    let mime = declared;
    if (url && isInlineableAttachment(declared, size)) {
      let downloaded: Uint8Array | null = null;
      try {
        downloaded = await deps.download(url, MAX_INLINE_ATTACHMENT_BYTES);
      } catch (err) {
        console.error(
          `[email] attachment download failed for ${meta.id}:`,
          err,
        );
      }
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
  const bodyText = stripQuotedReply(text) || "(no message body)";

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
    bodyHtml: email.html,
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

/** True when the sender is @our inbound mail domain — i.e. our own mail, looping. */
function isOwnDomain(address: string, domain: string | null): boolean {
  if (!domain) return false;
  const host = address.slice(address.lastIndexOf("@") + 1).toLowerCase();
  return host === domain.trim().toLowerCase();
}

/**
 * OUTBOUND: everything a staff reply needs, flattened in one query.
 *
 * `messageIdHeader` is deliberately selected here rather than carried on
 * `ThreadMessageRow` — no render path needs it, and the inbox pulls hundreds
 * of rows per page.
 */
export interface EnquiryEmailContext {
  enquiryId: string;
  threadToken: string;
  customerId: string | null;
  contactName: string;
  contactEmail: string | null;
  subject: string | null;
  /** The assigned artist, whose first name goes on the From line. */
  artistName: string | null;
  lastInboundChannel: MessageChannelKind | null;
  /** RFC Message-ID of the last inbound message, for In-Reply-To. */
  lastInboundMessageId: string | null;
  lastInboundSubject: string | null;
}

export async function loadEnquiryEmailContext(
  enquiryId: string,
): Promise<EnquiryEmailContext | null> {
  const enquiry = await prisma.enquiry.findUnique({
    where: { id: enquiryId },
    select: {
      id: true,
      threadToken: true,
      customerId: true,
      contactName: true,
      contactEmail: true,
      subject: true,
      preferredArtist: { select: { name: true } },
      messages: {
        where: { direction: "inbound" },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 1,
        select: { channel: true, subject: true, messageIdHeader: true },
      },
    },
  });
  if (!enquiry) return null;

  const last = enquiry.messages[0] ?? null;
  return {
    enquiryId: enquiry.id,
    threadToken: enquiry.threadToken,
    customerId: enquiry.customerId,
    contactName: enquiry.contactName,
    contactEmail: enquiry.contactEmail,
    subject: enquiry.subject,
    artistName: enquiry.preferredArtist?.name ?? null,
    lastInboundChannel: last?.channel ?? null,
    lastInboundMessageId: last?.messageIdHeader ?? null,
    lastInboundSubject: last?.subject ?? null,
  };
}

export interface SendEnquiryEmailInput {
  context: EnquiryEmailContext;
  body: string;
  authorUserId: string;
  /** Used for the From name when no artist is assigned yet. */
  authorDisplayName?: string | null;
}

/**
 * The studio reply, wearing the artist's name (spec decision 6):
 *
 *   From:     "Sarah at Boots 'n' Bandit" <enquiries@mail.example.com>
 *   Reply-To: enq-<threadToken>@mail.example.com
 *   In-Reply-To/References: the last inbound Message-ID
 *
 * The Reply-To token is what makes the round trip work — the customer's reply
 * comes back addressed to the enquiry, so the inbound webhook threads it with
 * no guessing. Sending is delegated to `sendEmail`, which keeps the MessageLog
 * row, the outbound `EnquiryMessage` and the `authorUserId` attribution.
 *
 * With no `INBOUND_EMAIL_DOMAIN` configured there is nowhere for a reply to
 * land, so the send falls back to the plain `EMAIL_FROM` identity with no
 * Reply-To rather than advertising an address that does not exist.
 */
export async function sendEnquiryEmail(
  input: SendEnquiryEmailInput,
): Promise<SendEmailResult> {
  const { context } = input;
  if (!context.contactEmail) {
    throw new Error(
      `sendEnquiryEmail: enquiry ${context.enquiryId} has no email address`,
    );
  }

  const domain = inboundEmailDomain();
  if (!domain) {
    console.warn(
      "[email] INBOUND_EMAIL_DOMAIN is not set — replying from the default studio address with no reply token.",
    );
  }

  const name =
    firstName(context.artistName) ?? firstName(input.authorDisplayName);
  const from = domain
    ? formatFromHeader(fromDisplayName(name), outboundAddressFor(domain))
    : null;
  const replyTo = domain ? replyAddressFor(context.threadToken, domain) : null;

  const inReplyTo = formatMessageId(context.lastInboundMessageId);
  const headers = inReplyTo
    ? { "In-Reply-To": inReplyTo, References: inReplyTo }
    : undefined;

  return sendEmail({
    to: context.contactEmail,
    type: "staff_reply",
    customerId: context.customerId,
    enquiryId: context.enquiryId,
    authorUserId: input.authorUserId,
    from,
    replyTo,
    headers,
    data: {
      customerName: context.contactName,
      body: input.body,
      subject: replySubject(context.lastInboundSubject ?? context.subject),
    },
  });
}
