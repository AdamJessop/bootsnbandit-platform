"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@bnb/core/auth";
import type { ArtistShowcase } from "@bnb/core/services/artist-showcase";
import { loadArtistShowcase } from "@bnb/core/services/artist-showcase";
import { BookingConflictError } from "@bnb/core/services/bookings";
import {
  CONSENT_FIELD_MAX,
  CURRENT_CONSENT_FORM,
  MEDICAL_NOTES_MAX,
  allAnswered,
  consentDetailsErrors,
  consentSnapshot,
  furtherDetailsRequired,
  idProvidedText,
  isFormFlagged,
  normalisePostcode,
} from "@bnb/core/consent";
import {
  ReceptionCheckinError,
  checkInCustomer,
  consentNeedsAck,
  createWalkInBooking,
  kioskPinConfigured,
  setStaffCheckin,
  verifyKioskPin,
} from "@bnb/core/services/reception";
import {
  SessionCompletionError,
  completeSession,
} from "@bnb/core/services/sessions";
import { pinThrottle } from "./pin-throttle";

/**
 * Kiosk server actions. Every mutation requires the kiosk to be signed in
 * (staff passkey session) and revalidates the board so the next render shows
 * fresh data. Known domain errors return friendly messages for the toast;
 * anything else is a generic failure (details stay in the server log).
 */

export type ActionResult = { ok: true } | { ok: false; error: string };
export type ShowcaseActionResult =
  | { ok: true; data: ArtistShowcase }
  | { ok: false; error: string };

const SIGNED_OUT_MSG =
  "The kiosk is signed out — sign in again from the front desk";
const GENERIC_MSG = "Something went wrong — give it another try";

const SIGNED_OUT: ActionResult = { ok: false, error: SIGNED_OUT_MSG };
const GENERIC: ActionResult = { ok: false, error: GENERIC_MSG };

async function kioskSignedIn(): Promise<boolean> {
  return (await getCurrentUser()) != null;
}

function friendlyMessage(err: unknown): string {
  if (
    err instanceof ReceptionCheckinError ||
    err instanceof SessionCompletionError ||
    err instanceof BookingConflictError
  ) {
    return err.message;
  }
  console.error("[reception] action failed", err);
  return GENERIC_MSG;
}

function friendly(err: unknown): ActionResult {
  return { ok: false, error: friendlyMessage(err) };
}

// ---------------------------------------------------------------------------
// Staff check-in / out
// ---------------------------------------------------------------------------

export async function toggleStaffAction(
  artistId: string,
  present: boolean,
): Promise<ActionResult> {
  if (!(await kioskSignedIn())) return SIGNED_OUT;
  if (!artistId || typeof artistId !== "string") return GENERIC;
  try {
    await setStaffCheckin(artistId, present);
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    return friendly(err);
  }
}

// ---------------------------------------------------------------------------
// Customer check-in (consent form)
// ---------------------------------------------------------------------------

// PNG data URL from a kiosk signature pad (~10–50 KB).
const PNG_PREFIX = "data:image/png;base64,";
const signatureField = z.string().max(1_000_000);
const max = CONSENT_FIELD_MAX;

// Shape only; the form's own rules (details, answers, further details,
// agreement, ID, signatures) are checked below with messages for the kiosk.
const checkinSchema = z.object({
  bookingId: z.string().min(1),
  // The client's half — the yellow fields on the paper form.
  printedName: z.string().max(max.printedName),
  address: z.string().max(max.address),
  postcode: z.string().max(max.postcode + 4),
  phone: z.string().max(max.phone),
  email: z.string().max(max.email).optional(),
  // YYYY-MM-DD from the kiosk date input.
  dob: z.string().max(10),
  answers: z.record(z.string(), z.boolean()),
  medicalNotes: z.string().max(MEDICAL_NOTES_MAX).optional(),
  agreed: z.boolean(),
  signature: signatureField,
  // The artist's half, entered behind the staff gate.
  idType: z.string().max(40),
  idOther: z.string().max(max.idOther).optional(),
  designPlacement: z.string().max(max.designPlacement).optional(),
  artistId: z.string().min(1),
  artistSignature: signatureField,
});

export type CheckinInput = z.infer<typeof checkinSchema>;

/** Why a parsed check-in can't be stored yet, or null when it's complete. */
function checkinProblem(input: CheckinInput): string | null {
  const form = CURRENT_CONSENT_FORM;
  const detailErrors = Object.values(
    consentDetailsErrors({ ...input, email: input.email ?? "" }),
  );
  if (detailErrors.length > 0) return detailErrors[0];
  if (!allAnswered(input.answers, form.questions)) {
    return "Please answer every question on the form";
  }
  if (
    furtherDetailsRequired(input.answers, form.questions) &&
    !input.medicalNotes?.trim()
  ) {
    return "Please give further details about your Yes answers";
  }
  if (!input.agreed) {
    return "Please read and agree to the consent statements";
  }
  if (!input.signature.startsWith(PNG_PREFIX)) {
    return "The client signature is missing";
  }
  if (!idProvidedText(input.idType, input.idOther)) {
    return "Record what ID was shown — or None provided";
  }
  if (!input.artistSignature.startsWith(PNG_PREFIX)) {
    return "The artist signature is missing";
  }
  return null;
}

/**
 * Store the v3 consent form (the studio's paper form, both halves) and check
 * the customer in. Every rule the kiosk enforces is enforced again here; the
 * flag is derived here from the answers and the date of birth, never trusted
 * from the client.
 */
