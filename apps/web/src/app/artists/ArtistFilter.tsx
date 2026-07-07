"use client";

import { useState } from "react";
import { ArtistCard, Chip, type Artist as ArtistProp } from "@/components/site";
import {
  ARTIST_FILTERS,
  filterArtistsByBooks,
  type ArtistFilterValue,
} from "./logic";

/**
 * Client island: books-status filter chips over the artist grid. Pure
 * presentational filtering of a server-provided list (no fetch). Filter logic
 * lives in `./logic` (unit-tested).
 */
export function ArtistFilter({ artists }: { artists: ArtistProp[] }) {
  const [filter, setFilter] = useState<ArtistFilterValue>("all");
  const shown = filterArtistsByBooks(artists, filter);

  return (
    <>
      <div className="row gap-3" style={{ flexWrap: "wrap", marginBottom: 28 }}>
        {ARTIST_FILTERS.map((f) => (
          <Chip
            key={f.value}
            on={filter === f.value}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </Chip>
        ))}
      </div>
      <div className="artist-grid wide">
        {shown.map((a) => (
          <ArtistCard key={a.id} artist={a} />
        ))}
      </div>
    </>
  );
}
