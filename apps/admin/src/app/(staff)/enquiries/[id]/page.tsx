import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@bnb/core/auth";
import { prisma } from "@bnb/core/db";
import { artistInboxWhere, openWhere } from "../enquiry-helpers";
import { buildEnquiryItems, INBOX_SELECT } from "../enquiry-loader";
import type { ArtistOption } from "../inbox-shared";
import { EnquiryPage } from "./EnquiryPage";

/**
 * One enquiry as its own page (BACKOFHOUSE-IA E2). The inbox row links here;
 * `?open=<id>` deep links redirect here. Everything the old dialog stacked in
 * one scroll is now three views — Conversation, Brief, Actions — with the
 * reply composer docked in reach. Visibility is the same scope the inbox
 * uses: an id the viewer may not see renders the quiet notice, never the
 * thread.
 */
export const dynamic = "force-dynamic";

export default async function EnquiryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireRole();
  const owner = user.role === "OWNER";
  const viewer = {
    userId: user.id,
    role: user.role,
    artistId: user.artistId ?? null,
  };
  const scope = owner ? {} : artistInboxWhere(user.artistId ?? null);

  const [row, artists] = await Promise.all([
    prisma.enquiry.findFirst({
      where: openWhere(id, scope),
      select: INBOX_SELECT,
    }),
    prisma.artist.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  if (!row) {
    return (
      <main className="mx-auto max-w-[760px] px-5 py-10">
        <Link
          href="/enquiries"
          className="inline-flex min-h-11 items-center gap-1.5 text-sm text-text-muted hover:text-text-primary"
        >
          <ArrowLeft className="size-4" aria-hidden /> Enquiries
        </Link>
        <h1 className="display mt-3 text-[clamp(24px,4vw,34px)] text-text-primary">
          That enquiry isn&rsquo;t here
        </h1>
        <p className="mt-3 max-w-[52ch] text-sm text-text-muted">
          It may belong to another artist, or the link is out of date. Open
          the customer&rsquo;s record to find their older enquiries.
        </p>
      </main>
    );
  }

  const [item] = await buildEnquiryItems([row], viewer, artists);
  const artistOptions: ArtistOption[] = owner
    ? artists
    : artists.filter((a) => a.id === user.artistId);

  return (
    <EnquiryPage
      item={item}
      artists={artistOptions}
      canConvert={owner || Boolean(user.artistId)}
      viewerArtistId={owner ? null : (user.artistId ?? null)}
    />
  );
}
