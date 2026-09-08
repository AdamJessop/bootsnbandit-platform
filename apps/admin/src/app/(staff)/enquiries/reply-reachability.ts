/**
 * What a thread can be answered on, and what the composer is allowed to say
 * about it. Pure: no Prisma, no server-only imports, no `Date.now()` that a
 * test cannot pin — so the page (which renders the selector) and the server
 * action (which re-decides the channel) ask the identical question of the
 * identical data. Re-exported from `enquiry-helpers` so callers and tests can
 * keep importing from one place.
 */
import type { MessageChannelKind } from "@prisma/client";
import { formatDateTime } from "../_shared/labels";

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
 * Built once by `reachabilityFrom` so the page and the server action agree.
 */
export interface ReplyReachability {
  /** The address a reply would go to, after the context's own fallbacks. */
  contactEmail: string | null;
  /**
   * The Meta channel the customer last wrote on, if it was one — derived from
   * the message, NOT from whether we can still reach them. A disconnected Page
   * still has a Messenger conversation on the thread; saying otherwise would
   * blame the customer for the studio's expired token.
   */
  metaChannel: "messenger" | "instagram" | null;
  /** An active Page with a readable token AND a recipient id to send to. */
  metaTargetReady: boolean;
  /** ISO instant the Meta 24-hour window shuts, or null when there is none. */
  metaWindowClosesAtISO: string | null;
}

/**
 * The one derivation of reachability from a loaded enquiry context. Both
 * callers (the page, for the selector; the action, for the decision) pass
 * `META_SEND_WINDOW_MS` — it stays a parameter so this module keeps no import
 * of the Meta service, which reaches for node:crypto and must not be dragged
 * into the client bundle behind the composer.
 *
 * `metaChannel` comes from the last inbound message and `metaTargetReady` from
 * the live connection: two separate facts, because collapsing them makes a
 * disconnected Page indistinguishable from a thread that was never on Meta,
 * and staff get "No Messenger conversation on this thread" for a conversation
 * they are looking at.
 */
export function reachabilityFrom(input: {
  contactEmail: string | null;
  lastInboundChannel: MessageChannelKind | null;
  lastInboundAt: Date | null;
  /** A live Page with a readable token and someone to send to. */
  metaTargetReady: boolean;
  metaWindowMs: number;
}): ReplyReachability {
  const last = input.lastInboundChannel;
  const metaChannel =
    last === "messenger" || last === "instagram" ? last : null;
  return {
    contactEmail: input.contactEmail,
    metaChannel,
    metaTargetReady: metaChannel !== null && input.metaTargetReady,
    metaWindowClosesAtISO: input.lastInboundAt
      ? new Date(
          input.lastInboundAt.getTime() + input.metaWindowMs,
        ).toISOString()
      : null,
  };
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
