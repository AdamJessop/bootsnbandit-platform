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
    customer_replied: 0,
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

/**
 * Artists see enquiries that prefer them PLUS every unassigned enquiry on any
 * channel — an emailed lead must not sit invisible because nobody claimed it.
 * Mirrors `visibleEnquiryWhere` in @bnb/core/services/enquiry-messages, which
 * drives the unread badge; change both together.
 */
export function artistInboxWhere(artistId: string): Prisma.EnquiryWhereInput {
  return {
    OR: [{ preferredArtistId: artistId }, { preferredArtistId: null }],
  };
}

/** No artist has taken this enquiry yet — any artist may claim it. */
export function isUnassigned(e: { preferredArtistId: string | null }): boolean {
  return e.preferredArtistId === null;
}

/**
 * Can this staff user see/act on this enquiry? Owners see everything; artists
 * see enquiries that prefer them plus any unassigned one.
 */
export function canAccessEnquiry(
  user: { role: "OWNER" | "ARTIST"; artistId?: string | null },
  e: { preferredArtistId: string | null },
): boolean {
  if (user.role === "OWNER") return true;
  if (!user.artistId) return false;
  return e.preferredArtistId === user.artistId || isUnassigned(e);
}

/**
 * Closing is narrower than access: an artist may only close an enquiry that is
 * assigned to them. Seeing an unassigned enquiry must not let one artist bin a
 * lead another was about to take.
 */
export function canCloseEnquiry(
  user: { role: "OWNER" | "ARTIST"; artistId?: string | null },
  e: { preferredArtistId: string | null },
): boolean {
  if (user.role === "OWNER") return true;
  return Boolean(user.artistId) && e.preferredArtistId === user.artistId;
}

/**
 * Where the inbox links an attachment: inline bytes are served by the
 * staff-gated admin route, link-only rows go straight to their source, and a
 * row with neither is unreachable.
 */
export function attachmentHref(a: {
  id: string;
  url: string | null;
  hasBytes: boolean;
}): string | null {
  if (a.hasBytes) return `/api/attachments/${a.id}`;
  return a.url;
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
