"use server";

/**
 * Customer-detail server actions (BACKOFHOUSE-IA F2): edit notes + marketing
 * consent, and send a manual email (logged to the customer timeline via
 * MessageLog). All require a signed-in staff user; non-owners are scoped to
 * customers they have a booking with (PII guard).
 */
import { revalidatePath } from "next/cache";
import { requireRole } from "@bnb/core/auth";
import { prisma } from "@bnb/core/db";
import { sendEmail } from "@bnb/core/email";
import { validateManualEmail, validateNotes } from "./action-helpers";

async function assertCanAccessCustomer(
  customerId: string,
): Promise<{ email: string | null; name: string }> {
  const user = await requireRole();
  if (user.role === "OWNER") {
    const c = await prisma.customer.findUniqueOrThrow({
      where: { id: customerId },
      select: { email: true, name: true },
    });
    return c;
  }
  // Non-owner: must share a booking with this customer.
  const c = await prisma.customer.findFirstOrThrow({
    where: {
      id: customerId,
      bookings: { some: { artistId: user.artistId ?? "__none__" } },
    },
    select: { email: true, name: true },
  });
  return c;
}

export interface ActionState {
  ok: boolean;
  message?: string;
}

export async function saveCustomerNotes(
  customerId: string,
  input: { notes: string; marketingConsent: boolean },
): Promise<ActionState> {
  await assertCanAccessCustomer(customerId);
  const patch = validateNotes(input);
  await prisma.customer.update({
    where: { id: customerId },
    data: { notes: patch.notes, marketingConsent: patch.marketingConsent },
  });
  revalidatePath(`/customers/${customerId}`);
  return { ok: true, message: "Saved." };
}

export async function sendManualEmail(
  customerId: string,
  input: { subject: string; body: string },
): Promise<ActionState> {
  const customer = await assertCanAccessCustomer(customerId);
  const valid = validateManualEmail(input);
  if (!valid.ok) return { ok: false, message: valid.error };
  if (!customer.email) {
    return { ok: false, message: "This customer has no email on file." };
  }

  // Free-form staff message: rendered in the branded staff-reply template and
  // sent via the email service, which writes the MessageLog row itself
  // (sent / logged / failed) — no extra log here.
  const result = await sendEmail({
    to: customer.email,
    type: "staff_reply",
    customerId,
    data: {
      customerName: customer.name,
      subject: valid.subject,
      body: valid.body,
    },
  });
  if (result.status === "failed") {
    return {
      ok: false,
      message: "The email failed to send — check the email integration.",
    };
  }

  revalidatePath(`/customers/${customerId}`);
  return {
    ok: true,
    message:
      result.status === "sent"
        ? "Email sent and logged to the timeline."
        : "Email logged to the timeline (delivery not configured).",
  };
}