export async function customerCheckinAction(
  input: CheckinInput,
): Promise<ActionResult> {
  if (!(await kioskSignedIn())) return SIGNED_OUT;
  const parsed = checkinSchema.safeParse(input);
  if (!parsed.success) return GENERIC;
  const problem = checkinProblem(parsed.data);
  if (problem) return { ok: false, error: problem };
  const { answers, dob, agreed, idType, idOther, ...rest } = parsed.data;
  const form = CURRENT_CONSENT_FORM;
  try {
    // Only the current form's questions are stored, alongside a snapshot of
    // exactly what was shown and agreed.
    const flagged = isFormFlagged(answers, dob, new Date(), form.questions);
    const [y, m, d] = dob.split("-").map(Number);
    await checkInCustomer({
      ...rest,
      printedName: rest.printedName.trim(),
      address: rest.address.trim(),
      postcode: normalisePostcode(rest.postcode) ?? rest.postcode.trim(),
      phone: rest.phone.trim(),
      email: rest.email?.trim() || null,
      answers: Object.fromEntries(
        form.questions.map((q) => [q.id, answers[q.id]]),
      ),
      flagged,
      formVersion: form.version,
      questions: consentSnapshot(form, agreed),
      dob: new Date(Date.UTC(y, m - 1, d)),
      idProvided: idProvidedText(idType, idOther)!,
    });
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    return friendly(err);
  }
}

// ---------------------------------------------------------------------------
// Staff gate (kiosk PIN)
// ---------------------------------------------------------------------------

/**
 * Check a staff PIN attempt for the kiosk's staff gate. The PIN is verified
 * here against the scrypt hash (never sent to or compared on the client), and
 * repeated wrong guesses lock attempts out for a minute. When no PIN is
 * configured the kiosk shows the hold-to-unlock fallback instead and never
 * calls this.
 */
export async function verifyStaffPinAction(pin: string): Promise<ActionResult> {
  if (!(await kioskSignedIn())) return SIGNED_OUT;
  if (typeof pin !== "string") return GENERIC;
  const wait = pinThrottle.lockedFor();
  if (wait > 0) {
    return {
      ok: false,
      error: `Too many tries — wait ${wait} seconds and try again`,
    };
  }
  try {
    if (await verifyKioskPin(pin)) {
      pinThrottle.reset();
      return { ok: true };
    }
    if (!(await kioskPinConfigured())) {
      return { ok: false, error: "No staff PIN is set for this kiosk" };
    }
    pinThrottle.recordFailure();
    return { ok: false, error: "That PIN isn't right — try again" };
  } catch (err) {
    return friendly(err);
  }
}

// ---------------------------------------------------------------------------
// Walk-in booking
// ---------------------------------------------------------------------------

const walkInSchema = z.object({
  customerName: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(30).optional(),
  // Optional but validated when present — powers receipt/aftercare emails.
  email: z.string().trim().email().max(200).optional(),
  artistId: z.string().min(1),
  startIso: z.string().refine((v) => !Number.isNaN(Date.parse(v)), {
    message: "Invalid start time",
  }),
  durationMin: z
    .number()
    .int()
    .min(15)
    .max(12 * 60),
  type: z.enum(["consult", "session"]),
});

export async function walkInAction(
  input: z.infer<typeof walkInSchema>,
): Promise<ActionResult> {
  if (!(await kioskSignedIn())) return SIGNED_OUT;
  const parsed = walkInSchema.safeParse(input);
  if (!parsed.success) return GENERIC;
  const { customerName, phone, email, artistId, startIso, durationMin, type } =
    parsed.data;
  try {
    await createWalkInBooking({
      customerName,
      phone: phone || null,
      email: email || null,
      artistId,
      start: new Date(startIso),
      durationMin,
      type,
    });
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    return friendly(err);
  }
}

// ---------------------------------------------------------------------------
// Checkout (complete session → receipt + aftercare)
// ---------------------------------------------------------------------------

const checkoutSchema = z.object({
  bookingId: z.string().min(1),
  amountPence: z.number().int().min(0).max(10_000_000),
  consentAcknowledged: z.boolean(),
});

/**
 * Complete a session. A booking with no consent form, or a flagged one, is
 * refused unless the front desk explicitly acknowledged it on the checkout
 * screen — checkout must never pass over a missing form silently.
 */
export async function checkoutAction(
  bookingId: string,
  amountPence: number,
  consentAcknowledged = false,
): Promise<ActionResult> {
  if (!(await kioskSignedIn())) return SIGNED_OUT;
  const parsed = checkoutSchema.safeParse({
    bookingId,
    amountPence,
    consentAcknowledged,
  });
  if (!parsed.success) return GENERIC;
  try {
    if (
      !parsed.data.consentAcknowledged &&
      (await consentNeedsAck(parsed.data.bookingId))
    ) {
      return {
        ok: false,
        error: "Check the consent form warning before completing the session",
      };
    }
    await completeSession({
      bookingId: parsed.data.bookingId,
      amountChargedPence: parsed.data.amountPence,
    });
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    return friendly(err);
  }
}

// ---------------------------------------------------------------------------
// Artist showcase (kiosk board card → full-screen artist profile)
// ---------------------------------------------------------------------------

export async function artistShowcaseAction(
  artistId: string,
): Promise<ShowcaseActionResult> {
  if (!(await kioskSignedIn())) return { ok: false, error: SIGNED_OUT_MSG };
  const parsed = z.string().min(1).safeParse(artistId);
  if (!parsed.success) return { ok: false, error: GENERIC_MSG };
  try {
    const showcase = await loadArtistShowcase(parsed.data);
    if (!showcase) {
      return { ok: false, error: "Artist not found — refresh the board" };
    }
    return { ok: true, data: showcase };
  } catch (err) {
    return { ok: false, error: friendlyMessage(err) };
  }
}
