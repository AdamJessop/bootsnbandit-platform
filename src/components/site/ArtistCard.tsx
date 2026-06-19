import Link from "next/link";
import { Plate } from "./Plate";
import { BooksBadge } from "./BooksBadge";
import { Stars } from "./Stars";
import type { Artist } from "./types";

/**
 * Artist preview card: seeded headshot plate + name, role/tag, books badge
 * and rating. Whole card links to the artist detail route.
 */
export function ArtistCard({ artist }: { artist: Artist }) {
  return (
    <Link
      href={`/artists/${artist.id}`}
      className="card artist-card fade-up"
      aria-label={artist.name}
    >
      <Plate
        seed={`artist-${artist.id}`}
        src={artist.photo}
        face
        ratio="4/5"
        className="artist-photo"
        cap={[artist.name, artist.role]}
      />
      <div className="artist-body">
        <span className="artist-name">{artist.name}</span>
        {artist.tag && <p className="artist-tag">{artist.tag}</p>}
        <div className="row gap-4" style={{ marginTop: "auto" }}>
          <BooksBadge status={artist.books} />
          {artist.rating != null && (
            <Stars value={artist.rating} showValue={false} />
          )}
        </div>
      </div>
    </Link>
  );
}
