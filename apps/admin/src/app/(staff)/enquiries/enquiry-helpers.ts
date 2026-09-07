/**
 * Pure helpers for the enquiry triage server actions (kept out of the
 * "use server" module so they unit-test without server-only imports).
 */
import type {
  BookingType,
  EnquirySource,
  EnquiryStatus,
  Prisma,
} from "@prisma/client";
import type { CreateBookingInput } from "@bnb/core/services/bookings";

/** Tally enquiries per status (pure; used by the inbox tabs). */
export function countByStatus(
  items: { status: EnquiryStatus }[],
): Record<EnquiryStatus, number> {
  const counts: Record<EnquiryStatus, number> = {
    new: 0,
    replied: 0,
    converted: 0,
    closed: 0,
  };
  for (const i of items) counts[i.status] += 1;
  return counts;
}

/** True when a moodboard URL looks like a renderable image (by extension). */
export function looksLikeImageUrl(url: string): boolean {
  let pathname = url;
  try {
    pathname = new URL(url).pathname;
  } catch {
    // Relative / malformed URL — test the raw string.
  }
  return /\.(png|jpe?g|gif|webp|avif|svg)$/i.test(pathname);
}

/** One MessageLog row, serialised for the inbox (input to buildThreadMap). */
export interface ThreadMessage {
  id: string;
  customerId: string | null;
  type: string;
  status: string;
  subject: string | null;
  sentAtISO: string | null;
  createdAtISO: string;
}

/** A past message shown in the enquiry detail thread. */
export interface ThreadEntry {
  id: string;
  type: string;
  status: string;
  subject: string | null;
  whenISO: string;
}

/**
 * Group MessageLog rows by customer for the enquiry detail thread. Rows are
 * expected newest-first; each customer's thread is capped at `cap` entries.
 * Rows without a customer are skipped (nothing to attach them to).
 */
export function buildThreadMap(
  messages: ThreadMessage[],
  cap = 20,
): Map<string, ThreadEntry[]> {
  const map = new Map<string, ThreadEntry[]>();
  for (const m of messages) {
    if (!m.customerId) continue;
    const list = map.get(m.customerId) ?? [];
    if (list.length >= cap) continue;
    list.push({
      id: m.id,
      type: m.type,
      status: m.status,
      subject: m.subject,
      whenISO: m.sentAtISO ?? m.createdAtISO,
    });
    map.set(m.customerId, list);
  }
  return map;
}

export interface InboxFilter {
  /** Preferred-artist id to match, or null for all. */
  artistId: string | null;
  /** Style to match (case-insensitive), or null for all. */
  style: string | null;
  /** Enquiry source to match, or null for all. */
  source: EnquirySource | null;
}

/** Apply the artist + style + source dropdown filters to the inbox list. Pure. */
export function filterEnquiries<
  T extends {
    preferredArtistId: string | null;
    style: string | null;
    source?: EnquirySource | null;
  },
>(items: T[], filter: InboxFilter): T[] {
  const style = filter.style?.trim().toLowerCase() ?? null;
  return items.filter((i) => {
    if (filter.artistId && i.preferredArtistId !== filter.artistId) {
      return false;
    }
    if (style && (i.style ?? "").trim().toLowerCase() !== style) return false;
    if (filter.source && i.source !== filter.source) return false;
    return true;
  });
}

/** Artists see enquiries that prefer them PLUS unassigned Inkling mood boards. */
export function artistInboxWhere(artistId: string): Prisma.EnquiryWhereInput {
  return {
    OR: [
      { preferredArtistId: artistId },
      { source: "inkling", preferredArtistId: null },
    ],
  };
}

/** True for an Inkling mood board that has not been claimed by an artist. */
export function isOpenBoard(e: {
  source: EnquirySource;
  preferredArtistId: string | null;
}): boolean {
  return e.source === "inkling" && e.preferredArtistId === null;
}

/**
 * Can this staff user see/act on this enquiry? Owners see everything;
 * artists see enquiries that prefer them plus any open (unclaimed) board.
 */
export function canAccessEnquiry(
  user: { role: "OWNER" | "ARTIST"; artistId?: string | null },
  e: { source: EnquirySource; preferredArtistId: string | null },
): boolean {
  if (user.role === "OWNER") return true;
  if (!user.artistId) return false;
  return e.preferredArtistId === user.artistId || isOpenBoard(e);
}

/** Distinct non-empty styles across the inbox (case-insensitive, sorted). */
export function distinctStyles(items: { style: string | null }[]): string[] {
  const seen = new Map<string, string>();
  for (const i of items) {
    const style = i.style?.trim();
    if (!style) continue;
    const key = style.toLowerCase();
    if (!seen.has(key)) seen.set(key, style);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

export type ReplyResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

export function validateReply(input: { message: string }): ReplyResult {
  const message = input.message.trim();
  if (!message) return { ok: false, error: "A reply message is required." };
  return { ok: true, message };
}

export interface ConvertFormInput {
  customerId: string;
  artistId: string;
  startISO: string;
  durationMin: number;
  type: BookingType;
  style?: string | null;
  placement?: string | null;
  enquiryId?: string;
}

export type ConvertResult =
  | { ok: true; input: CreateBookingInput }
  | { ok: false; error: string };

/** Validate the convert form and build a CreateBookingInput (pending). */
export function buildConvertInput(form: ConvertFormInput): ConvertResult {
  if (!form.customerId) return { ok: false, error: "Missing customer." };
  if (!form.artistId) return { ok: false, error: "Choose an artist." };

  const start = new Date(form.startISO);
  if (Number.isNaN(start.getTime())) {
    return { ok: false, error: "Choose a valid date and time." };
  }
  if (!Number.isInteger(form.durationMin) || form.durationMin <= 0) {
    return {
      ok: false,
      error: "Duration must be a positive number of minutes.",
    };
  }

  const end = new Date(start.getTime() + form.durationMin * 60_000);

  return {
    ok: true,
    input: {
      customerId: form.customerId,
      artistId: form.artistId,
      enquiryId: form.enquiryId ?? null,
      type: form.type,
      style: form.style ?? null,
      placement: form.placement ?? null,
      start,
      end,
      durationMin: form.durationMin,
      status: "pending",
    },
  };
}
