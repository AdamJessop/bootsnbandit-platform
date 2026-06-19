import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  ArtistEditor,
  type ArtistRow,
  type StyleOption,
} from "./_components/ArtistEditor";
import { createArtist, deleteArtist, updateArtist } from "./_lib/artist-action";

/** Artists CMS (J3) — unified artist+staff profiles. Owner-only. */
export const dynamic = "force-dynamic";

export default async function ArtistsContentPage() {
  await requireRole("OWNER");
  const [artists, styles] = await Promise.all([
    prisma.artist.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        user: { select: { email: true, role: true } },
        styles: { select: { id: true } },
      },
    }),
    prisma.tattooStyle.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
  ]);

  const rows: ArtistRow[] = artists.map((a) => ({
    id: a.id,
    slug: a.slug,
    name: a.name,
    status: a.status,
    email: a.user?.email ?? "",
    accessRole: a.user?.role ?? "ARTIST",
    tag: a.tag,
    bio: a.bio,
    specials: a.specials,
    hourlyRatePence: a.hourlyRatePence,
    dayRatePence: a.dayRatePence,
    insta: a.insta,
    headshot: a.headshot,
    hue: a.hue,
    booksStatus: a.booksStatus,
    sortOrder: a.sortOrder,
    active: a.active,
    styleIds: a.styles.map((s) => s.id),
  }));

  const styleOptions: StyleOption[] = styles;

  return (
    <main className="mx-auto max-w-[1100px] px-7 py-10">
      <p className="kicker mb-2">Content</p>
      <h1 className="display text-[clamp(24px,4vw,36px)] text-text-primary">
        Artists
      </h1>
      <p className="mt-2 mb-6 text-text-muted">
        Manage artist profiles. Adding an artist also creates their linked staff
        account.
      </p>
      <ArtistEditor
        rows={rows}
        styles={styleOptions}
        createAction={createArtist}
        updateAction={updateArtist}
        deleteAction={deleteArtist}
      />
    </main>
  );
}
