import { Prisma } from "@prisma/client";
import type {
  Booking,
  BookingType,
  ConsentForm,
  StaffCheckin,
} from "@prisma/client";
import { prisma } from "@bnb/core/db";
import type { ConsentQuestion } from "@bnb/core/consent";
import { createBooking } from "./bookings";
import { hashPassword, verifyPassword } from "./customer-auth";
import { createCustomer, upsertCustomerByContact } from "./customers";

/**
 * Reception (front-desk kiosk) service — the studio-tablet flows:
 *
 *  - `loadReceptionBoard`: everything the kiosk home screen needs in one call
 *    (artists + on-the-floor state, today's bookings with consent/checkout
 *    status).
 *  - `setStaffCheckin`: artist taps in/out for the day (one row per artist per
 *    calendar day; tapping out stamps `checkedOutAt`).
 *  - `checkInCustomer`: customer arrival — stores the signed consent form
 *    (with its question/version snapshot, DOB and who checked ID) and stamps
 *    `Booking.checkedInAt`, in one transaction. A needs-review answer flags
 *    the form.
 *  - `consentNeedsAck`: whether checkout needs a staff acknowledgement first
 *    (no form on file, or a flagged one).
 *  - Kiosk PIN (`kioskPinConfigured` / `verifyKioskPin` / `setKioskPin`): the
 *    studio-wide staff PIN that gates staff actions on the shared tablet.
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
  /** Staff name recorded as having checked photo ID at check-in. */
  idCheckedBy: string | null;
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
        consentForm: { select: { flagged: true, idCheckedBy: true } },
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
      idCheckedBy: b.consentForm?.idCheckedBy ?? null,
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
  /** Snapshot of the form as shown — see `@bnb/core/consent`. */
  formVersion: number;
  questions: ReadonlyArray<ConsentQuestion>;
  /** The customer's full name as they typed it on the form. */
  printedName: string;
  /** Date of birth (UTC midnight of the calendar date — a DATE column). */
  dob: Date;
  medicalNotes?: string | null;
  /** Portfolio/socials photo consent; null = not answered. */
  photoConsent?: boolean | null;
  /** The artist (staff member) who checked the customer's photo ID. */
  idCheckedByArtistId: string;
}

export interface CheckInCustomerResult {
  booking: Booking;
  consentForm: ConsentForm;
}

/**
 * Store the signed consent form and mark the customer arrived. One
 * transaction: the form, the booking's `checkedInAt` and (when the customer
 * record has none yet) their date of birth are written together or not at
 * all. The ID checker's name is resolved here from the artist row — never
 * trusted from the client — and snapshotted so the record survives renames.
 */
export async function checkInCustomer(
  input: CheckInCustomerInput,
  now: Date = new Date(),
): Promise<CheckInCustomerResult> {
  try {
    return await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: input.bookingId },
        include: {
          consentForm: { select: { id: true } },
          customer: { select: { id: true, dob: true } },
        },
      });
      if (!booking) throw new ReceptionCheckinError("Booking not found");
      if (booking.status === "cancelled" || booking.status === "no_show") {
        throw new ReceptionCheckinError(
          `Cannot check in a ${booking.status} booking`,
        );
      }
      if (booking.consentForm) {
        throw new ReceptionCheckinError(
          "This booking has already been checked in",
        );
      }

      const checker = await tx.artist.findFirst({
        where: { id: input.idCheckedByArtistId, active: true },
        select: { id: true, name: true },
      });
      if (!checker) {
        throw new ReceptionCheckinError(
          "Pick who checked the photo ID and try again",
        );
      }

      const consentForm = await tx.consentForm.create({
        data: {
          bookingId: booking.id,
          answers: input.answers,
          flagged: input.flagged,
          signature: input.signature,
          formVersion: input.formVersion,
          questions: input.questions.map((q) => ({ ...q })),
          printedName: input.printedName,
          dob: input.dob,
          medicalNotes: input.medicalNotes?.trim() || null,
          photoConsent: input.photoConsent ?? null,
          idCheckedBy: checker.name,
          idCheckedByArtistId: checker.id,
          idCheckedAt: now,
        },
      });
      const updated = await tx.booking.update({
        where: { id: booking.id },
        data: { checkedInAt: now },
      });
      if (!booking.customer.dob) {
        await tx.customer.update({
          where: { id: booking.customer.id },
          data: { dob: input.dob },
        });
      }
      return { booking: updated, consentForm };
    });
  } catch (err) {
    // Two tablets (or a double tap) racing the same booking: the loser hits
    // the unique ConsentForm.bookingId inside its transaction.
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new ReceptionCheckinError(
        "This booking has already been checked in",
      );
    }
    throw err;
  }
}

/**
 * Checkout must not pass silently over a missing or flagged consent form:
 * true when staff have to acknowledge it first. Unknown bookings return
 * false — `completeSession` reports those itself.
 */
export async function consentNeedsAck(bookingId: string): Promise<boolean> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { consentForm: { select: { flagged: true } } },
  });
  if (!booking) return false;
  return booking.consentForm == null || booking.consentForm.flagged;
}

// ---------------------------------------------------------------------------
// Kiosk staff PIN
// ---------------------------------------------------------------------------

/**
 * The shared tablet is signed in once with a staff passkey, so everyone who
 * walks up to it is "signed in". The studio-wide PIN is what separates staff
 * actions (tap in/out, walk-ins, checkout, sign out) from customers. It is
 * stored scrypt-hashed on the SiteSettings singleton; with no PIN set the
 * kiosk falls back to a hold-to-unlock gate (see the kiosk's StaffGate).
 * There is deliberately no admin UI for it yet — set it with
 * `npm run kiosk:pin`.
 */
export const KIOSK_PIN_PATTERN = /^\d{4,6}$/;

export class KioskPinError extends Error {
  constructor(message = "The PIN must be 4 to 6 digits") {
    super(message);
    this.name = "KioskPinError";
  }
}

async function kioskPinHash(): Promise<string | null> {
  const settings = await prisma.siteSettings.findFirst({
    orderBy: { createdAt: "asc" },
    select: { kioskPinHash: true },
  });
  return settings?.kioskPinHash ?? null;
}

export async function kioskPinConfigured(): Promise<boolean> {
  return (await kioskPinHash()) != null;
}

/** Constant-time check of a PIN attempt. False when no PIN is configured. */
export async function verifyKioskPin(pin: string): Promise<boolean> {
  if (!KIOSK_PIN_PATTERN.test(pin)) return false;
  const hash = await kioskPinHash();
  if (!hash) return false;
  return verifyPassword(pin, hash);
}

/** Set (or with null, clear) the studio-wide kiosk PIN. */
export async function setKioskPin(pin: string | null): Promise<void> {
  if (pin !== null && !KIOSK_PIN_PATTERN.test(pin)) throw new KioskPinError();
  const settings = await prisma.siteSettings.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!settings) {
    throw new KioskPinError("No site settings row — seed the database first");
  }
  await prisma.siteSettings.update({
    where: { id: settings.id },
    data: { kioskPinHash: pin === null ? null : await hashPassword(pin) },
  });
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
