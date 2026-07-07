/**
 * Pure form helpers for BookingDrawer (BACKOFHOUSE-IA C3).
 *
 * Validation, money formatting (pence ↔ £) and the date/time → API window
 * conversion live here so they can be unit-tested without a DOM, and the
 * component stays a thin shell around them.
 */

import { suggestSessionPricePence, type ArtistRates } from "@bnb/core/pricing";

export type BookingType = "consult" | "session" | "flash";
export type BookingStatus =
  | "enquiry"
  | "pending"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "no_show";

/** Whether the drawer books an existing customer or creates one inline. */
export type CustomerMode = "existing" | "new";

/** Editable drawer state (strings as they live in form controls). */
export interface BookingFormState {
  customerId: string;
  customerMode: CustomerMode;
  /** Inline new-customer fields (only validated when mode is "new"). */
  newCustomerName: string;
  /** "YYYY-MM-DD" from <input type="date">; blank = not given. */
  newCustomerDob: string;
  newCustomerEmail: string;
  artistId: string;
  type: BookingType;
  style: string;
  placement: string;
  /** "YYYY-MM-DD" */
  date: string;
  /** "HH:MM" */
  time: string;
  durationMins: number;
  /** Pounds as typed, e.g. "120" or "99.99"; blank = no estimate. */
  priceEstimatePounds: string;
  notes: string;
  status: BookingStatus;
}

/** Duration presets (minutes) surfaced in the drawer. */
export const DURATION_OPTIONS = [30, 60, 90, 120, 180, 240, 360] as const;

/** Integer pence → "£123.45". */
export function formatPence(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}

/**
 * Suggest an editable price-estimate string (pounds, e.g. "180.00") for a
 * selected artist + session duration. Empty string when no rate is available,
 * which the drawer leaves the field blank for. Wraps the shared
 * `suggestSessionPricePence` helper.
 */
export function suggestedPricePounds(
  rates: ArtistRates | null | undefined,
  durationMin: number,
): string {
  if (!rates) return "";
  const pence = suggestSessionPricePence(rates, durationMin);
  return pence != null ? (pence / 100).toFixed(2) : "";
}

/** "£12.50" / "120" → integer pence, or null when blank/invalid. */
export function parsePounds(input: string): number | null {
  const cleaned = input.replace(/[£,\s]/g, "");
  if (cleaned === "") return null;
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}

export type BookingErrors = Partial<Record<keyof BookingFormState, string>>;

/** Deliberately loose: something@something.tld — the server re-validates. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** "YYYY-MM-DD" → true when it parses to a real calendar date. */
function isValidDobString(dob: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return false;
  return !Number.isNaN(new Date(`${dob}T00:00:00.000Z`).getTime());
}

export function validateDraft(state: BookingFormState): BookingErrors {
  const errors: BookingErrors = {};
  if (state.customerMode === "new") {
    if (!state.newCustomerName.trim())
      errors.newCustomerName = "Enter the customer's name.";
    if (!EMAIL_RE.test(state.newCustomerEmail.trim()))
      errors.newCustomerEmail = "Enter a valid email address.";
    const dob = state.newCustomerDob.trim();
    if (dob !== "" && !isValidDobString(dob))
      errors.newCustomerDob = "Enter a valid date of birth.";
  } else if (!state.customerId) {
    errors.customerId = "Choose or add a customer.";
  }
  if (!state.artistId) errors.artistId = "Choose an artist.";
  if (!state.date) errors.date = "Pick a date.";
  if (!state.time) errors.time = "Pick a start time.";
  if (!state.durationMins || state.durationMins <= 0)
    errors.durationMins = "Set a duration.";
  if (state.priceEstimatePounds.trim() !== "") {
    if (parsePounds(state.priceEstimatePounds) === null)
      errors.priceEstimatePounds = "Enter a valid amount, e.g. 120 or 99.99.";
  }
  return errors;
}

/** Inline customer to create alongside the booking (welcome email path). */
export interface NewCustomerPayload {
  name: string;
  email: string;
  /** "YYYY-MM-DD"; omitted when not given. */
  dob?: string;
}

export interface BookingPayload {
  /** Existing customer — mutually exclusive with `newCustomer`. */
  customerId?: string;
  /** Inline new customer — mutually exclusive with `customerId`. */
  newCustomer?: NewCustomerPayload;
  artistId: string;
  type: BookingType;
  style: string | null;
  placement: string | null;
  start: string;
  end: string;
  durationMin: number;
  priceEstimatePence: number | null;
  notes: string | null;
  status: BookingStatus;
}

/** customerId XOR newCustomer, from the drawer's customer mode. */
function customerPart(
  state: BookingFormState,
): Pick<BookingPayload, "customerId" | "newCustomer"> {
  if (state.customerMode !== "new") return { customerId: state.customerId };
  const dob = state.newCustomerDob.trim();
  return {
    newCustomer: {
      name: state.newCustomerName.trim(),
      email: state.newCustomerEmail.trim(),
      ...(dob !== "" ? { dob } : {}),
    },
  };
}

/** Build the /api/bookings request body from validated form state. */
export function draftToPayload(state: BookingFormState): BookingPayload {
  const start = new Date(`${state.date}T${state.time}:00`);
  const end = new Date(start.getTime() + state.durationMins * 60000);
  return {
    ...customerPart(state),
    artistId: state.artistId,
    type: state.type,
    style: state.style.trim() || null,
    placement: state.placement.trim() || null,
    start: start.toISOString(),
    end: end.toISOString(),
    durationMin: state.durationMins,
    priceEstimatePence: parsePounds(state.priceEstimatePounds),
    notes: state.notes.trim() || null,
    status: state.status,
  };
}
