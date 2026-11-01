import type { MetadataRoute } from "next";
import { prisma } from "@bnb/core/db";
import { siteOrigin } from "@/lib/site-origin";

/**
 * Rendered per request: a build-time prerender would bake in the build box's
 * origin and an empty artist list (the DB is not reachable during the build).
 */
export const dynamic = "force-dynamic";

/**
 * Static public routes served from the apex origin. /passport is left out: it
 * is behind the Bandit Pass sign-in, so crawlers only ever see a redirect.
 */
const PUBLIC_PATHS = [
  "",
  "/artists",
  "/gallery",
  "/flash",
  "/aftercare",
  "/studio",
  "/enquire",
  "/inkling",
  "/account/sign-in",
  "/privacy",
  "/data-deletion",
] as const;

/** Active artist slugs for /artists/<slug>; [] when the DB is unavailable. */
async function getArtistSlugs(): Promise<string[]> {
  try {
    const artists = await prisma.artist.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      select: { slug: true },
    });
    return artists.map((a) => a.slug);
  } catch {
    return [];
  }
}

/**
 * Public sitemap for the marketing site: the static apex routes plus the
 * artist detail pages from the DB, under APP_ORIGIN. Staff routes live on the
 * admin subdomain and are never exposed here.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = siteOrigin();
  const lastModified = new Date();
  const slugs = await getArtistSlugs();
  return [
    ...PUBLIC_PATHS.map((path) => ({
      url: `${origin}${path}`,
      lastModified,
      changeFrequency: "weekly" as const,
      priority: path === "" ? 1 : 0.7,
    })),
    ...slugs.map((slug) => ({
      url: `${origin}/artists/${slug}`,
      lastModified,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];
}
