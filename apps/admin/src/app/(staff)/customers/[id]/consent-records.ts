import {
  CONSENT_STUDIO_NAME,
  isFlaggedAnswer,
  readConsentSnapshot,
  type ConsentClientInformation,
  type ConsentStatement,
} from "@bnb/core/consent";

/**
 * Read-only view model for the signed kiosk consent forms on a customer's
 * record (the list on the customer page and the print-friendly paper
 * layout). Pure so the visibility rule and the answer read-back unit-test
 * without a database.
 *
 * Visibility: a consent form is medical information. An owner sees every
 * form; an artist sees only forms for bookings that were theirs — sharing
 * one booking with a customer must not open their forms with other artists.
 *
 * Read-back: each form is shown exactly as it was signed — the stored
 * snapshot wins over today's question set (v1/v2 stored a bare question
 * array, v3 the full paper form; `readConsentSnapshot` reads both).
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
  // v3 (the paper form) — absent on rows signed before the columns existed.
  address?: string | null;
  postcode?: string | null;
  phone?: string | null;
  email?: string | null;
  idProvided?: string | null;
  designPlacement?: string | null;
  artistName?: string | null;
  artistSignature?: string | null;
  artistSignedAt?: Date | null;
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
  /** v3: why the condition matters (italic on the paper form). */
  explanation: string | null;
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
  /** True for forms with the paper form's fields and both signatures (v3+). */
  paperForm: boolean;
  address: string | null;
  postcode: string | null;
  phone: string | null;
  email: string | null;
  idProvided: string | null;
  designPlacement: string | null;
  /** Pre-printed on the paper form. */
  studioName: string;
  /** The artist who signed the form (snapshot), falling back to the booking's. */
  signingArtist: string | null;
  artistSignature: string | null;
  artistSignedAt: string | null;
  furtherDetailsPrompt: string;
  clientInformation: ConsentClientInformation | null;
  statements: ConsentStatement[];
  agreeLabel: string;
  /** null = the form had no agreement step (v1/v2). */
  agreed: boolean | null;
}

function toRecord(b: ConsentBookingRow, form: ConsentFormRow): ConsentRecord {
  const answers =
    form.answers && typeof form.answers === "object"
      ? (form.answers as Record<string, unknown>)
      : {};
  const snap = readConsentSnapshot(form.questions, form.formVersion);
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
    answers: snap.questions.map((q) => {
      const a = answers[q.id];
      const value = typeof a === "boolean" ? a : undefined;
      return {
        id: q.id,
        q: q.q,
        explanation: q.explanation ?? null,
        answer: value === undefined ? "—" : value ? "Yes" : "No",
        flagged: isFlaggedAnswer(q, value),
      };
    }),
    paperForm: snap.statements.length > 0,
    address: form.address ?? null,
    postcode: form.postcode ?? null,
    phone: form.phone ?? null,
    email: form.email ?? null,
    idProvided: form.idProvided ?? null,
    designPlacement: form.designPlacement ?? null,
    studioName: CONSENT_STUDIO_NAME,
    signingArtist: form.artistName ?? null,
    artistSignature: form.artistSignature ?? null,
    artistSignedAt: form.artistSignedAt?.toISOString() ?? null,
    furtherDetailsPrompt: snap.furtherDetailsPrompt,
    clientInformation: snap.clientInformation,
    statements: snap.statements,
    agreeLabel: snap.agreeLabel,
    agreed: snap.agreed,
  };
}

/** May this viewer read the consent form on this booking? */
export function canViewConsent(
  booking: Pick<ConsentBookingRow, "artistId">,
  viewer: ConsentViewer,
): boolean {
  return viewer.role === "OWNER" || booking.artistId === viewer.artistId;
}

export function buildConsentRecords(
  bookings: ConsentBookingRow[],
  viewer: ConsentViewer,
): ConsentRecord[] {
  return bookings
    .filter(
      (b): b is ConsentBookingRow & { consentForm: ConsentFormRow } =>
        b.consentForm != null && canViewConsent(b, viewer),
    )
    .map((b) => toRecord(b, b.consentForm))
    .sort((a, b) => b.signedAt.localeCompare(a.signedAt));
}
