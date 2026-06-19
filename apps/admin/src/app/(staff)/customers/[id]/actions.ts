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
import { validateManualEmail, validateNotes } from "./action-helpers";

async function assertCanAccessCustomer(
  customerId: string,
): Promise<{ email: string | null }> {
  const user = await requireRole();
  if (user.role === "OWNER") {
    const c = await prisma.customer.findUniqueOrThrow({
      where: { id: customerId },
      select: { email: true },
    });
    return c;
  }
  // Non-owner: must share a booking with this customer.
  const c = await prisma.customer.findFirstOrThrow({
    where: {
      id: customerId,
      bookings: { some: { artistId: user.artistId ?? "__none__" } },
    },
    select: { email: true },
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

  // Manual emails are free-form (no template); record them on the timeline.
  // When Resend is configured a real send could be wired here later; for now
  // we log the intent so the timeline reflects it.
  await prisma.messageLog.create({
    data: {
      customerId,
      type: "confirmation",
      channel: "email",
      subject: valid.subject,
      body: valid.body,
      status: "logged",
      sentAt: new Date(),
    },
  });

  revalidatePath(`/customers/${customerId}`);
  return { ok: true, message: "Email logged to the timeline." };
}
