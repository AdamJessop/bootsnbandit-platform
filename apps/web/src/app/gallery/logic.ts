/**
 * Pure gallery filter + lightbox-navigation helpers (unit-tested), shared by
 * the gallery client island.
 */

export interface FilterableItem {
  style?: string | null;
  artistSlug?: string | null;
}

/** Filter by style and/or artist slug; "all" passes everything for that axis. */
export function filterGallery<T extends FilterableItem>(
  items: T[],
  style: string,
  artist: string,
): T[] {
  return items.filter(
    (i) =>
      (style === "all" || i.style === style) &&
      (artist === "all" || i.artistSlug === artist),
  );
}

/** Move an index by `delta`, wrapping within `length`. Returns 0 if empty. */
export function stepIndex(
  index: number,
  delta: number,
  length: number,
): number {
  if (length <= 0) return 0;
  return (((index + delta) % length) + length) % length;
}

export interface EnquireLinkItem {
  artistSlug?: string | null;
  style?: string | null;
}

/**
 * Build the /enquire deep-link for a lightbox piece. The artist is passed by
 * slug (enquire resolves id-or-slug) and the style uses the plural `styles=`
 * param the enquire page actually reads.
 */
export function enquireHref(item: EnquireLinkItem): string {
  const params = new URLSearchParams();
  if (item.artistSlug) params.set("artist", item.artistSlug);
  if (item.style) params.set("styles", item.style);
  const qs = params.toString();
  return qs ? `/enquire?${qs}` : "/enquire";
}
