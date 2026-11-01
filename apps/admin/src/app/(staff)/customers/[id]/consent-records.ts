import {
  consentFormFor,
  isFlaggedAnswer,
  type ConsentQuestion,
} from "@bnb/core/consent";

/**
 * Read-only view model for the signed kiosk consent forms on a customer's
 * record. Pure so the visibility rule and the answer read-back unit-test
 * without a database.
 *
 * Visibility: a consent form is medical information. An owner sees every
 * form; an artist sees only forms for bookings that were theirs — sharing
 * one booking with a customer must not open their forms with other artists.
 */

export interface ConsentFormRow {
  id: string;
  signedAt: Date;
  flagged: boolean;
  answers: unknown;
  signature: string;
  formVersion: number | null;
  questions: unknown;
  printedName: string | null;
  dob: Date | null;
  medicalNotes: string | null;
  photoConsent: boolean | null;
  idCheckedBy: string | null;
  idCheckedAt: Date | null;
}

export interface ConsentBookingRow {
  id: string;
  artistId: string;
  start: Date;
  type: string;
  artist: { name: string };
  consentForm: ConsentFormRow | null;
}

export interface ConsentViewer {
  role: "OWNER" | "ARTIST";
  artistId: string | null;
}

export interface ConsentAnswerView {
  id: string;
  q: string;
  /** "Yes" / "No", or "—" when the stored form has no answer for it. */
  answer: string;
  flagged: boolean;
}

export interface ConsentRecord {
  id: string;
  bookingId: string;
  signedAt: string;
  bookingStart: string;
  bookingType: string;
  artistName: string;
  /** Forms signed before versions were recorded were all v1. */
  version: number;
  flagged: boolean;
  printedName: string | null;
  /** YYYY-MM-DD (a calendar date, no timezone). */
  dob: string | null;
  medicalNotes: string | null;
  photoConsent: boolean | null;
  idCheckedBy: string | null;
  idCheckedAt: string | null;
  signature: string;
  /** Signed on the old pad: light ink on transparent, needs a dark backing. */
  lightInkSignature: boolean;
  answers: ConsentAnswerView[];
}

/** The snapshot stored on the form, falling back to its version's set. */
function questionsFor(form: ConsentFormRow): ReadonlyArray<ConsentQuestion> {
  if (Array.isArray(form.questions) && form.questions.length > 0) {
    return (form.questions as ConsentQuestion[]).filter(
      (q) => q && typeof q.id === "string" && typeof q.q === "string",
    );
  }
  return consentFormFor(form.formVersion).questions;
}

export function buildConsentRecords(
  bookings: ConsentBookingRow[],
  viewer: ConsentViewer,
): ConsentRecord[] {
  return bookings
    .filter(
      (b): b is ConsentBookingRow & { consentForm: ConsentFormRow } =>
        b.consentForm != null &&
        (viewer.role === "OWNER" || b.artistId === viewer.artistId),
    )
    .map((b) => {
      const form = b.consentForm;
      const answers =
        form.answers && typeof form.answers === "object"
          ? (form.answers as Record<string, unknown>)
          : {};
      return {
        id: form.id,
        bookingId: b.id,
        signedAt: form.signedAt.toISOString(),
        bookingStart: b.start.toISOString(),
        bookingType: b.type,
        artistName: b.artist.name,
        version: form.formVersion ?? 1,
        flagged: form.flagged,
        printedName: form.printedName,
        dob: form.dob ? form.dob.toISOString().slice(0, 10) : null,
        medicalNotes: form.medicalNotes,
        photoConsent: form.photoConsent,
        idCheckedBy: form.idCheckedBy,
        idCheckedAt: form.idCheckedAt?.toISOString() ?? null,
        signature: form.signature,
        lightInkSignature: form.formVersion == null,
        answers: questionsFor(form).map((q) => {
          const a = answers[q.id];
          const value = typeof a === "boolean" ? a : undefined;
          return {
            id: q.id,
            q: q.q,
            answer: value === undefined ? "—" : value ? "Yes" : "No",
            flagged: isFlaggedAnswer(q, value),
          };
        }),
      };
    })
    .sort((a, b) => b.signedAt.localeCompare(a.signedAt));
}
