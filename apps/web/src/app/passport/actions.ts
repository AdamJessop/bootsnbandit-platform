"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@bnb/core/db";
import { getCustomerSession } from "@/lib/customer-auth";

/**
 * Customer "request cancellation" — flags the booking for staff to action
 * (staff cancel it from the admin bookings screen; self-cancel is out of
 * scope). Ownership is verified against the session's customer id before any
 * write; already-flagged bookings are a friendly no-op.
 */

export interface CancelRequestResult {
  ok: boolean;
  error?: string;
}

export async function requestCancellationAction(
  bookingId: string,
): Promise<CancelRequestResult> {
  const session = await getCustomerSession();
  if (!session) {
    return { ok: false, error: "Please sign in again." };
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      customerId: true,
      status: true,
      cancelRequestedAt: true,
    },
  });
  if (!booking || booking.customerId !== session.sub) {
    return { ok: false, error: "We couldn't find that booking." };
  }
  if (booking.cancelRequestedAt) {
    // Already flagged — nothing more to do.
    return { ok: true };
  }

  await prisma.booking.update({
    where: { id: booking.id },
    data: { cancelRequestedAt: new Date() },
  });
  revalidatePath("/passport");
  return { ok: true };
}
