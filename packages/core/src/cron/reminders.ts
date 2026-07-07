import { prisma } from "@bnb/core/db";
import { sendEmail } from "@bnb/core/email";

/**
 * Reminders cron job (P12).
 *
 * Finds `confirmed` bookings starting within the next ~48h (covers both the
 * T-48h and T-24h windows) that have reminders opted-in, and emails a reminder
 * to each — UNLESS one was already sent. Idempotent: dedupes by counting an
 * existing `reminder` MessageLog for that booking. Safe to run hourly/daily.
 */

export interface CronJobResult {
  job: string;
  sent: number;
  skipped: number;
}

const WINDOW_HOURS = 48;

function formatWhen(start: Date): string {
  return start.toLocaleString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
  });
}

export async function runReminders(
  now: Date = new Date(),
): Promise<CronJobResult> {
  const horizon = new Date(now.getTime() + WINDOW_HOURS * 3600_000);

  const bookings = await prisma.booking.findMany({
    where: {
      status: "confirmed",
      remindersOptIn: true,
      start: { gte: now, lte: horizon },
    },
    include: {
      customer: { select: { id: true, name: true, email: true } },
      artist: { select: { name: true } },
    },
  });

  let sent = 0;
  let skipped = 0;

  for (const b of bookings) {
    const email = b.customer.email?.trim();
    if (!email) {
      skipped += 1;
      continue;
    }

    // Idempotency: skip if a reminder was already logged for this booking.
    const existing = await prisma.messageLog.count({
      where: { relatedBookingId: b.id, type: "reminder" },
    });
    if (existing > 0) {
      skipped += 1;
      continue;
    }

    await sendEmail({
      to: email,
      type: "reminder",
      customerId: b.customerId,
      relatedBookingId: b.id,
      data: {
        customerName: b.customer.name,
        artistName: b.artist.name,
        date: formatWhen(b.start),
      },
    });
    sent += 1;
  }

  return { job: "reminders", sent, skipped };
}
