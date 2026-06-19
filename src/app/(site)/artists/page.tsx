import type { Metadata } from "next";
import { ornDot } from "@/components/site";
import type { Artist as ArtistProp } from "@/components/site";
import { artistStatusLabel } from "@/lib/artist-status";
import { getArtists } from "../_data";
import { ArtistFilter } from "./ArtistFilter";

export const metadata: Metadata = {
  title: "Our Artists · Boots 'n' Bandit",
  description:
    "Meet the Boots 'n' Bandit crew — seven resident artists across fine-line, realism, colour, blackwork and more. Filter by who's taking books.",
};

export default async function ArtistsPage() {
  const artists = await getArtists();
  const props: ArtistProp[] = artists.map((a) => ({
    id: a.slug,
    name: a.name,
    role: artistStatusLabel(a.status),
    tag: a.tag,
    books: a.books,
    rating: a.rating ?? undefined,
    photo: a.headshot ?? undefined,
  }));

  return (
    <div className="page">
      <header className="page-head">
        <div className="wrap-wide">
          <span className="eyebrow">
            {ornDot()}
            The crew
          </span>
          <h1 className="display chrome" style={{ margin: "10px 0 14px" }}>
            Our artists
          </h1>
          <p className="lead" style={{ maxWidth: 640 }}>
            Seven residents, one chair-side ethos: proper custom work, no daft
            questions, and a brew on the side. Find someone whose style is yours.
          </p>
        </div>
      </header>

      <section className="section">
        <div className="wrap-wide">
          <ArtistFilter artists={props} />
        </div>
      </section>
    </div>
  );
}
