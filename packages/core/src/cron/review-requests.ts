import { prisma } from "@bnb/core/db";
import { sendEmail } from "@bnb/core/email";
import { generateToken } from "@bnb/core/auth/tokens";
import type { CronJobResult } from "./reminders";

/**
 * Review-requests cron job (P12).
 *
 * Finds completed `Session`s whose `reviewRequestAt` is due (<= now) and which
 * have no prior `review_request` MessageLog for the booking, then:
 *   1. creates a pending `Review` row with a capability token, and
 *   2. emails the customer the `/review/<token>` link.
 * Idempotent via the MessageLog dedupe (no double Review / double send).
 */
export async function runReviewRequests(
  now: Date = new Date(),
): Promise<CronJobResult> {
  const sessions = await prisma.session.findMany({
    where: { reviewRequestAt: { lte: now, not: null } },
    include: {
      booking: {
        include: {
          customer: { select: { id: true, name: true, email: true } },
          artist: { select: { name: true } },
        },
      },
    },
  });

  let sent = 0;
  let skipped = 0;

  for (const s of sessions) {
    const booking = s.booking;
    const email = booking.customer.email?.trim();
    if (!email) {
      skipped += 1;
      continue;
    }

    // Idempotency: skip if a review request was already logged for this booking.
    const existing = await prisma.messageLog.count({
      where: { relatedBookingId: booking.id, type: "review_request" },
    });
    if (existing > 0) {
      skipped += 1;
      continue;
    }

    const token = generateToken();
    const review = await prisma.review.create({
      data: {
        token,
        status: "pending",
        bookingId: booking.id,
        customerId: booking.customerId,
        requestedAt: now,
      },
    });

    await sendEmail({
      to: email,
      type: "review_request",
      customerId: booking.customerId,
      relatedBookingId: booking.id,
      data: {
        customerName: booking.customer.name,
        artistName: booking.artist.name,
        reviewToken: review.token,
      },
    });
    sent += 1;
  }

  return { job: "review_requests", sent, skipped };
}
