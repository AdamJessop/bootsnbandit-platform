import { requireRole } from "@bnb/core/auth";
import { prisma } from "@bnb/core/db";
import {
  EnquiryInbox,
  type ArtistOption,
  type EnquiryItem,
} from "./EnquiryInbox";

/**
 * Enquiries inbox (BACKOFHOUSE-IA E1/E2). Owners see the whole inbox; artists
 * see enquiries that prefer them (mirrors /api/enquiries GET). Reply / assign /
 * convert run through colocated server actions.
 */
export const dynamic = "force-dynamic";

export default async function EnquiriesPage() {
  const user = await requireRole();
  const owner = user.role === "OWNER";
  const artistId = owner ? undefined : (user.artistId ?? "__none__");

  const [enquiries, artists] = await Promise.all([
    prisma.enquiry.findMany({
      where: artistId ? { preferredArtistId: artistId } : {},
      orderBy: { createdAt: "desc" },
      take: 300,
    }),
    prisma.artist.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const items: EnquiryItem[] = enquiries.map((e) => ({
    id: e.id,
    contactName: e.contactName,
    contactEmail: e.contactEmail,
    style: e.style,
    placement: e.placement,
    size: e.size,
    budgetPence: e.budgetPence,
    description: e.description,
    status: e.status,
    source: e.source,
    preferredArtistId: e.preferredArtistId,
    createdAtISO: e.createdAt.toISOString(),
  }));

  const artistOptions: ArtistOption[] = owner
    ? artists
    : artists.filter((a) => a.id === user.artistId);

  return (
    <main className="mx-auto max-w-[1000px] px-6 py-10">
      <p className="kicker mb-2">Back of house</p>
      <h1 className="display text-[clamp(24px,4vw,38px)] text-text-primary">
        Enquiries
      </h1>
      <p className="mt-2 max-w-[60ch] text-sm text-text-muted">
        Inbound leads — reply, assign an artist, or convert to a booking.
      </p>
      <div className="mt-8">
        <EnquiryInbox
          items={items}
          artists={artistOptions}
          canConvert={owner || Boolean(user.artistId)}
        />
      </div>
    </main>
  );
}
