/**
 * Pure helpers for the enquiry triage server actions (kept out of the
 * "use server" module so they unit-test without server-only imports).
 */
import type {
  BookingType,
  EnquirySource,
  EnquiryStatus,
  MessageChannelKind,
  Prisma,
} from "@prisma/client";
import { formatDateTime } from "../_shared/labels";
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
 * An ARTIST user with no linked artist record sees nothing: the impossible
 * `{ id: "__none__" }` predicate, not "everything unassigned".
 * Must stay in lockstep with `visibleEnquiryWhere` in
 * @bnb/core/services/enquiry-messages, which drives the unread badge, and with
 * `canAccessEnquiry` below; change all three together.
 */
export function artistInboxWhere(
  artistId: string | null,
): Prisma.EnquiryWhereInput {
  if (!artistId) return { id: "__none__" };
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
 * see enquiries that prefer them plus any unassigned one. Must stay in lockstep
 * with `artistInboxWhere` above and `visibleEnquiryWhere` in
 * @bnb/core/services/enquiry-messages.
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

export type ReplyChannel = "email" | "messenger" | "instagram" | "none";

/** How the composer names the channel it is about to use. */
export const REPLY_CHANNEL_LABEL: Record<
  Exclude<ReplyChannel, "none">,
  string
> = {
  email: "email",
  messenger: "Messenger",
  instagram: "Instagram",
};

/**
 * Which channel a staff reply goes out on: the channel of the LAST INBOUND
 * message, per the spec.
 *
 * `metaTargetReady` is the caller's answer to "is there a live Page behind
 * that Meta message?" — an active ChannelConnection with a readable token and
 * a recipient id. When there is not (the Page was disconnected, the token no
 * longer decrypts, or the message predates connections) the reply falls back
 * to email rather than failing: the customer's words matter more than the
 * channel they arrive on.
 */
export function chooseReplyChannel(input: {
  lastInboundChannel: MessageChannelKind | null;
  hasEmail: boolean;
  metaTargetReady: boolean;
}): ReplyChannel {
  const last = input.lastInboundChannel;
  if ((last === "messenger" || last === "instagram") && input.metaTargetReady) {
    return last;
  }
  return input.hasEmail ? "email" : "none";
}

/** Everything the composer can select, including the one that never sends. */
export type ComposerChannel = "email" | "messenger" | "instagram" | "note";

export const COMPOSER_CHANNEL_LABEL: Record<ComposerChannel, string> = {
  email: "Email",
  messenger: "Messenger",
  instagram: "Instagram",
  note: "Internal note",
};

/** The four channels, in the order the selector lists them. */
const COMPOSER_CHANNELS: ComposerChannel[] = [
  "email",
  "messenger",
  "instagram",
  "note",
];

/**
 * What this thread can actually be answered on, as facts rather than verdicts.
 * Built once from `toEnquiryEmailContext` (+ `loadMetaReplyTarget`) so the page
 * and the server action ask the identical question of the identical data.
 */
export interface ReplyReachability {
  /** The address a reply would go to, after the context's own fallbacks. */
  contactEmail: string | null;
  /** The Meta channel of the last inbound message, if it was one. */
  metaChannel: "messenger" | "instagram" | null;
  /** An active Page with a readable token AND a recipient id to send to. */
  metaTargetReady: boolean;
  /** ISO instant the Meta 24-hour window shuts, or null when there is none. */
  metaWindowClosesAtISO: string | null;
}

export interface ReplyChannelOption {
  channel: ComposerChannel;
  label: string;
  available: boolean;
  /**
   * One sentence: what this channel will do, or why it cannot. Doubles as the
   * server's refusal message, so staff read the same words either way.
   */
  hint: string;
}

function metaOption(
  channel: "messenger" | "instagram",
  reach: ReplyReachability,
  nowMs: number,
): ReplyChannelOption {
  const label = COMPOSER_CHANNEL_LABEL[channel];
  const base = { channel, label } as const;
  if (reach.metaChannel !== channel) {
    return {
      ...base,
      available: false,
      hint: `No ${label} conversation on this thread.`,
    };
  }
  if (!reach.metaTargetReady) {
    return {
      ...base,
      available: false,
      hint: "That Page is not connected — reconnect it in Studio › Channels.",
    };
  }
  const closesAt = reach.metaWindowClosesAtISO;
  // No inbound timestamp means no window has ever opened. Meta's rule is
  // "within 24 hours of THEIR message", so the honest answer is "closed" —
  // treating unknown as open would send a policy violation.
  if (!closesAt) {
    return {
      ...base,
      available: false,
      hint: "The 24-hour reply window is closed — reply by email instead.",
    };
  }
  if (Date.parse(closesAt) <= nowMs) {
    return {
      ...base,
      available: false,
      hint: `The 24-hour reply window closed at ${formatDateTime(closesAt)} — reply by email instead.`,
    };
  }
  return {
    ...base,
    available: true,
    hint: `Open until ${formatDateTime(closesAt)}.`,
  };
}

/**
 * Every channel the composer lists, each with whether it can be used and why.
 * Unavailable channels are still listed: "Instagram is greyed out because the
 * 24-hour window shut at 14:05" is information; a missing option is a mystery.
 */
export function replyChannelOptions(
  reach: ReplyReachability,
  nowMs: number = Date.now(),
): ReplyChannelOption[] {
  return COMPOSER_CHANNELS.map((channel) => {
    if (channel === "email") {
      return reach.contactEmail
        ? {
            channel,
            label: COMPOSER_CHANNEL_LABEL.email,
            available: true,
            hint: `Sends to ${reach.contactEmail}.`,
          }
        : {
            channel,
            label: COMPOSER_CHANNEL_LABEL.email,
            available: false,
            hint: "No email address on file for this customer.",
          };
    }
    if (channel === "note") {
      return {
        channel,
        label: COMPOSER_CHANNEL_LABEL.note,
        available: true,
        hint: "Saved on the thread for staff only — never sent.",
      };
    }
    return metaOption(channel, reach, nowMs);
  });
}

/**
 * The channel the composer opens on: `chooseReplyChannel`'s pick (the channel
 * the customer last used), unless that pick is unavailable — a live Page whose
 * 24-hour window has shut would otherwise open a composer that cannot send.
 * The fallback walks the option list, so it lands on email, then the note.
 */
export function defaultComposerChannel(
  reach: ReplyReachability,
  nowMs: number = Date.now(),
): ComposerChannel {
  const options = replyChannelOptions(reach, nowMs);
  const preferred = chooseReplyChannel({
    lastInboundChannel: reach.metaChannel,
    hasEmail: Boolean(reach.contactEmail),
    metaTargetReady: reach.metaTargetReady,
  });
  const pick = preferred === "none" ? "note" : preferred;
  if (options.find((o) => o.channel === pick)?.available) return pick;
  return options.find((o) => o.available)?.channel ?? "note";
}

export type ComposerChannelChoice =
  | { ok: true; channel: ComposerChannel }
  | { ok: false; error: string };

/**
 * Turn whatever the browser sent into a channel we are willing to use.
 * SECURITY: the client's selector is a convenience — this is the decision.
 * A refusal reuses the option's own hint so the sentence staff read under the
 * selector is the sentence they get back.
 */
export function resolveComposerChannel(
  requested: string | null | undefined,
  reach: ReplyReachability,
  nowMs: number = Date.now(),
): ComposerChannelChoice {
  if (!requested) {
    return { ok: true, channel: defaultComposerChannel(reach, nowMs) };
  }
  const option = replyChannelOptions(reach, nowMs).find(
    (o) => o.channel === requested,
  );
  if (!option) return { ok: false, error: "Choose a channel to reply on." };
  if (!option.available) return { ok: false, error: option.hint };
  return { ok: true, channel: option.channel };
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
