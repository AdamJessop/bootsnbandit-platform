import type { MetadataRoute } from "next";

/** Static public routes served from the apex origin. */
const PUBLIC_PATHS = [
  "",
  "/artists",
  "/gallery",
  "/flash",
  "/aftercare",
  "/studio",
  "/enquire",
  "/inkling",
  "/passport",
] as const;

/**
 * Public sitemap for the marketing site. Only apex routes are listed — staff
 * routes live on the admin subdomain and are never exposed here.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const origin = process.env.APP_ORIGIN ?? "https://bootsnbandit.co.uk";
  return PUBLIC_PATHS.map((path) => ({
    url: `${origin}${path}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: path === "" ? 1 : 0.7,
  }));
}
