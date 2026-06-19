import type { MetadataRoute } from "next";

/**
 * Public marketing site — crawlable. The apex origin welcomes search engines
 * (the staff admin subdomain ships its own `Disallow: /` robots in apps/admin).
 */
export default function robots(): MetadataRoute.Robots {
  const origin = process.env.APP_ORIGIN ?? "https://bootsnbandit.co.uk";
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: `${origin}/sitemap.xml`,
  };
}
