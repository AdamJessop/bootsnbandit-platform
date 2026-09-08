import { prisma } from "@bnb/core/db";
import { sendEmail, type SendEmailResult } from "@bnb/core/email";
import {
  firstName,
  formatFromHeader,
  formatMessageId,
  fromDisplayName,
  inboundEmailDomain,
  outboundAddressFor,
  parseAddress,
  replyAddressFor,
  replySubject,
} from "./email-format";
import type { MessageChannelKind, Prisma } from "@prisma/client";

/**
 * OUTBOUND: everything a staff reply needs, flattened out of one enquiry row.
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
  /** PSID/IGSID (Meta) or email address of the last inbound message. */
  lastInboundFromAddress: string | null;
  /** ChannelConnection the last inbound message arrived on, when Meta. */
  lastInboundConnectionId: string | null;
  /** When the customer last wrote — what the Meta 24-hour window is measured from. */
  lastInboundAt: Date | null;
}

/**
 * Everything a staff reply needs, as a reusable Prisma select. The admin
 * action spreads this into the scoped read it already performs, so replying
 * costs ONE enquiry query instead of two.
 *
 * `messageIdHeader` is deliberately selected here rather than carried on
 * `ThreadMessageRow` — no render path needs it, and the inbox pulls hundreds
 * of rows per page.
 */
export const ENQUIRY_EMAIL_CONTEXT_SELECT = {
  id: true,
  threadToken: true,
  customerId: true,
  contactName: true,
  contactEmail: true,
  subject: true,
  lastInboundAt: true,
  preferredArtist: { select: { name: true } },
  customer: { select: { email: true } },
  messages: {
    where: { direction: "inbound" },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 1,
    select: {
      channel: true,
      subject: true,
      messageIdHeader: true,
      fromAddress: true,
      connectionId: true,
    },
  },
} satisfies Prisma.EnquirySelect;

export type EnquiryEmailContextRow = Prisma.EnquiryGetPayload<{
  select: typeof ENQUIRY_EMAIL_CONTEXT_SELECT;
}>;

/** Pure row → context. No I/O, so callers that already hold the row reuse it. */
export function toEnquiryEmailContext(
  enquiry: EnquiryEmailContextRow,
): EnquiryEmailContext {
  const last = enquiry.messages[0] ?? null;
  return {
    enquiryId: enquiry.id,
    threadToken: enquiry.threadToken,
    customerId: enquiry.customerId,
    contactName: enquiry.contactName,
    // A thread the customer emailed us on always has a reachable address,
    // even when the enquiry row never captured one (a Meta or flash lead that
    // later moved to email). Falling through to the last inbound sender —
    // safe, because a message only joins this thread once it has resolved to
    // this same customer — keeps the reply an email instead of silently
    // downgrading it to an internal note.
    // `fromAddress` is only an address for email traffic (a web lead stores
    // the phone number there when it has no email), so it is parsed, not
    // trusted.
    contactEmail:
      enquiry.contactEmail ??
      parseAddress(last?.fromAddress)?.address ??
      enquiry.customer?.email ??
      null,
    subject: enquiry.subject,
    artistName: enquiry.preferredArtist?.name ?? null,
    lastInboundChannel: last?.channel ?? null,
    lastInboundMessageId: last?.messageIdHeader ?? null,
    lastInboundSubject: last?.subject ?? null,
    lastInboundFromAddress: last?.fromAddress ?? null,
    lastInboundConnectionId: last?.connectionId ?? null,
    lastInboundAt: enquiry.lastInboundAt,
  };
}

export async function loadEnquiryEmailContext(
  enquiryId: string,
): Promise<EnquiryEmailContext | null> {
  const enquiry = await prisma.enquiry.findUnique({
    where: { id: enquiryId },
    select: ENQUIRY_EMAIL_CONTEXT_SELECT,
  });
  return enquiry ? toEnquiryEmailContext(enquiry) : null;
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

  // `inboundEmailDomain` owns the "not configured" warning — once per process
  // rather than once per reply.
  const domain = inboundEmailDomain();

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
