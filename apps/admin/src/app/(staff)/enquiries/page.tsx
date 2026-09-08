import { redirect } from "next/navigation";
import { requireRole } from "@bnb/core/auth";
import { prisma } from "@bnb/core/db";
import { statusCountsFor } from "@bnb/core/services/enquiry-messages";
import {
  artistInboxWhere,
  enquiryHref,
  resolveOpenParam,
} from "./enquiry-helpers";
import { buildEnquiryItems, INBOX_SELECT } from "./enquiry-loader";
import { EnquiryInbox, type ArtistOption } from "./EnquiryInbox";

/**
 * Enquiries inbox (BACKOFHOUSE-IA E1). Owners see the whole inbox with an
 * assigned-artist pill on every row; artists see enquiries that prefer them
 * PLUS every unassigned enquiry on any channel, which they can take or claim
 * by responding. Each row links to the enquiry's own page (E2), where the
 * thread, the brief and the triage actions live.
 */
export const dynamic = "force-dynamic";

/** How many enquiries one inbox render pulls. Counts are NOT capped by it. */
const INBOX_PAGE_SIZE = 300;

export default async function EnquiriesPage({
  searchParams = Promise.resolve({}),
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  // `?open=<id>` predates the enquiry page: customer timelines and emails
  // still link this way. The page itself decides whether the viewer may see
  // it, so the redirect never needs the scope.
  const requestedOpenId = resolveOpenParam((await searchParams).open);
  if (requestedOpenId) redirect(enquiryHref(requestedOpenId));

  const user = await requireRole();
  const owner = user.role === "OWNER";
  const viewer = {
    userId: user.id,
    role: user.role,
    artistId: user.artistId ?? null,
  };
  const scope = owner ? {} : artistInboxWhere(user.artistId ?? null);

  const [enquiries, artists, counts] = await Promise.all([
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
    statusCountsFor(viewer),
  ]);

  const truncated = enquiries.length >= INBOX_PAGE_SIZE;
  const items = await buildEnquiryItems(enquiries, viewer, artists);

  const artistOptions: ArtistOption[] = owner
    ? artists
    : artists.filter((a) => a.id === user.artistId);

  return (
    <main className="mx-auto max-w-[1000px] px-5 py-10 sm:px-6">
      <h1 className="display text-[clamp(24px,4vw,38px)] text-text-primary">
        Enquiries
      </h1>
      <p className="mt-2 max-w-[60ch] text-sm text-text-muted">
        Inbound leads — open one to read the thread, reply, leave a note,
        assign an artist, or convert it to a booking.
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
        />
      </div>
    </main>
  );
}
