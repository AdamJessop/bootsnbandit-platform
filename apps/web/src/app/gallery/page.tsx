import type { Metadata } from "next";
import { ornDot } from "@/components/site";
import { getGallery, getStyles, getArtists } from "../_data";
import { GalleryBrowser, type BrowserItem } from "./GalleryBrowser";

export const metadata: Metadata = {
  title: "Gallery · Boots 'n' Bandit",
  description:
    "Recent work from the Boots 'n' Bandit crew — fine-line, realism, colour, blackwork and Japanese. Filter by style or artist.",
};

export default async function GalleryPage() {
  const [gallery, styles, artists] = await Promise.all([
    getGallery(),
    getStyles(),
    getArtists(),
  ]);

  const items: BrowserItem[] = gallery.map((g) => ({
    id: g.id,
    title: g.title,
    style: g.style,
    placement: g.placement,
    artistSlug: g.artistSlug,
    artistName: g.artistName,
    image: g.image,
    big: g.big,
  }));

  // Only show artists that actually have pieces in the wall.
  const slugsWithWork = new Set(items.map((i) => i.artistSlug));
  const artistChips = artists
    .filter((a) => slugsWithWork.has(a.slug))
    .map((a) => ({ slug: a.slug, name: a.name }));

  return (
    <div className="page">
      <header className="page-head">
        <div className="wrap-wide">
          <span className="eyebrow">
            {ornDot()}
            The wall
          </span>
          <h1 className="display chrome" style={{ margin: "10px 0 14px" }}>
            Gallery
          </h1>
          <p className="lead" style={{ maxWidth: 640 }}>
            Healed and fresh work straight from the chairs. Every piece is
            custom — use these as inspiration, never a copy.
          </p>
        </div>
      </header>

      <section className="section">
        <div className="wrap-wide">
          <GalleryBrowser items={items} styles={styles} artists={artistChips} />
        </div>
      </section>
    </div>
  );
}
