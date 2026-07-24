import type {
  Booking,
  BookingType,
  ConsentForm,
  StaffCheckin,
} from "@prisma/client";
import { prisma } from "@bnb/core/db";
import { createBooking } from "./bookings";
import { createCustomer, upsertCustomerByContact } from "./customers";

/**
 * Reception (front-desk kiosk) service — the studio-tablet flows:
 *
 *  - `loadReceptionBoard`: everything the kiosk home screen needs in one call
 *    (artists + on-the-floor state, today's bookings with consent/checkout
 *    status).
 *  - `setStaffCheckin`: artist taps in/out for the day (one row per artist per
 *    calendar day; tapping out stamps `checkedOutAt`).
 *  - `checkInCustomer`: customer arrival — stores the signed consent form and
 *    stamps `Booking.checkedInAt`. A needs-review answer flags the form.
 *  - `createWalkInBooking`: front desk books a walk-in for today (creates the
 *    customer when needed; reuses the conflict-aware booking service).
 *
 * Checkout (final price + receipt/aftercare emails + loyalty stamp) is the
 * existing `sessions.completeSession` — the kiosk calls it directly.
 */

export class ReceptionCheckinError extends Error {
  constructor(message = "This booking cannot be checked in") {
    super(message);
    this.name = "ReceptionCheckinError";
  }
}

// ---------------------------------------------------------------------------
// Day helpers
// ---------------------------------------------------------------------------

/** Local-day window [00:00, 24:00) for the given instant. */
export function dayWindow(now: Date = new Date()): { from: Date; to: Date } {
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + 1);
  return { from, to };
}

/**
 * Canonical value for `StaffCheckin.date` (a Postgres DATE column): UTC
 * midnight of the LOCAL calendar day, so the [artistId, date] unique key is
 * stable regardless of server timezone or time of day.
 */
export function checkinDate(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

// ---------------------------------------------------------------------------
// Board loader
// ---------------------------------------------------------------------------

export interface BoardArtist {
  id: string;
  name: string;
  /** Studio title enum (CO_OWNER | RESIDENT | APPRENTICE). */
  status: string;
  tag: string | null;
  headshot: string | null;
  hue: string | null;
  hourlyRatePence: number | null;
  onLeave: boolean;
  /** Checked in via the kiosk today and not yet checked out. */
  checkedIn: boolean;
}

export interface BoardSession {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  artistId: string;
  /** ISO datetime strings — client-safe (serialisable) payload. */
  start: string;
  end: string;
  durationMin: number;
  type: BookingType;
  status: string;
  checkedInAt: string | null;
  /** null = no consent form yet; true/false = signed, flagged or clean. */
  consentFlagged: boolean | null;
  completed: boolean;
  amountChargedPence: number | null;
}

export interface ReceptionBoard {
  artists: BoardArtist[];
  sessions: BoardSession[];
}

export async function loadReceptionBoard(
  now: Date = new Date(),
): Promise<ReceptionBoard> {
  const { from, to } = dayWindow(now);

  const [artists, leaves, checkins, bookings] = await Promise.all([
    prisma.artist.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        status: true,
        tag: true,
        headshot: true,
        hue: true,
        hourlyRatePence: true,
      },
    }),
    prisma.leave.findMany({
      where: {
        status: "approved",
        startDate: { lt: to },
        endDate: { gte: from },
      },
      select: { artistId: true },
    }),
    prisma.staffCheckin.findMany({
      where: { date: checkinDate(now) },
      select: { artistId: true, checkedOutAt: true },
    }),
    prisma.booking.findMany({
      where: {
        start: { gte: from, lt: to },
        status: { notIn: ["cancelled", "no_show"] },
      },
      orderBy: { start: "asc" },
      include: {
        customer: {
          select: { id: true, name: true, phone: true, email: true },
        },
        consentForm: { select: { flagged: true } },
        session: { select: { amountChargedPence: true } },
      },
    }),
  ]);

  const onLeave = new Set(leaves.map((l) => l.artistId));
  const onFloor = new Set(
    checkins.filter((c) => !c.checkedOutAt).map((c) => c.artistId),
  );

  return {
    artists: artists.map((a) => ({
      id: a.id,
      name: a.name,
      status: a.status,
      tag: a.tag,
      headshot: a.headshot,
      hue: a.hue,
      hourlyRatePence: a.hourlyRatePence,
      onLeave: onLeave.has(a.id),
      checkedIn: onFloor.has(a.id),
    })),
    sessions: bookings.map((b) => ({
      id: b.id,
      customerId: b.customer.id,
      customerName: b.customer.name,
      customerPhone: b.customer.phone,
      customerEmail: b.customer.email,
      artistId: b.artistId,
      start: b.start.toISOString(),
      end: b.end.toISOString(),
      durationMin: b.durationMin,
      type: b.type,
      status: b.status,
      checkedInAt: b.checkedInAt ? b.checkedInAt.toISOString() : null,
      consentFlagged: b.consentForm ? b.consentForm.flagged : null,
      completed: b.status === "completed" || b.session != null,
      amountChargedPence: b.session?.amountChargedPence ?? null,
    })),
  };
}

