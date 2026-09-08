import type { Prisma } from "@prisma/client";
import { requireRole } from "@bnb/core/auth";
import { prisma } from "@bnb/core/db";
import {
  listThreadsFor,
  statusCountsFor,
  unreadCountsFor,
} from "@bnb/core/services/enquiry-messages";
import { parseMoodboardData } from "@bnb/core/services/moodboard-data";
import {
  ENQUIRY_EMAIL_CONTEXT_SELECT,
  toEnquiryEmailContext,
} from "@bnb/core/services/channels/email";
import { META_SEND_WINDOW_MS } from "@bnb/core/services/channels/meta";
import { listChannelConnections } from "@bnb/core/services/channel-connections";
import {
  artistInboxWhere,
  defaultComposerChannel,
  openWhere,
  pickOpenState,
  reachabilityFrom,
  replyChannelOptions,
  resolveOpenParam,
  type ReplyReachability,
} from "./enquiry-helpers";
import type { ThreadItem } from "./EnquiryThread";
import {
  EnquiryInbox,
  type ArtistOption,
  type EnquiryItem,
} from "./EnquiryInbox";

/**
 * Enquiries inbox (BACKOFHOUSE-IA E1/E2). Owners see the whole inbox with an
 * assigned-artist pill on every row; artists see enquiries that prefer them
 * PLUS every unassigned enquiry on any channel, which they can take or claim
 * by responding. Each row carries its full message thread and this user's
 * unread flag. Reply / note / assign / convert / claim / close run through
 * colocated server actions.
 */
export const dynamic = "force-dynamic";

/** How many enquiries one inbox render pulls. Counts are NOT capped by it. */
const INBOX_PAGE_SIZE = 300;

/**
 * Everything a row renders, hoisted so the `?open=` extra fetch (below)
 * cannot drift from the list query.
 */
const INBOX_SELECT = {
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

export default async function EnquiriesPage({
  searchParams = Promise.resolve({}),
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole();
  const owner = user.role === "OWNER";
  const viewer = {
    userId: user.id,
    role: user.role,
    artistId: user.artistId ?? null,
  };
  const scope = owner ? {} : artistInboxWhere(user.artistId ?? null);
  const requestedOpenId = resolveOpenParam((await searchParams).open);

  const [enquiries, artists, unread, connections, counts] = await Promise.all([
    prisma.enquiry.findMany({
      where: scope,
      orderBy: [{ lastMessageAt: "desc" }, { createdAt: "desc" }],
      take: INBOX_PAGE_SIZE,
      select: INBOX_SELECT,
    }),
    prisma.artist.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
    unreadCountsFor(viewer),
    listChannelConnections(),
    statusCountsFor(viewer),
  ]);

  // Captured BEFORE the deep-link row below is unshifted onto the list: a
  // 299-row page plus one pinned extra is not a truncated page, and saying it
  // is would print "there are older enquiries" over a complete inbox.
  const truncated = enquiries.length >= INBOX_PAGE_SIZE;

  // The link may point at an enquiry older than this page of rows. One extra
  // read, through the SAME visibility scope — an id the viewer may not see
  // simply does not come back, and pickOpenState turns that into the notice.
  let pinnedExtra = false;
  if (requestedOpenId && !enquiries.some((e) => e.id === requestedOpenId)) {
    const extra = await prisma.enquiry.findFirst({
      where: openWhere(requestedOpenId, scope),
      select: INBOX_SELECT,
    });
    if (extra) {
      enquiries.unshift(extra);
      pinnedExtra = true;
    }
  }

  // A Meta reply needs a live Page behind the last inbound message. Reading
  // every connection once (a handful of rows) answers that for all 300
  // enquiries without a per-row query.
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

  // One query for every thread on screen — no per-enquiry reads.
  const threads = await listThreadsFor(enquiries.map((e) => e.id));
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

  // These options are computed at render. A window that shuts while the dialog
  // sits open is caught twice — the layout's 60s router.refresh() redraws them,
  // and replyToEnquiry re-decides the channel before sending.
  const items: EnquiryItem[] = enquiries.map((e) => {
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

  const artistOptions: ArtistOption[] = owner
    ? artists
    : artists.filter((a) => a.id === user.artistId);

  const open = pickOpenState(items, requestedOpenId);

  return (
    <main className="mx-auto max-w-[1000px] px-6 py-10">
      <p className="kicker mb-2">Back of house</p>
      <h1 className="display text-[clamp(24px,4vw,38px)] text-text-primary">
        Enquiries
      </h1>
      <p className="mt-2 max-w-[60ch] text-sm text-text-muted">
        Inbound leads — read the thread, reply, leave a note, assign an artist,
        or convert to a booking.
      </p>
      <div className="mt-8">
        <EnquiryInbox
          items={items}
          artists={artistOptions}
          counts={counts}
          truncated={truncated}
          pageSize={INBOX_PAGE_SIZE}
          canConvert={owner || Boolean(user.artistId)}
          viewerArtistId={owner ? null : (user.artistId ?? null)}
          showAssignedPill={owner}
          openEnquiryId={open.openId}
          openTab={open.tab}
          notice={open.notice}
          pinnedExtra={pinnedExtra}
        />
      </div>
    </main>
  );
}
