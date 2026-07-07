import "server-only";
import { prisma } from "@bnb/core/db";
import type { BooksStatus } from "@/components/site";
import type { ArtistStatus } from "@bnb/core/artist-status";
import { firstName } from "./_format";

/**
 * Shared data-access helpers for the public marketing site.
 *
 * Every public page is a Server Component that reads content straight from the
 * seeded DB via Prisma. These helpers centralise the queries + the small
 * shaping needed to feed the ported site primitives (which expect lightweight
 * prop shapes). Pure formatting lives in `_format.ts`.
 */

export interface SiteArtist {
  /** Slug used as the primitive `id` (drives card links / plate seeds). */
  id: string;
  slug: string;
  name: string;
  first: string;
  status: ArtistStatus;
  tag: string;
  books: BooksStatus;
  rating: number | null;
  pieces: number | null;
  styles: string[];
  specials: string[];
  bio: string | null;
  experience: string | null;
  dayRatePence: number | null;
  hourlyRatePence: number | null;
  insta: string | null;
  hue: string | null;
  headshot: string | null;
}

export interface SiteGalleryItem {
  id: string;
  title: string;
  style: string | null;
  placement: string | null;
  artistSlug: string | null;
  artistName: string | null;
  /** Admin-uploaded photo URL; tiles fall back to the procedural Plate. */
  image: string | null;
  hue: string | null;
  big: boolean;
}

export interface SiteFlash {
  id: string;
  title: string;
  artistName: string | null;
  /** Admin-uploaded design URL; cards fall back to the paper Plate. */
  image: string | null;
  hue: string | null;
  size: string | null;
  pricePence: number | null;
  total: number;
  claimed: number;
  deadline: string | null;
  status: string;
}

const ARTIST_SELECT = {
  id: true,
  slug: true,
  name: true,
  status: true,
  tag: true,
  booksStatus: true,
  rating: true,
  pieces: true,
  styles: { select: { name: true } },
  specials: true,
  bio: true,
  experience: true,
  dayRatePence: true,
  hourlyRatePence: true,
  insta: true,
  hue: true,
  headshot: true,
} as const;

type RawArtist = {
  id: string;
  slug: string;
  name: string;
  status: ArtistStatus;
  tag: string | null;
  booksStatus: BooksStatus;
  rating: number | null;
  pieces: number | null;
  styles: { name: string }[];
  specials: string[];
  bio: string | null;
  experience: string | null;
  dayRatePence: number | null;
  hourlyRatePence: number | null;
  insta: string | null;
  hue: string | null;
  headshot: string | null;
};

function shapeArtist(r: RawArtist): SiteArtist {
  return {
    id: r.slug,
    slug: r.slug,
    name: r.name,
    first: firstName(r.name),
    status: r.status,
    tag: r.tag ?? "",
    books: r.booksStatus,
    rating: r.rating,
    pieces: r.pieces,
    styles: r.styles.map((s) => s.name),
    specials: r.specials,
    bio: r.bio,
    experience: r.experience,
    dayRatePence: r.dayRatePence,
    hourlyRatePence: r.hourlyRatePence,
    insta: r.insta,
    hue: r.hue,
    headshot: r.headshot,
  };
}

/** All active artists ordered by their seed sortOrder. */
export async function getArtists(): Promise<SiteArtist[]> {
  const rows = await prisma.artist.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
    select: ARTIST_SELECT,
  });
  return rows.map(shapeArtist);
}

/** A single artist by slug (or null). */
export async function getArtist(slug: string): Promise<SiteArtist | null> {
  const row = await prisma.artist.findUnique({
    where: { slug },
    select: ARTIST_SELECT,
  });
  return row ? shapeArtist(row) : null;
}

