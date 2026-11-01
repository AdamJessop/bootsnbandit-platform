import { Prisma } from "@prisma/client";
import type { Session } from "@prisma/client";
import { addDays } from "date-fns";
import { prisma } from "@bnb/core/db";
import { sendEmail } from "@bnb/core/email";
import { awardStamp, type AwardStampResult } from "./loyalty";

/**
 * Sessions — the in-studio "work done" flow (BACKOFHOUSE-IA G2).
 *
 * `completeSession`:
 *   1. records the Session (amount charged in pence, optional tip + bank ref),
 *   2. marks the booking `completed`,
 *   3. sends the receipt + aftercare emails (logged to the customer timeline),
 *   4. schedules a review request (T+4 days),
 *   5. awards a loyalty stamp via `loyalty.awardStamp` and emails any newly
 *      unlocked perks (marketing-consented customers only).
 *
 * The booking has a unique 1:1 Session, so completing twice throws a
 * `SessionCompletionError` (→ 409 via core/http).
 */

const REVIEW_REQUEST_DELAY_DAYS = 4;

/**
 * A booking that can't be (or has already been) completed — a cancelled /
 * no-show booking, or a double-complete race on the unique Session.bookingId.
 * Mapped to 409 by `@bnb/core/http` (same pattern as FlashUnavailableError).
 */
export class SessionCompletionError extends Error {
  constructor(message = "This booking cannot be completed") {
    super(message);
    this.name = "SessionCompletionError";
  }
}

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

  // TODO(P10): record completedByUserId + reconcile amount

  const booking = await prisma.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: { customer: true },
  });

  // A cancelled / no-show booking never happened — it can't be completed.
  if (booking.status === "cancelled" || booking.status === "no_show") {
    throw new SessionCompletionError(
      `Cannot complete a ${booking.status} booking`,
    );
  }

  const now = new Date();
  const reviewRequestAt = addDays(now, REVIEW_REQUEST_DELAY_DAYS);

  // Create the session + complete the booking atomically. The unique
  // constraint on Session.bookingId makes a second completion throw here —
  // surfaced as a 409 conflict rather than a 500.
  let session: Session;
  try {
    session = await prisma.session.create({
      data: {
        bookingId,
        completedAt: now,
        amountChargedPence,
        tipPence: tipPence ?? null,
        bankRef: bankRef ?? null,
        reviewRequestAt,
      },
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new SessionCompletionError(
        "This booking has already been completed",
      );
    }
    throw err;
  }

  await prisma.booking.update({
    where: { id: bookingId },
    data: { status: "completed" },
  });

  const to = booking.customer.email?.trim();

  // Receipt + aftercare emails (each writes its own MessageLog row via P5).
  // Skipped entirely when the customer has no email address.
  let updatedSession = session;
  if (to) {
    await sendEmail({
      to,
      type: "receipt",
      customerId: booking.customerId,
      relatedBookingId: bookingId,
      data: {
        customerName: booking.customer.name,
        amountPence: amountChargedPence,
        bankRef: bankRef ?? undefined,
        lineItems:
          tipPence && tipPence > 0
            ? [{ label: "Tip", amountPence: tipPence }]
            : [],
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

    updatedSession = await prisma.session.update({
      where: { id: session.id },
      data: { receiptSentAt, aftercareSentAt },
    });
  }

  // Award loyalty stamp (one per completed piece).
  const loyalty = await awardStamp(booking.customerId);

  // Newly unlocked perks are announced by email — marketing content, so only
  // with the customer's consent (transactional emails above stay exempt).
  if (
    loyalty.unlockedPerks.length > 0 &&
    booking.customer.marketingConsent &&
    to
  ) {
    await sendEmail({
      to,
      type: "loyalty_reward",
      customerId: booking.customerId,
      relatedBookingId: bookingId,
      data: {
        customerName: booking.customer.name,
        rewardLabel: loyalty.unlockedPerks.map((p) => p.title).join(", "),
        stamps: loyalty.loyaltyStamps,
        tierLabel: loyalty.tierLabel,
      },
    });
  }

  return { session: updatedSession, loyalty };
}

export async function getSession(bookingId: string): Promise<Session | null> {
  return prisma.session.findUnique({ where: { bookingId } });
}
