import type { Metadata } from "next";
import Link from "next/link";
import {
  MapPin,
  Star,
  ShieldCheck,
  ChevronDown,
  Compass,
  Image as ImageIcon,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import {
  Filigree,
  Plate,
  SectionHead,
  StatTile,
  ArtistCard,
  GalleryTile,
  StyleShowcase,
  ArtistAvatar,
  Stars,
  type Artist as ArtistProp,
  type GalleryItem as GalleryItemProp,
} from "@/components/site";
import { artistStatusLabel } from "@bnb/core/artist-status";
import { pageMetadata } from "@/lib/seo";
import {
  getArtists,
  getGallery,
  getFlash,
  getPublishedReviews,
  getReviewStats,
  getSiteSettings,
  getStyleShowcase,
} from "./_data";
import { formatPence } from "./_format";
import { formatEndsAt, liveFlash, nextDropEnds } from "./flash/logic";
import { PassportCard } from "./passport/PassportCard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "Boots 'n' Bandit · Heritage Tattoo Studio in Worksop",
  description:
    "Resident artists, custom work from fine-line to blackwork, flash drops and a proper brew while you wait. Heritage tattooing on Newcastle Avenue, Worksop.",
  path: "/",
});

/**
 * Social proof only appears once it is real: the review band, the hero rating
 * and the rating stat all wait for this many published reviews.
 */
const MIN_REVIEWS = 3;

function toArtistProp(
  a: Awaited<ReturnType<typeof getArtists>>[number],
): ArtistProp {
  return {
    id: a.slug,
    name: a.name,
    role: artistStatusLabel(a.status),
    tag: a.tag,
    books: a.books,
    rating: a.rating ?? undefined,
    photo: a.headshot ?? undefined,
  };
}

function toGalleryProp(
  g: Awaited<ReturnType<typeof getGallery>>[number],
): GalleryItemProp {
  return {
    id: g.id,
    title: g.title,
    style: g.style ?? undefined,
    artistName: g.artistName ?? undefined,
    src: g.image ?? undefined,
    big: g.big,
  };
}

