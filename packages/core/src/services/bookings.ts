import type { Booking, BookingStatus, BookingType } from "@prisma/client";
import { prisma } from "@bnb/core/db";
import { sendEmail } from "@bnb/core/email";

/**
 * Booking lifecycle service with a leave-aware conflict check.
 *
 * A new/updated booking is rejected when its [start, end) window overlaps:
 *   - another active booking for the same artist, OR
 *   - an approved Leave row for that artist.
 *
 * Two half-open intervals [aStart, aEnd) and [bStart, bEnd) overlap iff
 * aStart < bEnd AND bStart < aEnd.
 */

export class BookingConflictError extends Error {
  readonly kind: "booking" | "leave";
  constructor(kind: "booking" | "leave", message?: string) {
    super(
      message ??
        (kind === "leave"
          ? "Artist is on leave during this slot"
          : "Artist already has a booking in this slot"),
    );
    this.name = "BookingConflictError";
    this.kind = kind;
  }
}

// Statuses that occupy the artist's slot (cancelled / no_show do not block).
const ACTIVE_STATUSES: BookingStatus[] = [
  "enquiry",
  "pending",
  "confirmed",
  "completed",
];

export interface ConflictQuery {
  artistId: string;
  start: Date;
  end: Date;
  /** Exclude this booking id (used when updating an existing booking). */
  excludeBookingId?: string;
}

export interface ConflictHit {
  kind: "booking" | "leave";
  id: string;
}

/**
 * Returns the first conflicting booking/leave, or null when the slot is free.
 */
export async function checkConflict(
  query: ConflictQuery,
): Promise<ConflictHit | null> {
  const { artistId, start, end, excludeBookingId } = query;

  const booking = await prisma.booking.findFirst({
    where: {
      artistId,
      status: { in: ACTIVE_STATUSES },
      ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
      start: { lt: end },
      end: { gt: start },
    },
    select: { id: true },
  });
  if (booking) return { kind: "booking", id: booking.id };

  const leave = await prisma.leave.findFirst({
    where: {
      artistId,
      status: "approved",
      startDate: { lt: end },
      endDate: { gt: start },
    },
    select: { id: true },
  });
  if (leave) return { kind: "leave", id: leave.id };

  return null;
}

async function assertFree(query: ConflictQuery): Promise<void> {
  const hit = await checkConflict(query);
  if (hit) throw new BookingConflictError(hit.kind);
}

/** en-GB long date for the confirmation email (mirrors cron/reminders). */
function formatWhen(start: Date): string {
  return start.toLocaleString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Sends the `confirmation` email for a booking that just entered `confirmed`.
 * Skips when the customer has no email address; dedupes via MessageLog so a
 * booking is only ever confirmed once (matches the cron/reminders pattern).
 * `sendEmail` never throws, so this can't fail the booking write.
 */
async function sendConfirmationEmail(bookingId: string): Promise<void> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      customer: { select: { name: true, email: true } },
      artist: { select: { name: true } },
    },
  });
  if (!booking) return;

  const email = booking.customer.email?.trim();
  if (!email) return;

  // Idempotency: skip if a confirmation was already logged for this booking.
  const existing = await prisma.messageLog.count({
    where: { relatedBookingId: booking.id, type: "confirmation" },
  });
  if (existing > 0) return;

  await sendEmail({
    to: email,
    type: "confirmation",
    customerId: booking.customerId,
    relatedBookingId: booking.id,
    data: {
      customerName: booking.customer.name,
      artistName: booking.artist.name,
      date: formatWhen(booking.start),
      placement: booking.placement ?? undefined,
    },
  });
}

export interface CreateBookingInput {
  customerId: string;
  artistId: string;
  enquiryId?: string | null;
  type: BookingType;
  style?: string | null;
  placement?: string | null;
  start: Date;
  end: Date;
  durationMin: number;
  priceEstimatePence?: number | null;
  depositPence?: number | null;
  status?: BookingStatus;
  notes?: string | null;
  remindersOptIn?: boolean;
}

export async function createBooking(
  input: CreateBookingInput,
): Promise<Booking> {
  await assertFree({
    artistId: input.artistId,
    start: input.start,
    end: input.end,
  });

  const booking = await prisma.booking.create({
    data: {
      customerId: input.customerId,
      artistId: input.artistId,
      enquiryId: input.enquiryId ?? null,
      type: input.type,
      style: input.style ?? null,
      placement: input.placement ?? null,
      start: input.start,
      end: input.end,
      durationMin: input.durationMin,
      priceEstimatePence: input.priceEstimatePence ?? null,
      depositPence: input.depositPence ?? null,
      status: input.status ?? "pending",
      notes: input.notes ?? null,
      remindersOptIn: input.remindersOptIn ?? true,
    },
  });

  if (booking.status === "confirmed") {
    await sendConfirmationEmail(booking.id);
  }

  return booking;
}

export interface UpdateBookingInput {
  artistId?: string;
  type?: BookingType;
  style?: string | null;
  placement?: string | null;
  start?: Date;
  end?: Date;
  durationMin?: number;
  priceEstimatePence?: number | null;
  depositPence?: number | null;
  status?: BookingStatus;
  notes?: string | null;
  remindersOptIn?: boolean;
}

export async function updateBooking(
  id: string,
  input: UpdateBookingInput,
): Promise<Booking> {
  const existing = await prisma.booking.findUniqueOrThrow({ where: { id } });

  const artistId = input.artistId ?? existing.artistId;
  const start = input.start ?? existing.start;
  const end = input.end ?? existing.end;

  // Re-check only when the time window or artist changed.
  const windowChanged =
    input.start !== undefined ||
    input.end !== undefined ||
    input.artistId !== undefined;
  const blocking = input.status
    ? ACTIVE_STATUSES.includes(input.status)
    : ACTIVE_STATUSES.includes(existing.status);

  if (windowChanged && blocking) {
    await assertFree({ artistId, start, end, excludeBookingId: id });
  }

  const updated = await prisma.booking.update({
    where: { id },
    data: {
      artistId: input.artistId,
      type: input.type,
      style: input.style,
      placement: input.placement,
      start: input.start,
      end: input.end,
      durationMin: input.durationMin,
      priceEstimatePence: input.priceEstimatePence,
      depositPence: input.depositPence,
      status: input.status,
      notes: input.notes,
      remindersOptIn: input.remindersOptIn,
    },
  });

  // Transition INTO `confirmed` → send the confirmation email (deduped).
  if (input.status === "confirmed" && existing.status !== "confirmed") {
    await sendConfirmationEmail(updated.id);
  }

  return updated;
}

export async function getBooking(id: string): Promise<Booking | null> {
  return prisma.booking.findUnique({ where: { id } });
}

export interface ListBookingsInput {
  artistId?: string;
  customerId?: string;
  status?: BookingStatus;
  from?: Date;
  to?: Date;
  take?: number;
  skip?: number;
}

export async function listBookings(
  input: ListBookingsInput = {},
): Promise<Booking[]> {
  const {
    artistId,
    customerId,
    status,
    from,
    to,
    take = 100,
    skip = 0,
  } = input;
  return prisma.booking.findMany({
    where: {
      ...(artistId ? { artistId } : {}),
      ...(customerId ? { customerId } : {}),
      ...(status ? { status } : {}),
      ...(from || to
        ? {
            start: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
    },
    orderBy: { start: "asc" },
    take,
    skip,
  });
}
