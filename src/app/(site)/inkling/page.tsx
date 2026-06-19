import { prisma } from "@bnb/core/db";
import { artistStatusLabel } from "@bnb/core/artist-status";
import { InklingTabs, type InklingArtist } from "./InklingTabs";

/**
 * Inkling — two tabs: the deterministic Style Matcher (quiz → /api/match) and
 * the Mood Board capture (curate references → /api/enquiries source=inkling).
 * No AI, no image generation. `?tab=match|mood` selects the initial tab.
 */

export const dynamic = "force-dynamic";

async function loadArtists(): Promise<InklingArtist[]> {
  try {
    const rows = await prisma.artist.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        status: true,
        slug: true,
        booksStatus: true,
      },
    });
    return rows.map((a) => ({
      id: a.id,
      name: a.name,
      role: artistStatusLabel(a.status),
      slug: a.slug,
      booksStatus: a.booksStatus,
    }));
  } catch {
    return [];
  }
}

export default async function InklingPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const sp = await searchParams;
  const artists = await loadArtists();
  const initialTab = sp.tab === "mood" ? "mood" : "match";

  return (
    <>
      <header className="page-head">
        <div className="wrap">
          <span className="eyebrow">Inkling</span>
          <h1 className="display">Find your artist</h1>
          <p className="lead">
            Not sure where to start? Answer a few questions to get matched, or
            gather inspiration into a mood board and send it to the studio.
          </p>
        </div>
      </header>
      <section className="section">
        <div className="wrap">
          <InklingTabs initialTab={initialTab} artists={artists} />
        </div>
      </section>
    </>
  );
}
