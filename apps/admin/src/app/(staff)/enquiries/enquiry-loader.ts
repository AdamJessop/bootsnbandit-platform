import type { Prisma } from "@prisma/client";
import {
  listThreadsFor,
  unreadCountsFor,
  type InboxViewer,
} from "@bnb/core/services/enquiry-messages";
import { parseMoodboardData } from "@bnb/core/services/moodboard-data";
import {
  ENQUIRY_EMAIL_CONTEXT_SELECT,
  toEnquiryEmailContext,
} from "@bnb/core/services/channels/email";
import { META_SEND_WINDOW_MS } from "@bnb/core/services/channels/meta";
import { listChannelConnections } from "@bnb/core/services/channel-connections";
import {
  defaultComposerChannel,
  reachabilityFrom,
  replyChannelOptions,
  type ReplyReachability,
} from "./enquiry-helpers";
import type { ThreadItem } from "./EnquiryThread";
import type { ArtistOption, EnquiryItem } from "./inbox-shared";

/**
 * One loader for both enquiry screens. The inbox list and the thread page
 * render the same `EnquiryItem`, so the select, the reachability maths and
 * the thread mapping live here — a row opened from a deep link can never
 * drift from the row the list would have drawn.
 */
export const INBOX_SELECT = {
  // The reply context (contact email fallbacks, last inbound channel,
  // connection and timestamp) plus everything a row renders.
  ...ENQUIRY_EMAIL_CONTEXT_SELECT,
  style: true,
  placement: true,
  size: true,
  budgetPence: true,
  description: true,
  moodboard: true,
  moodboardData: true,
  status: true,
  source: true,
  channel: true,
  preferredArtistId: true,
  createdAt: true,
  lastMessageAt: true,
} satisfies Prisma.EnquirySelect;

export type EnquiryRow = Prisma.EnquiryGetPayload<{
  select: typeof INBOX_SELECT;
}>;

/**
 * Turn database rows into what the islands render: reachability per reply
 * channel, the viewer's unread flag, and the full thread. One query for every
 * thread on screen and one read of the channel connections — never a
 * per-enquiry round trip.
 */
export async function buildEnquiryItems(
  rows: EnquiryRow[],
  viewer: InboxViewer,
  artists: ArtistOption[],
): Promise<EnquiryItem[]> {
  const [unread, connections, threads] = await Promise.all([
    unreadCountsFor(viewer),
    listChannelConnections(),
    listThreadsFor(rows.map((e) => e.id)),
  ]);

  // A Meta reply needs a live Page behind the last inbound message. Reading
  // every connection once (a handful of rows) answers that for every row
  // without a per-row query.
  const connectionById = new Map(connections.map((c) => [c.id, c]));
  const now = Date.now();

  function reachabilityFor(
    context: ReturnType<typeof toEnquiryEmailContext>,
  ): ReplyReachability {
    const connection = context.lastInboundConnectionId
      ? (connectionById.get(context.lastInboundConnectionId) ?? null)
      : null;
    return reachabilityFrom({
      contactEmail: context.contactEmail,
      lastInboundChannel: context.lastInboundChannel,
      lastInboundAt: context.lastInboundAt,
      // Mirrors loadMetaReplyTarget: a live connection AND someone to send to.
      metaTargetReady: Boolean(
        connection?.active &&
        connection.tokenReadable &&
        context.lastInboundFromAddress,
      ),
      metaWindowMs: META_SEND_WINDOW_MS,
    });
  }

  const unreadIds = new Set(unread.enquiryIds);
  const artistName = new Map(artists.map((a) => [a.id, a.name]));

  const toThreadItems = (enquiryId: string): ThreadItem[] =>
    (threads.get(enquiryId) ?? []).map((m) => ({
      id: m.id,
      direction: m.direction,
      channel: m.channel,
      authorName: m.authorName,
      fromName: m.fromName,
      subject: m.subject,
      bodyText: m.bodyText,
      deliveryStatus: m.deliveryStatus,
      senderVerified: m.senderVerified,
      createdAtISO: m.createdAt.toISOString(),
      attachments: m.attachments.map((a) => ({
        id: a.id,
        mime: a.mime,
        size: a.size,
        filename: a.filename,
        url: a.url,
        hasBytes: a.hasBytes,
      })),
    }));

  // Reply options are computed at render. A window that shuts while the page
  // sits open is caught twice — the shell's 60s router.refresh() redraws them,
  // and replyToEnquiry re-decides the channel before sending.
  return rows.map((e) => {
    const reach = reachabilityFor(toEnquiryEmailContext(e));
    return {
      id: e.id,
      customerId: e.customerId,
      contactName: e.contactName,
      contactEmail: e.contactEmail,
      subject: e.subject,
      style: e.style,
      placement: e.placement,
      size: e.size,
      budgetPence: e.budgetPence,
      description: e.description,
      moodboard: e.moodboard,
      moodboardData: parseMoodboardData(e.moodboardData),
      status: e.status,
      source: e.source,
      channel: e.channel,
      preferredArtistId: e.preferredArtistId,
      preferredArtistName: e.preferredArtistId
        ? (artistName.get(e.preferredArtistId) ?? null)
        : null,
      createdAtISO: e.createdAt.toISOString(),
      lastMessageAtISO: e.lastMessageAt?.toISOString() ?? null,
      unread: unreadIds.has(e.id),
      thread: toThreadItems(e.id),
      replyOptions: replyChannelOptions(reach, now),
      defaultReplyChannel: defaultComposerChannel(reach, now),
    };
  });
}
