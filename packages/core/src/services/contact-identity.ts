import { parsePhoneNumberFromString } from "libphonenumber-js";

/**
 * Customer identity resolution: one CRM record per human, keyed by a
 * normalised email and/or phone (both unique in the schema) plus per-channel
 * external ids (Messenger PSID / Instagram IGSID) that carry no contact
 * details at all.
 *
 * Normalisation is the whole point of the unique indexes — "Amy@X.com" and
 * "amy@x.com", "07700 900123" and "+447700900123" must collapse to one row.
 */

/** The studio is in the UK; bare national numbers are read as GB. */
export const PHONE_DEFAULT_REGION = "GB";

/**
 * Lowercase + trim. Deliberately does NOT strip dots or plus-addressing:
 * `amy+ink@example.com` is a mailbox the customer chose and may be a different
 * person's alias elsewhere. Returns null for anything that is not shaped like
 * an address so junk never occupies the unique index.
 */
export function normaliseEmail(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim().toLowerCase();
  if (!trimmed) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed)) return null;
  return trimmed;
}

/**
 * Parse to E.164 with a GB default region. Returns null when the number is
 * missing or cannot be parsed as a plausible number — callers keep the raw
 * value out of the unique column rather than storing an un-matchable string.
 *
 * Uses `isPossible()` rather than `isValid()`: the latter checks against
 * real allocated ranges, which excludes Ofcom's 07700 900xxx block reserved
 * for fiction/drama use (a number several enquiry forms and QA fixtures use)
 * even though it is structurally a correct UK mobile number. `isPossible()`
 * still rejects genuine junk like "12345" (too short) or unparseable text.
 */
export function normalisePhone(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  const parsed = parsePhoneNumberFromString(trimmed, PHONE_DEFAULT_REGION);
  return parsed?.isPossible() ? parsed.number : null;
}
