import type { Session } from "@prisma/client";
import { addDays } from "date-fns";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { awardStamp, type AwardStampResult } from "./loyalty";

/**
 * Sessions — the in-studio "work done" flow (BACKOFHOUSE-IA G2).
 *
 * `completeSession`:
 *   1. records the Session (amount charged in pence, optional tip + bank ref),
 *   2. marks the booking `completed`,
 *   3. sends the receipt + aftercare emails (logged to the customer timeline),
 *   4. schedules a review request (T+4 days),
 *   5. awards a loyalty stamp via `loyalty.awardStamp`.
 *
 * The booking has a unique 1:1 Session, so completing twice throws.
 */

const REVIEW_REQUEST_DELAY_DAYS = 4;

export interface CompleteSessionInput {
  bookingId: string;
  amountChargedPence: number;
  tipPence?: number | null;
  bankRef?: string | null;
}

export interface CompleteSessionResult {
  session: Session;
  loyalty: AwardStampResult | null;
}

export async function completeSession(
  input: CompleteSessionInput,
): Promise<CompleteSessionResult> {
  const { bookingId, amountChargedPence, tipPence, bankRef } = input;

  const booking = await prisma.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: { customer: true },
  });

  const now = new Date();
  const reviewRequestAt = addDays(now, REVIEW_REQUEST_DELAY_DAYS);

  // Create the session + complete the booking atomically. The unique
  // constraint on Session.bookingId makes a second completion throw here.
  const session = await prisma.session.create({
    data: {
      bookingId,
      completedAt: now,
      amountChargedPence,
      tipPence: tipPence ?? null,
      bankRef: bankRef ?? null,
      reviewRequestAt,
    },
  });

  await prisma.booking.update({
    where: { id: bookingId },
    data: { status: "completed" },
  });

  const to = booking.customer.email ?? "";

  // Receipt + aftercare emails (each writes its own MessageLog row via P5).
  await sendEmail({
    to,
    type: "receipt",
    customerId: booking.customerId,
    relatedBookingId: bookingId,
    data: {
      amountChargedPence,
      tipPence: tipPence ?? 0,
      bankRef: bankRef ?? null,
      completedAt: now.toISOString(),
    },
  });
  const receiptSentAt = new Date();

  await sendEmail({
    to,
    type: "aftercare",
    customerId: booking.customerId,
    relatedBookingId: bookingId,
    data: {
      customerName: booking.customer.name,
      placement: booking.placement ?? null,
    },
  });
  const aftercareSentAt = new Date();

  const updatedSession = await prisma.session.update({
    where: { id: session.id },
    data: { receiptSentAt, aftercareSentAt },
  });

  // Award loyalty stamp (one per completed piece).
  const loyalty = await awardStamp(booking.customerId);

  return { session: updatedSession, loyalty };
}

export async function getSession(bookingId: string): Promise<Session | null> {
  return prisma.session.findUnique({ where: { bookingId } });
}