export default async function HomePage() {
  const [
    artists,
    gallery,
    flash,
    publishedReviews,
    reviewStats,
    settings,
    styleShowcase,
  ] = await Promise.all([
    getArtists(),
    getGallery(),
    getFlash(),
    getPublishedReviews(MIN_REVIEWS),
    getReviewStats(),
    getSiteSettings(),
    getStyleShowcase(),
  ]);

  const homeArtists = artists.slice(0, 4);
  const homeGallery = gallery.slice(0, 8);
  // Expired drops never reach the home band.
  const live = liveFlash(flash);
  const homeFlash = live.slice(0, 3);
  const flashEnds = nextDropEnds(live);
  const booksOpen = settings?.enquiriesOpen ?? true;
  // Real reviews only — the band stays hidden until enough are published.
  const reviews =
    publishedReviews.length >= MIN_REVIEWS ? publishedReviews : [];
  const rating =
    reviewStats.count >= MIN_REVIEWS && reviewStats.average != null
      ? { average: reviewStats.average.toFixed(1), count: reviewStats.count }
      : null;

  return (
    <div className="page">
      {/* 1. HERO */}
      <section className="hero">
        <div className="hero-bg">
          <div className="hero-veil" />
        </div>
        <div className="hero-in">
          {booksOpen ? (
            <span className="hero-ribbon">
              <span className="dot dot-open pulse" /> Books open · taking
              enquiries
            </span>
          ) : (
            <span className="hero-ribbon">
              <span className="dot dot-closed" /> Books closed for now
            </span>
          )}
          <h1 className="display chrome hero-title">
            Boots &rsquo;n&rsquo; Bandit
          </h1>
          <Filigree />
          <p className="hero-sub">
            Heritage tattooing in Worksop. Resident artists, custom work from
            fine-line to blackwork, and a proper brew while you wait.
          </p>
          <div className="hero-cta">
            <Link href="/enquire" className="btn btn-lg">
              Make an enquiry
            </Link>
            <Link href="/inkling" className="btn btn-lg btn-ghost">
              Find my artist with Inkling
            </Link>
          </div>
          <div className="hero-meta">
            <span>
              <MapPin className="ic" /> 67 Newcastle Avenue, Worksop
            </span>
            {rating && (
              <span>
                <Star className="ic" /> {rating.average} from {rating.count}{" "}
                reviews
              </span>
            )}
            <span>
              <ShieldCheck className="ic" /> Fully licensed studio
            </span>
          </div>
        </div>
        <ChevronDown className="hero-scroll ic" aria-hidden />
      </section>

      {/* 2. STAT STRIP — only figures the database can back up. The artist
          count alone is too thin to earn a band, so it waits for the review
          figures. */}
      {rating && (
        <section className="section">
          <div className="wrap">
            <div className="stat-strip">
              {artists.length > 0 && (
                <StatTile
                  num={String(artists.length)}
                  label={
                    artists.length === 1 ? "Artist" : "Artists in the crew"
                  }
                  tone="crimson"
                />
              )}
              {rating && (
                <>
                  <StatTile
                    num={rating.average}
                    label="Average rating"
                    tone="teal"
                  />
                  <StatTile
                    num={String(rating.count)}
                    label="Published reviews"
                    tone="gold"
                  />
                </>
              )}
            </div>
          </div>
        </section>
      )}

      {/* 3. AI TEASER (Inkling) */}
      <section className="section">
        <div className="wrap">
          <div className="ai-teaser">
            <div className="ai-teaser-copy">
              <span className="eyebrow">Inkling</span>
              <h2 className="display chrome">Not sure where to start?</h2>
              <p className="lead">
                Let Inkling point you in the right direction — match to an
                artist or gather your inspiration in one place.
              </p>
              <div className="ai-teaser-rows">
                <Link href="/inkling?tab=match" className="ai-row">
                  <span className="ai-row-ic">
                    <Compass className="ic" />
                  </span>
                  <span>
                    <b>Style Matcher</b>
                    <small>
                      Answer a few questions, get matched to the right artist.
                    </small>
                  </span>
                  <ChevronRight className="ai-row-go" />
                </Link>
                <Link href="/inkling?tab=mood" className="ai-row">
                  <span className="ai-row-ic gold">
                    <ImageIcon className="ic" />
                  </span>
                  <span>
                    <b>Mood Board</b>
                    <small>
                      Pick styles, describe the piece, and build a board from
                      web inspiration and our work.
                    </small>
                  </span>
                  <ChevronRight className="ai-row-go" />
                </Link>
              </div>
            </div>
            <div className="ai-teaser-art">
              <StyleShowcase styles={styleShowcase} />
              <div className="ai-core">
                <Sparkles className="ic" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. ARTISTS */}
      <section className="section">
        <div className="wrap">
          <SectionHead
            eyebrow="The crew"
            title="Meet the artists"
            action={
              <Link href="/artists" className="btn btn-sm btn-ghost">
                All artists
              </Link>
            }
          />
          <div className="artist-grid">
            {homeArtists.map((a) => (
              <ArtistCard key={a.id} artist={toArtistProp(a)} />
            ))}
          </div>
        </div>
      </section>

      {/* 5. GALLERY */}
      <section className="section" style={{ background: "var(--bg-base)" }}>
        <div className="wrap">
          <SectionHead
            eyebrow="Fresh ink"
            title="Recent work"
            action={
              <Link href="/gallery" className="btn btn-sm btn-ghost">
                Full gallery
              </Link>
            }
          />
          <div className="gallery-masonry">
            {homeGallery.map((g) => (
              <GalleryTile key={g.id} item={toGalleryProp(g)} />
            ))}
          </div>
        </div>
      </section>

      {/* 6. FLASH BAND — hidden when nothing live is on the wall. */}
      {homeFlash.length > 0 && (
        <section className="section">
          <div className="wrap">
            <div className="flash-band">
              <div className="flash-band-head">
                <SectionHead
                  eyebrow={
                    flashEnds
                      ? `Flash drop · live until ${formatEndsAt(flashEnds)}`
                      : "Flash drops"
                  }
                  title="Claim a one-off design"
                />
                <Link href="/flash" className="btn btn-sm btn-outline">
                  See all flash
                </Link>
              </div>
              <div className="flash-row">
                {homeFlash.map((f) => {
                  const left = Math.max(0, f.total - f.claimed);
                  const gone = left <= 0;
                  return (
                    <Link key={f.id} href="/flash" className="flash-mini">
                      <div className="flash-mini-art">
                        <Plate
                          paper
                          src={f.image ?? undefined}
                          alt={f.title}
                          style={{ width: "100%", height: "100%" }}
                        />
                      </div>
                      <div className="flash-mini-body">
                        <b>{f.title}</b>
                        <span className="muted" style={{ fontSize: 12 }}>
                          {[formatPence(f.pricePence), f.size]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                        <span className={`flash-left${gone ? " gone" : ""}`}>
                          {gone ? "Claimed" : `${left} of ${f.total} left`}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 7. PASSPORT BAND */}
      <section className="section" style={{ background: "var(--bg-base)" }}>
        <div className="wrap">
          <div
            className="row gap-8"
            style={{ flexWrap: "wrap", justifyContent: "center" }}
          >
            <figure style={{ margin: 0 }}>
              <PassportCard
                holder="A. Collector"
                level="Level 2 · Outlaw"
                filled={4}
                total={8}
              />
              <figcaption
                className="muted"
                style={{ fontSize: 12, marginTop: 8, textAlign: "center" }}
              >
                Example card — yours fills as you collect stamps.
              </figcaption>
            </figure>
            <div style={{ maxWidth: 440 }}>
              <SectionHead
                eyebrow="Loyalty, reimagined"
                title="The Bandit Pass"
                sub="A stamp for every piece. Priority flash claims, birthday discounts and a free small tattoo when your card's full."
              />
              <Link href="/passport" className="btn btn-gold">
                View your pass
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 8. REVIEWS — real published reviews only, once there are enough. */}
      {reviews.length > 0 && (
        <section className="section" style={{ background: "var(--bg-base)" }}>
          <div className="wrap">
            <SectionHead eyebrow="Kind words" title="What people say" center />
            <div className="review-grid">
              {reviews.map((r) => (
                <figure key={r.id} className="card card-pad review-card">
                  <Stars value={r.rating} showValue={false} />
                  <blockquote>&ldquo;{r.quote}&rdquo;</blockquote>
                  <figcaption className="row gap-3">
                    <ArtistAvatar artist={{ name: r.name }} size="sm" />
                    <span>
                      <b>{r.name}</b>
                      {r.artist && (
                        <span
                          className="muted"
                          style={{ display: "block", fontSize: 12 }}
                        >
                          with {r.artist}
                        </span>
                      )}
                    </span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 9. CTA BAND */}
      <section className="cta-band">
        <div
          className="wrap center"
          style={{ position: "relative", zIndex: 1 }}
        >
          <SectionHead
            eyebrow="Ready when you are"
            title="Let's make something you'll wear forever"
            sub="Free 15-minute consultations, every week."
            center
          />
          <div className="hero-cta" style={{ marginTop: 8 }}>
            <Link href="/enquire" className="btn btn-lg">
              Make an enquiry
            </Link>
            <Link href="/studio" className="btn btn-lg btn-ghost">
              Find the studio
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
