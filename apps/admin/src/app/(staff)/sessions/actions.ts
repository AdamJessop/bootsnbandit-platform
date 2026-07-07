"use server";

/**
 * Sessions server actions (BACKOFHOUSE-IA G3): re-send the receipt email for a
 * completed session. Owner = any session; artist = own sessions only. The
 * email goes through @bnb/core sendEmail with the exact same data keys
 * completeSession uses, and refreshes Session.receiptSentAt on success.
 */
import { revalidatePath } from "next/cache";
import { requireRole } from "@bnb/core/auth";
import { prisma } from "@bnb/core/db";
import { sendEmail } from "@bnb/core/email";
import { buildReceiptEmailData } from "./receipt-resend";

export interface ActionState {
  ok: boolean;
  message?: string;
}

export async function resendReceipt(sessionId: string): Promise<ActionState> {
  const user = await requireRole();
  const session = await prisma.session.findUniqueOrThrow({
    where: { id: sessionId },
    include: {
      booking: {
        select: {
          id: true,
          artistId: true,
          customerId: true,
          customer: { select: { name: true, email: true } },
        },
      },
    },
  });

  // Owner-or-self: an artist may only resend receipts for their own sessions.
  if (user.role !== "OWNER" && session.booking.artistId !== user.artistId) {
    return { ok: false, message: "Forbidden" };
  }

  const to = session.booking.customer.email?.trim();
  if (!to) {
    return { ok: false, message: "This customer has no email on file." };
  }

  // sendEmail writes the MessageLog row itself (sent / logged / failed).
  const result = await sendEmail({
    to,
    type: "receipt",
    customerId: session.booking.customerId,
    relatedBookingId: session.booking.id,
    data: buildReceiptEmailData({
      customerName: session.booking.customer.name,
      amountChargedPence: session.amountChargedPence,
      tipPence: session.tipPence,
      bankRef: session.bankRef,
    }),
  });
  if (result.status === "failed") {
    return {
      ok: false,
      message:
        "The receipt email failed to send — check the email integration.",
    };
  }

  await prisma.session.update({
    where: { id: sessionId },
    data: { receiptSentAt: new Date() },
  });

  revalidatePath("/sessions");
  return {
    ok: true,
    message:
      result.status === "sent"
        ? "Receipt re-sent."
        : "Receipt logged (email delivery not configured).",
  };
}