function shapeGallery(g: {
  id: string;
  title: string;
  style: string | null;
  placement: string | null;
  image: string | null;
  hue: string | null;
  featured: boolean;
  artist: { name: string; slug: string } | null;
}): SiteGalleryItem {
  return {
    id: g.id,
    title: g.title,
    style: g.style,
    placement: g.placement,
    artistSlug: g.artist?.slug ?? null,
    artistName: g.artist?.name ?? null,
    image: g.image,
    hue: g.hue,
    big: g.featured,
  };
}

/** All gallery pieces ordered by sortOrder, with their artist name/slug. */
export async function getGallery(): Promise<SiteGalleryItem[]> {
  const rows = await prisma.galleryItem.findMany({
    orderBy: { sortOrder: "asc" },
    include: { artist: { select: { name: true, slug: true } } },
  });
  return rows.map(shapeGallery);
}

/** Gallery pieces for one artist (by slug). */
export async function getArtistGallery(
  slug: string,
): Promise<SiteGalleryItem[]> {
  const rows = await prisma.galleryItem.findMany({
    where: { artist: { slug } },
    orderBy: { sortOrder: "asc" },
    include: { artist: { select: { name: true, slug: true } } },
  });
  return rows.map(shapeGallery);
}

/** All flash designs ordered by sortOrder, with artist name. */
export async function getFlash(): Promise<SiteFlash[]> {
  const rows = await prisma.flash.findMany({
    orderBy: { sortOrder: "asc" },
    include: { artist: { select: { name: true } } },
  });
  return rows.map((f) => ({
    id: f.id,
    title: f.title,
    artistName: f.artist?.name ?? null,
    image: f.image,
    hue: f.hue,
    size: f.sizeCm,
    pricePence: f.pricePence,
    total: f.total,
    claimed: f.claimed,
    deadline: f.deadline,
    status: f.status,
  }));
}

export interface SiteReview {
  id: string;
  /** Customer display name. */
  name: string;
  /** First name of the artist the reviewed booking was with (if any). */
  artist: string | null;
  quote: string;
  rating: number;
}

/** Latest published reviews with a written quote, for the home page. */
export async function getPublishedReviews(take = 3): Promise<SiteReview[]> {
  const rows = await prisma.review.findMany({
    where: { status: "published", body: { not: null } },
    orderBy: { submittedAt: "desc" },
    take,
    select: {
      id: true,
      rating: true,
      body: true,
      customer: { select: { name: true } },
      booking: { select: { artist: { select: { name: true } } } },
    },
  });
  return rows
    .filter((r) => (r.body ?? "").trim().length > 0)
    .map((r) => ({
      id: r.id,
      name: r.customer?.name ?? "A customer",
      artist: r.booking?.artist ? firstName(r.booking.artist.name) : null,
      quote: (r.body ?? "").trim(),
      rating: r.rating ?? 5,
    }));
}

/** Ordered list of style names (from the TattooStyle table). */
export async function getStyles(): Promise<string[]> {
  const rows = await prisma.tattooStyle.findMany({
    orderBy: { sortOrder: "asc" },
    select: { name: true },
  });
  return rows.map((s) => s.name);
}

/** Ordered aftercare stages. */
export async function getAftercareStages() {
  return prisma.aftercareStage.findMany({ orderBy: { order: "asc" } });
}

/** Ordered FAQ entries. */
export async function getFaqs() {
  return prisma.faq.findMany({ orderBy: { sortOrder: "asc" } });
}

/** The site-settings singleton (first row). */
export async function getSiteSettings() {
  return prisma.siteSettings.findFirst();
}

export interface LoyaltyPerk {
  stamps: number;
  title: string;
  desc: string;
}

/** The active loyalty config singleton with typed perks. */
export async function getLoyaltyConfig() {
  const cfg = await prisma.loyaltyConfig.findFirst({ where: { active: true } });
  if (!cfg) return null;
  const perks = (Array.isArray(cfg.perks)
    ? cfg.perks
    : []) as unknown as LoyaltyPerk[];
  return { ...cfg, perks };
}
