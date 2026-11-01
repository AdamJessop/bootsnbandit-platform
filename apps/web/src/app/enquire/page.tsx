import Link from "next/link";
import { prisma } from "@bnb/core/db";
import { artistStatusLabel } from "@bnb/core/artist-status";
import { resolveSeedArtist, type WizardFlash } from "./logic";
import { EnquireWizard, type WizardArtist } from "./EnquireWizard";

/**
 * Public Enquire page — the 5-step enquiry wizard (Server Component shell that
 * loads artists + styles from the DB and hands them to the client island).
 * When the CMS `enquiriesOpen` toggle is off, a "books closed" notice renders
 * instead of the wizard (the API POST is gated too).
 *
 * Query seeds (all optional):
 *   ?artist=<id|slug>  pre-selects the artist (artist-detail/gallery links pass slugs)
 *   ?wait=1            waitlist link for a closed-books artist (note shows in the wizard)
 *   ?flash=<id>        flips the wizard into a flash-claim (posts /api/flash);
 *                      the design's artist is pre-selected + locked
 *   ?styles=a,b,c      pre-selects up to 3 styles
 */

export const dynamic = "force-dynamic";

interface SearchParams {
  artist?: string;
  wait?: string;
  flash?: string;
  styles?: string;
}

async function loadData(flashId?: string): Promise<{
  artists: (WizardArtist & { slug: string })[];
  styleOptions: string[];
  enquiriesOpen: boolean;
  flash: WizardFlash | null;
}> {
  try {
    const [artists, styles, settings, flash] = await Promise.all([
      prisma.artist.findMany({
        where: { active: true },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          slug: true,
          name: true,
          status: true,
          booksStatus: true,
        },
      }),
      prisma.tattooStyle.findMany({ orderBy: { sortOrder: "asc" } }),
      prisma.siteSettings.findFirst({ select: { enquiriesOpen: true } }),
      flashId
        ? prisma.flash.findUnique({
            where: { id: flashId },
            select: {
              id: true,
              title: true,
              artistId: true,
              pricePence: true,
              sizeCm: true,
            },
          })
        : null,
    ]);
    return {
      artists: artists.map((a) => ({
        id: a.id,
        slug: a.slug,
        name: a.name,
        role: artistStatusLabel(a.status),
        booksStatus: a.booksStatus,
      })),
      styleOptions: styles.map((s) => s.name),
      enquiriesOpen: settings?.enquiriesOpen ?? true,
      flash: flash
        ? {
            id: flash.id,
            title: flash.title,
            artistId: flash.artistId,
            pricePence: flash.pricePence,
            size: flash.sizeCm,
          }
        : null,
    };
  } catch {
    // Keep the page renderable before the DB/adapter is wired in dev.
    return { artists: [], styleOptions: [], enquiriesOpen: true, flash: null };
  }
}

export default async function EnquirePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const { artists, styleOptions, enquiriesOpen, flash } = await loadData(
    sp.flash,
  );

  const seedStyles = sp.styles
    ? sp.styles
        .split(",")
        .map((s) => s.trim())
        .filter((s) => styleOptions.includes(s))
        .slice(0, 3)
    : undefined;
  // A flash claim is always with the design's artist; otherwise artist links
  // pass slugs and internal links may pass ids — accept either.
  const seedArtistId = resolveSeedArtist(
    artists,
    flash?.artistId ?? sp.artist,
  )?.id;

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
          {enquiriesOpen ? (
            <EnquireWizard
              artists={artists}
              styleOptions={styleOptions}
              seedArtistId={seedArtistId}
              seedStyles={seedStyles}
              flash={flash ?? undefined}
            />
          ) : (
            <div className="card card-pad" style={{ textAlign: "center" }}>
              <h2 className="display chrome" style={{ margin: "0 0 10px" }}>
                Books are closed
              </h2>
              <p
                className="muted"
                style={{ maxWidth: 480, margin: "0 auto 18px" }}
              >
                We&rsquo;re not taking new enquiries just now while we catch up
                on the diary. Check back soon — or follow us for the next books
                opening and flash drop.
              </p>
              <div
                className="hero-cta"
                style={{ justifyContent: "center", marginTop: 0 }}
              >
                <Link href="/flash" className="btn btn-sm">
                  See the flash wall
                </Link>
                <Link href="/artists" className="btn btn-sm btn-ghost">
                  Meet the artists
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
