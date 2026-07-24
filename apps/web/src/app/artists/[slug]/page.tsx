import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import {
  Plate,
  BooksBadge,
  Stars,
  SectionHead,
  GalleryTile,
  Tag,
  type GalleryItem as GalleryItemProp,
} from "@/components/site";
import { artistStatusLabel } from "@bnb/core/artist-status";
import { getArtist, getArtistGallery } from "../../_data";
import { formatPence } from "../../_format";
import styles from "../artists.module.css";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const artist = await getArtist(slug);
  if (!artist) return { title: "Artist · Boots 'n' Bandit" };
  return {
    title: `${artist.name} · ${artistStatusLabel(artist.status)} · Boots 'n' Bandit`,
    description:
      artist.bio ??
      `${artist.name} — ${artist.tag}. Tattoo artist at Boots 'n' Bandit, Worksop.`,
  };
}

export default async function ArtistDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const artist = await getArtist(slug);
  if (!artist) notFound();

  const gallery = await getArtistGallery(slug);
  const galleryProps: GalleryItemProp[] = gallery.map((g) => ({
    id: g.id,
    title: g.title,
    style: g.style ?? undefined,
    placement: g.placement ?? undefined,
    artistName: g.artistName ?? undefined,
    src: g.image ?? undefined,
    big: g.big,
  }));
  const open = artist.books !== "closed";

  return (
    <div className="page">
      <section className={styles.hero}>
        <div className={styles.heroVeil} aria-hidden />
        <div className="wrap-wide">
          <Link href="/artists" className="breadcrumb">
            <ChevronLeft className="ic" /> All artists
          </Link>
          <div className={styles.heroGrid}>
            <Plate
              seed={`artist-${artist.slug}`}
              src={artist.headshot ?? undefined}
              face
              ratio="3/4"
              className={styles.portrait}
              cap={[artist.name, artistStatusLabel(artist.status)]}
            />
            <div>
              <span className={styles.kicker}>
                {artistStatusLabel(artist.status)}
                {artist.experience ? ` · ${artist.experience} experience` : ""}
              </span>
              <h1 className="display chrome" style={{ margin: "0 0 10px" }}>
                {artist.name}
              </h1>
              {artist.tag && <p className="lead">{artist.tag}</p>}
              <div
                className="row gap-4"
                style={{ marginTop: 14, flexWrap: "wrap" }}
              >
                <BooksBadge status={artist.books} />
                {artist.rating != null && <Stars value={artist.rating} />}
                {artist.pieces != null && (
                  <span className="muted">{artist.pieces} pieces</span>
                )}
              </div>
              {artist.bio && <p className={styles.bio}>{artist.bio}</p>}
              <div
                className="hero-cta"
                style={{ justifyContent: "flex-start", marginTop: 0 }}
              >
                <Link
                  href={
                    open
                      ? `/enquire?artist=${artist.slug}`
                      : `/enquire?artist=${artist.slug}&wait=1`
                  }
                  className="btn"
                >
                  {open ? `Enquire with ${artist.first}` : "Join the waitlist"}
                </Link>
                <Link href="/inkling?tab=match" className="btn btn-ghost">
                  Is this my artist?
                </Link>
              </div>
            </div>
          </div>

          <div className={styles.metaStrip} style={{ marginTop: 36 }}>
            {artist.specials.length > 0 && (
              <div className={styles.metaBlock}>
                <h4>Specialisms</h4>
                <div className={styles.tagRow}>
                  {artist.specials.map((s) => (
                    <Tag key={s} tone="crimson">
                      {s}
                    </Tag>
                  ))}
                </div>
              </div>
            )}
            {artist.styles.length > 0 && (
              <div className={styles.metaBlock}>
                <h4>Styles</h4>
                <div className={styles.tagRow}>
                  {artist.styles.map((s) => (
                    <Tag key={s} tone="gold">
                      {s}
                    </Tag>
                  ))}
                </div>
              </div>
            )}
            {(artist.hourlyRatePence != null ||
              artist.dayRatePence != null) && (
              <div className={styles.metaBlock}>
                <h4>Rates</h4>
                <span className={styles.metaValue}>
                  {[
                    artist.hourlyRatePence != null
                      ? `${formatPence(artist.hourlyRatePence)}/hr`
                      : null,
                    artist.dayRatePence != null
                      ? `Day rate ${formatPence(artist.dayRatePence)}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </div>
            )}
            {artist.insta && (
              <div className={styles.metaBlock}>
                <h4>Find them</h4>
                <span className={styles.metaValue}>
                  <a
                    href={`https://instagram.com/${artist.insta.replace(/^@/, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {artist.insta}
                  </a>
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap-wide">
          <SectionHead eyebrow="Portfolio" title={`Work by ${artist.first}`} />
          {galleryProps.length > 0 ? (
            <div className="gallery-masonry">
              {galleryProps.map((g) => (
                <GalleryTile key={g.id} item={g} />
              ))}
            </div>
          ) : (
            <p className="muted">Portfolio coming soon.</p>
          )}
        </div>
      </section>

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
            <Link
              href={`/enquire?artist=${artist.slug}`}
              className="btn btn-lg"
            >
              Enquire with {artist.first}
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
