import { describe, it, expect } from "vitest";
import { ARTIST_FILTERS, filterArtistsByBooks } from "./logic";

const ARTISTS = [
  { id: "a", books: "open" as const },
  { id: "b", books: "limited" as const },
  { id: "c", books: "closed" as const },
  { id: "d", books: "open" as const },
];

describe("filterArtistsByBooks", () => {
  it("returns everyone for 'all'", () => {
    expect(filterArtistsByBooks(ARTISTS, "all")).toHaveLength(4);
  });

  it("filters to open books only", () => {
    const r = filterArtistsByBooks(ARTISTS, "open");
    expect(r.map((a) => a.id)).toEqual(["a", "d"]);
  });

  it("filters to limited and closed", () => {
    expect(filterArtistsByBooks(ARTISTS, "limited").map((a) => a.id)).toEqual([
      "b",
    ]);
    expect(filterArtistsByBooks(ARTISTS, "closed").map((a) => a.id)).toEqual([
      "c",
    ]);
  });
});

describe("ARTIST_FILTERS", () => {
  it("exposes the four filter options in order", () => {
    expect(ARTIST_FILTERS.map((f) => f.value)).toEqual([
      "all",
      "open",
      "limited",
      "closed",
    ]);
  });
});
