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
  ArtistAvatar,
  Stars,
  type Artist as ArtistProp,
  type GalleryItem as GalleryItemProp,
} from "@/components/site";
import { artistStatusLabel } from "@bnb/core/artist-status";
import {
  getArtists,
  getGallery,
  getFlash,
  getPublishedReviews,
  type SiteReview,
} from "./_data";
import { formatPence } from "./_format";
import { PassportCard } from "./passport/PassportCard";

export const metadata: Metadata = {
  title: "Boots 'n' Bandit · Heritage Tattoo Studio in Worksop",
  description:
    "Seven resident artists, custom work from fine-line to blackwork, and a proper brew while you wait. Heritage tattooing in Worksop. Books open for Summer 2026.",
};

function toArtistProp(a: Awaited<ReturnType<typeof getArtists>>[number]): ArtistProp {
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

/** Sample quotes shown until enough real reviews are published via the CMS. */
const SAMPLE_REVIEWS: SiteReview[] = [
  {
    id: "sample-1",
    name: "Hannah M.",
    artist: "Amy",
    rating: 5,
    quote:
      "My first tattoo and I was terrified — Amy completely put me at ease and the fine-line piece is more delicate than I dared hope.",
  },
  {
    id: "sample-2",
    name: "Dec R.",
    artist: "Calum",
    rating: 5,
    quote:
      "Calum mapped a full blackwork half-sleeve over two sessions. Calm, surgical, and it healed perfectly. Already planning the next one.",
  },
  {
    id: "sample-3",
    name: "Priya K.",
    artist: "Sarah",
    rating: 5,
    quote:
      "The colour is so saturated people think it's a sticker. Sarah listened to every note and made it ours. Worth every penny.",
  },
];

export default async function HomePage() {
  const [artists, gallery, flash, publishedReviews] = await Promise.all([
    getArtists(),
    getGallery(),
    getFlash(),
    getPublishedReviews(3),
  ]);

  const homeArtists = artists.slice(0, 4);
  const homeGallery = gallery.slice(0, 8);
  const homeFlash = flash.slice(0, 3);
  // Real published reviews once there are enough to fill the band.
  const reviews =
    publishedReviews.length >= 3 ? publishedReviews : SAMPLE_REVIEWS;

  return (
    <div className="page">
      {/* 1. HERO */}
      <section className="hero">
        <div className="hero-bg">
          <div className="hero-veil" />
        </div>
        <div className="hero-in">
          <span className="hero-ribbon">
            <span className="dot dot-open pulse" /> Books open · now taking
            Summer 2026
          </span>
          <h1 className="display chrome hero-title">
            Boots &rsquo;n&rsquo; Bandit
          </h1>
          <Filigree />
          <p className="hero-sub">
            Heritage tattooing in Worksop. Seven resident artists, custom work
            from fine-line to blackwork, and a proper brew while you wait.
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
            <span>
              <Star className="ic" /> 4.9 from 380+ reviews
            </span>
            <span>
              <ShieldCheck className="ic" /> Fully licensed studio
            </span>
          </div>
        </div>
        <ChevronDown className="hero-scroll ic" aria-hidden />
      </section>

      {/* 2. STAT STRIP */}
      <section className="section">
        <div className="wrap">
          <div className="stat-strip">
            <StatTile num="7" label="Resident artists" tone="crimson" />
            <StatTile num="10+" label="Years in Worksop" tone="gold" />
            <StatTile num="4.9" label="Average rating" tone="teal" />
            <StatTile num="12k+" label="Pieces & counting" />
          </div>
        </div>
      </section>

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
                      Gather inspiration from the web and our work into one
                      board.
                    </small>
                  </span>
                  <ChevronRight className="ai-row-go" />
                </Link>
              </div>
            </div>
            <div className="ai-teaser-art">
              <div
                style={{ aspectRatio: "1/1", borderRadius: "var(--radius)" }}
                className="plate"
              >
                <div
                  className="plate-art"
                  aria-hidden
                  style={{
                    background:
                      "radial-gradient(120% 120% at 30% 20%, rgba(201,47,77,.22), transparent 60%)",
                  }}
                />
              </div>
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

      {/* 6. FLASH BAND */}
      <section className="section">
        <div className="wrap">
          <div className="flash-band">
            <div className="flash-band-head">
              <SectionHead
                eyebrow="Flash drop · this weekend"
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
                        style={{ width: "100%", height: "100%" }}
                      />
                    </div>
                    <div className="flash-mini-body">
                      <b>{f.title}</b>
                      <span className="muted" style={{ fontSize: 12 }}>
                        {formatPence(f.pricePence)} · {f.size}
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

      {/* 7. PASSPORT BAND */}
      <section className="section" style={{ background: "var(--bg-base)" }}>
        <div className="wrap">
          <div
            className="row gap-8"
            style={{ flexWrap: "wrap", justifyContent: "center" }}
          >
            <PassportCard
              holder="A. Collector"
              level="Level 2 · Outlaw"
              filled={4}
              total={8}
            />
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

      {/* 8. REVIEWS */}
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

      {/* 9. CTA BAND */}
      <section className="cta-band">
        <div className="wrap center" style={{ position: "relative", zIndex: 1 }}>
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
