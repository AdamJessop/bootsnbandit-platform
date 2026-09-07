import { prisma } from "@bnb/core/db";
import { findOrCreateCustomer } from "../contact-identity";
import { recordInbound } from "../enquiry-messages";
import { resolveThread } from "../enquiry-threading";
import {
  isEmailReceivedEvent,
  parseResendInbound,
  type ResendInboundDeps,
} from "./email";
import { inboundEmailDomain } from "./email-format";

/**
 * The single inbound-email orchestration: fetch → parse → identity → thread →
 * message. The webhook route and the Studio › Channels retry button both call
 * exactly this, so replaying a stored payload behaves identically to the
 * original delivery.
 *
 * Idempotency is enforced twice: a fast lookup on `EnquiryMessage.externalId`
 * before any network call (a replay must not re-hit the Resend API), and
 * `recordInbound`'s own unique-constraint handling for a genuine race.
 *
 * Errors are NOT swallowed here — the caller turns them into a WebhookFailure
 * row so the failure is visible and replayable.
 */

export type IngestOutcome =
  | {
      status: "recorded";
      enquiryId: string;
      messageId: string;
      createdEnquiry: boolean;
    }
  | { status: "duplicate"; enquiryId: string; messageId: string }
  | {
      status: "ignored";
      reason: "unsupported_event" | "auto_reply" | "self_addressed";
    };

export async function ingestResendEvent(
  event: unknown,
  deps?: ResendInboundDeps,
): Promise<IngestOutcome> {
  if (!isEmailReceivedEvent(event)) {
    return { status: "ignored", reason: "unsupported_event" };
  }

  const externalId = event.data.email_id;
  const existing = await prisma.enquiryMessage.findUnique({
    where: { externalId },
    select: { id: true, enquiryId: true },
  });
  if (existing) {
    return {
      status: "duplicate",
      enquiryId: existing.enquiryId,
      messageId: existing.id,
    };
  }

  const parsed = deps
    ? await parseResendInbound(event, deps)
    : await parseResendInbound(event);

  // Anything from our own send domain is our own mail coming back (a loop, a
  // forward, a mailer-daemon). Never thread it as customer traffic.
  //
  // This is tested BEFORE `autoSubmitted` on purpose: `parseResendInbound`
  // already folds "sender is on our own domain" into its `autoSubmitted` flag,
  // so checking that first would report every loop as `auto_reply` and hide
  // the misconfiguration that actually caused it. Both drop the message; only
  // the reason staff see on the Channels page differs.
  const domain = inboundEmailDomain();
  if (domain && parsed.fromAddress.endsWith(`@${domain}`)) {
    return { status: "ignored", reason: "self_addressed" };
  }

  // An out-of-office or a bounce is not the customer talking to us: recording
  // it would flip a thread to `customer_replied` and badge the inbox.
  if (parsed.autoSubmitted) return { status: "ignored", reason: "auto_reply" };

  const customer = await findOrCreateCustomer({
    email: parsed.fromAddress,
    name: parsed.fromName,
  });

  const thread = await resolveThread({
    customerId: customer.id,
    channel: "email",
    // A reply token only ever threads onto an enquiry belonging to THIS
    // customer — `resolveThread` enforces that by customerId, which matters
    // because the References-header fallback is sender-controllable.
    threadToken: parsed.threadToken,
    // Sender display name, else the CRM name (itself never blank — it falls
    // back to the email local part when the customer was created nameless).
    contactName: parsed.fromName ?? customer.name,
    contactEmail: parsed.fromAddress,
    contactPhone: customer.phone,
    subject: parsed.subject,
    now: parsed.receivedAt,
  });

  const row = await recordInbound({
    enquiryId: thread.enquiryId,
    customerId: customer.id,
    channel: "email",
    bodyText: parsed.bodyText,
    bodyHtml: parsed.bodyHtml,
    subject: parsed.subject,
    fromName: parsed.fromName,
    fromAddress: parsed.fromAddress,
    externalId: parsed.externalId,
    messageIdHeader: parsed.messageId,
    attachments: parsed.attachments,
    at: parsed.receivedAt,
  });

  // `row.enquiryId`, not `thread.enquiryId`: when two deliveries of the same
  // email race, both can resolve a thread before either writes, and the one
  // that loses the unique index gets the winner's row back. Reporting the
  // thread it *would* have used would point the caller (and the retry button's
  // "view enquiry" link) at an empty enquiry that holds no message.
  return {
    status: "recorded",
    enquiryId: row.enquiryId,
    messageId: row.id,
    createdEnquiry: thread.created && row.enquiryId === thread.enquiryId,
  };
}
