import { prisma } from "@/lib/db";
import { artistStatusLabel } from "@/lib/artist-status";
import { EnquireWizard, type WizardArtist } from "./EnquireWizard";

/**
 * Public Enquire page — the 5-step enquiry wizard (Server Component shell that
 * loads artists + styles from the DB and hands them to the client island).
 *
 * Query seeds (all optional):
 *   ?artist=<id>     pre-selects the artist
 *   ?flash=<id>      flips the wizard into a flash-claim (posts /api/flash)
 *   ?styles=a,b,c    pre-selects up to 3 styles
 */

export const dynamic = "force-dynamic";

interface SearchParams {
  artist?: string;
  flash?: string;
  styles?: string;
}

async function loadData(): Promise<{
  artists: WizardArtist[];
  styleOptions: string[];
}> {
  try {
    const [artists, styles] = await Promise.all([
      prisma.artist.findMany({
        where: { active: true },
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true, status: true, booksStatus: true },
      }),
      prisma.tattooStyle.findMany({ orderBy: { sortOrder: "asc" } }),
    ]);
    return {
      artists: artists.map((a) => ({
        id: a.id,
        name: a.name,
        role: artistStatusLabel(a.status),
        booksStatus: a.booksStatus,
      })),
      styleOptions: styles.map((s) => s.name),
    };
  } catch {
    // Keep the page renderable before the DB/adapter is wired in dev.
    return { artists: [], styleOptions: [] };
  }
}

export default async function EnquirePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const { artists, styleOptions } = await loadData();

  const seedStyles = sp.styles
    ? sp.styles
        .split(",")
        .map((s) => s.trim())
        .filter((s) => styleOptions.includes(s))
        .slice(0, 3)
    : undefined;
  const seedArtistId =
    sp.artist && artists.some((a) => a.id === sp.artist)
      ? sp.artist
      : undefined;

  return (
    <>
      <header className="page-head">
        <div className="wrap">
          <span className="eyebrow">Make an enquiry</span>
          <h1 className="display">Let&rsquo;s make something</h1>
          <p className="lead">
            Free 15-minute consultations, every week. No deposit to enquire — we
            just need a few details to get you booked in.
          </p>
        </div>
      </header>
      <section className="section">
        <div className="wrap">
          <EnquireWizard
            artists={artists}
            styleOptions={styleOptions}
            seedArtistId={seedArtistId}
            seedStyles={seedStyles}
            flashId={sp.flash}
          />
        </div>
      </section>
    </>
  );
}
