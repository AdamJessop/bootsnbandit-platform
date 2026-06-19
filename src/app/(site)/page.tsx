import Link from "next/link";
import { MapPin, Star, ShieldCheck } from "lucide-react";
import {
  Filigree,
  SectionHead,
  StatTile,
  ArtistCard,
  GalleryTile,
  type Artist,
  type GalleryItem,
} from "@/components/site";

/**
 * Heritage home demo. Renders the ported primitives (hero, stat strip, artist
 * cards, gallery masonry) against sample props to prove the design system.
 * Real data + remaining sections land in Phase 7.
 */

const ARTISTS: Artist[] = [
  {
    id: "marnie",
    name: "Marnie",
    role: "Fine-line",
    tag: "Delicate florals & first tattoos",
    books: "open",
    rating: 4.9,
  },
  {
    id: "cal",
    name: "Cal",
    role: "Blackwork",
    tag: "Bold blackwork & sleeves",
    books: "limited",
    rating: 4.8,
  },
  {
    id: "sarah",
    name: "Sarah",
    role: "Colour",
    tag: "Saturated colour realism",
    books: "open",
    rating: 5,
  },
  {
    id: "dex",
    name: "Dex",
    role: "Japanese",
    tag: "Traditional irezumi",
    books: "closed",
    rating: 4.7,
  },
];

const GALLERY: GalleryItem[] = [
  {
    id: "g1",
    title: "Peony half-sleeve",
    style: "Japanese",
    artistName: "Dex",
    big: true,
  },
  {
    id: "g2",
    title: "Fine-line fern",
    style: "Fine-line",
    artistName: "Marnie",
  },
  { id: "g3", title: "Blackwork moth", style: "Blackwork", artistName: "Cal" },
  { id: "g4", title: "Colour koi", style: "Colour", artistName: "Sarah" },
  { id: "g5", title: "Dotwork mandala", style: "Dotwork", artistName: "Cal" },
];

export default function HomePage() {
  return (
    <>
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
      </section>

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
            {ARTISTS.map((a) => (
              <ArtistCard key={a.id} artist={a} />
            ))}
          </div>
        </div>
      </section>

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
            {GALLERY.map((g) => (
              <GalleryTile key={g.id} item={g} />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
