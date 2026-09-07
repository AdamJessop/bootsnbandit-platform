/* CONTRACT (Phase 5 implements the body + templates; Phase 6 calls sendEmail).
   Keep this signature; add templates/clients in src/lib/email as needed. */
import type { MessageType } from "@prisma/client";
import { prisma } from "@bnb/core/db";
import { recordOutbound } from "@bnb/core/services/enquiry-messages";
import { renderEmail } from "./render";

export type EmailType =
  | "confirmation"
  | "reminder"
  | "receipt"
  | "aftercare"
  | "review_request"
  | "enquiry_ack"
  | "loyalty_reward"
  | "staff_invite"
  | "staff_reply"
  | "welcome";

export interface SendEmailInput {
  to: string;
  type: EmailType;
  customerId?: string | null;
  relatedBookingId?: string | null;
  /**
   * When set, the sent email is also recorded as an outbound EnquiryMessage so
   * it appears on the enquiry's thread. MessageLog is still written for the
   * customer timeline — the two logs serve different screens.
   */
  enquiryId?: string | null;
  /**
   * The staff user this send is attributable to, recorded on the outbound
   * thread message so the inbox can name who replied. Automatic mail (acks,
   * reminders) leaves it unset.
   */
  authorUserId?: string | null;
  /**
   * Overrides the default studio From. Enquiry replies use it to put the
   * artist's name on the studio address (spec decision 6); everything
   * transactional leaves it unset.
   */
  from?: string | null;
  /** Reply-To — the per-enquiry inbound token address. */
  replyTo?: string | null;
  /** Extra RFC headers (In-Reply-To / References for mail-client threading). */
  headers?: Record<string, string> | null;
  data: Record<string, unknown>;
}

/** Public-facing outcome. `skipped` = log-only (no API key); maps to DB `logged`. */
export interface SendEmailResult {
  id: string;
  status: "sent" | "skipped" | "failed";
}

const FROM_ADDRESS =
  process.env.EMAIL_FROM ?? "Boots 'n' Bandit <hello@bootsnbandit.co.uk>";

/** Public send status -> MessageStatus enum value in the DB schema. */
function toDbStatus(
  status: SendEmailResult["status"],
): "sent" | "failed" | "logged" {
  // The schema has no `skipped`; log-only sends are recorded as `logged`.
  return status === "skipped" ? "logged" : status;
}

/**
 * Renders the template for `input.type`, sends it via Resend when
 * `RESEND_API_KEY` is configured, otherwise logs only (console + DB). It NEVER
 * throws on a missing key, and ALWAYS attempts to write a MessageLog row.
 */
export async function sendEmail(
  input: SendEmailInput,
): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();

  // 1. Render the template (best-effort — a render failure must not throw).
  let subject = "";
  let html = "";
  try {
    const rendered = await renderEmail(input.type, input.data ?? {});
    subject = rendered.subject;
    html = rendered.html;
  } catch (err) {
    console.error(`[email] failed to render template "${input.type}":`, err);
  }

  // 2. Decide outcome: send via Resend, or log-only when no key.
  let status: SendEmailResult["status"];
  let providerId: string | null = null;

  if (!apiKey || !html) {
    if (!apiKey) {
      console.info(
        `[email] RESEND_API_KEY not set — logging "${input.type}" to ${input.to} (no send).`,
      );
    }
    status = "skipped";
  } else {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(apiKey);
      const { data, error } = await resend.emails.send({
        from: input.from?.trim() || FROM_ADDRESS,
        to: input.to,
        subject,
        html,
        // Only send the optional fields when they carry something: an empty
        // `headers: {}` is noise in the API log and in every test assertion.
        ...(input.replyTo ? { replyTo: input.replyTo } : {}),
        ...(input.headers && Object.keys(input.headers).length > 0
          ? { headers: input.headers }
          : {}),
      });
      if (error) {
        console.error(`[email] Resend error for "${input.type}":`, error);
        status = "failed";
      } else {
        providerId = data?.id ?? null;
        status = "sent";
      }
    } catch (err) {
      console.error(`[email] send threw for "${input.type}":`, err);
      status = "failed";
    }
  }

  // 3. Always write a MessageLog row (failures here are swallowed, never thrown).
  const sentAt = status === "sent" ? new Date() : null;
  let id = providerId ?? "";
  try {
    const log = await prisma.messageLog.create({
      data: {
        customerId: input.customerId ?? null,
        relatedBookingId: input.relatedBookingId ?? null,
        type: input.type as MessageType,
        channel: "email",
        subject: subject || null,
        body: html || null,
        status: toDbStatus(status),
        sentAt,
      },
    });
    id = providerId ?? log.id;
  } catch (err) {
    console.error(
      `[email] failed to write MessageLog for "${input.type}":`,
      err,
    );
    if (!id) id = `unlogged_${Date.now()}`;
  }

  // 4. Mirror the send onto the enquiry thread when this email belongs to one.
  //    Never fatal: a thread write must not fail a delivered email.
  if (input.enquiryId) {
    try {
      await recordOutbound({
        enquiryId: input.enquiryId,
        customerId: input.customerId ?? null,
        channel: "email",
        subject: subject || null,
        bodyText: (input.data?.body as string | undefined) ?? (subject || ""),
        bodyHtml: html || null,
        fromAddress: input.to,
        authorUserId: input.authorUserId ?? null,
        // The provider's message id, when we actually sent: Phase 2 matches
        // inbound replies back onto this thread by it. Null on skipped/failed.
        externalId: providerId,
        deliveryStatus: toDbStatus(status),
      });
    } catch (err) {
      console.error(
        `[email] failed to record EnquiryMessage for "${input.type}":`,
        err,
      );
    }
  }

  return { id, status };
}
