import { prisma } from "@bnb/core/db";

/**
 * Artist showcase service — feeds the reception kiosk's artist showcase
 * screen: the artist's public profile plus their gallery pieces that have an
 * uploaded photo. Payload types are client-safe (strings/numbers/null only)
 * and re-exported type-only by the kiosk, so no prisma reaches the browser.
 *
 * `Artist.rating` / `Artist.pieces` are deliberately NOT exposed: they are
 * prototype seed figures the CMS cannot edit, and the studio only says what
 * is true. The kiosk derives a piece count from the real gallery instead.
 */

export interface ShowcaseArtist {
  id: string;
  name: string;
  /** Studio title enum (CO_OWNER | RESIDENT | APPRENTICE). */
  status: string;
  tag: string | null;
  bio: string | null;
  styles: string[];
  specials: string[];
  insta: string | null;
  experience: string | null;
  headshot: string | null;
  hue: string | null;
}

export interface ShowcaseGalleryItem {
  id: string;
  title: string;
  style: string | null;
  placement: string | null;
  /** Admin-uploaded photo URL — items without one are excluded. */
  image: string;
  hue: string | null;
  featured: boolean;
}

export interface ArtistShowcase {
  artist: ShowcaseArtist;
  gallery: ShowcaseGalleryItem[];
}

/**
 * Load the showcase for one artist. Returns null for unknown or deactivated
 * artists (e.g. the board is stale after an admin change).
 */
export async function loadArtistShowcase(
  artistId: string,
): Promise<ArtistShowcase | null> {
  const [artist, gallery] = await Promise.all([
    prisma.artist.findFirst({
      where: { id: artistId, active: true },
      select: {
        id: true,
        name: true,
        status: true,
        tag: true,
        bio: true,
        styles: { select: { name: true } },
        specials: true,
        insta: true,
        experience: true,
        headshot: true,
        hue: true,
      },
    }),
    prisma.galleryItem.findMany({
      where: { artistId, image: { not: null } },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        title: true,
        style: true,
        placement: true,
        image: true,
        hue: true,
        featured: true,
      },
    }),
  ]);
  if (!artist) return null;

  return {
    artist: {
      id: artist.id,
      name: artist.name,
      status: artist.status,
      tag: artist.tag,
      bio: artist.bio,
      styles: artist.styles.map((s) => s.name),
      specials: artist.specials,
      insta: artist.insta,
      experience: artist.experience,
      headshot: artist.headshot,
      hue: artist.hue,
    },
    gallery: gallery
      // Type-narrowing no-op: the where clause already excludes null images,
      // but Prisma still types `image` as nullable.
      .filter((g): g is typeof g & { image: string } => g.image != null)
      .map((g) => ({
        id: g.id,
        title: g.title,
        style: g.style,
        placement: g.placement,
        image: g.image,
        hue: g.hue,
        featured: g.featured,
      })),
  };
}
