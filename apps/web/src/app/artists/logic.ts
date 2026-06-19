import type { BooksStatus } from "@/components/site";

/** Books-status filter value: any specific status, or "all". */
export type ArtistFilterValue = "all" | BooksStatus;

export const ARTIST_FILTERS: { value: ArtistFilterValue; label: string }[] = [
  { value: "all", label: "Everyone" },
  { value: "open", label: "Books open" },
  { value: "limited", label: "Limited slots" },
  { value: "closed", label: "Waitlist" },
];

/** Filter artists by books status; "all" passes everyone through. */
export function filterArtistsByBooks<T extends { books: BooksStatus }>(
  artists: T[],
  filter: ArtistFilterValue,
): T[] {
  if (filter === "all") return artists;
  return artists.filter((a) => a.books === filter);
}
