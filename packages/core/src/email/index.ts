/* CONTRACT (Phase 5 implements the body + templates; Phase 6 calls sendEmail).
   Keep this signature; add templates/clients in src/lib/email as needed. */
import { prisma } from "@bnb/core/db";
import { renderEmail } from "./render";

export type EmailType =
  | "confirmation"
  | "reminder"
  | "receipt"
  | "aftercare"
  | "review_request"
  | "enquiry_ack"
  | "loyalty_reward"
  | "staff_invite";

export interface SendEmailInput {
  to: string;
  type: EmailType;
  customerId?: string | null;
  relatedBookingId?: string | null;
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
function toDbStatus(status: SendEmailResult["status"]): "sent" | "failed" | "logged" {
  // The schema has no `skipped`; log-only sends are recorded as `logged`.
  return status === "skipped" ? "logged" : status;
}

/**
 * Renders the template for `input.type`, sends it via Resend when
 * `RESEND_API_KEY` is configured, otherwise logs only (console + DB). It NEVER
 * throws on a missing key, and ALWAYS attempts to write a MessageLog row.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
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
        from: FROM_ADDRESS,
        to: input.to,
        subject,
        html,
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
        type: input.type,
        channel: "email",
        subject: subject || null,
        body: html || null,
        status: toDbStatus(status),
        sentAt,
      },
    });
    id = providerId ?? log.id;
  } catch (err) {
    console.error(`[email] failed to write MessageLog for "${input.type}":`, err);
    if (!id) id = `unlogged_${Date.now()}`;
  }

  return { id, status };
}