// ---------------------------------------------------------------------------
// Staff check-in / out
// ---------------------------------------------------------------------------

export async function setStaffCheckin(
  artistId: string,
  present: boolean,
  now: Date = new Date(),
): Promise<StaffCheckin> {
  const date = checkinDate(now);
  return prisma.staffCheckin.upsert({
    where: { artistId_date: { artistId, date } },
    create: { artistId, date, checkedInAt: now },
    update: present
      ? // Tapping back in re-opens the day (fresh arrival time kept from the
        // first check-in; we only clear the check-out stamp).
        { checkedOutAt: null }
      : { checkedOutAt: now },
  });
}

// ---------------------------------------------------------------------------
// Customer check-in (consent form)
// ---------------------------------------------------------------------------

export interface CheckInCustomerInput {
  bookingId: string;
  /** Question id → answer (true = yes). */
  answers: Record<string, boolean>;
  /** Any needs-review answer — front desk should have a word before starting. */
  flagged: boolean;
  /** Signature PNG data URL captured on the kiosk pad. */
  signature: string;
}

export interface CheckInCustomerResult {
  booking: Booking;
  consentForm: ConsentForm;
}

export async function checkInCustomer(
  input: CheckInCustomerInput,
): Promise<CheckInCustomerResult> {
  const booking = await prisma.booking.findUnique({
    where: { id: input.bookingId },
    include: { consentForm: { select: { id: true } } },
  });
  if (!booking) throw new ReceptionCheckinError("Booking not found");
  if (booking.status === "cancelled" || booking.status === "no_show") {
    throw new ReceptionCheckinError(
      `Cannot check in a ${booking.status} booking`,
    );
  }
  if (booking.consentForm) {
    throw new ReceptionCheckinError("This booking has already been checked in");
  }

  const consentForm = await prisma.consentForm.create({
    data: {
      bookingId: booking.id,
      answers: input.answers,
      flagged: input.flagged,
      signature: input.signature,
    },
  });
  const updated = await prisma.booking.update({
    where: { id: booking.id },
    data: { checkedInAt: new Date() },
  });
  return { booking: updated, consentForm };
}

// ---------------------------------------------------------------------------
// Walk-in booking
// ---------------------------------------------------------------------------

export interface WalkInInput {
  customerName: string;
  phone?: string | null;
  email?: string | null;
  artistId: string;
  start: Date;
  durationMin: number;
  type: Extract<BookingType, "consult" | "session">;
}

export async function createWalkInBooking(
  input: WalkInInput,
): Promise<Booking> {
  const name = input.customerName.trim();
  const phone = input.phone?.trim() || null;
  const email = input.email?.trim() || null;

  // Match an existing customer by contact details when we have any; a
  // name-only walk-in is always a fresh customer row.
  const customer =
    phone || email
      ? await upsertCustomerByContact({ name, phone, email })
      : await createCustomer({ name });

  const end = new Date(input.start.getTime() + input.durationMin * 60_000);
  return createBooking({
    customerId: customer.id,
    artistId: input.artistId,
    type: input.type,
    start: input.start,
    end,
    durationMin: input.durationMin,
    status: "confirmed",
    notes: "Walk-in (front desk)",
  });
}
