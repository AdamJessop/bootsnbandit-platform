import type { MetadataRoute } from "next";
import { siteIndexable, siteOrigin } from "@/lib/site-origin";

/** Per request: the answer depends on the runtime env and the request host. */
export const dynamic = "force-dynamic";

/**
 * Public marketing site robots. Only the production origin (PRODUCTION_ORIGIN,
 * see lib/site-origin) welcomes crawlers and advertises the sitemap; staging
 * and any other host disallow everything. The staff admin subdomain ships its
 * own `Disallow: /` robots in apps/admin.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  if (!(await siteIndexable())) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: `${siteOrigin()}/sitemap.xml`,
    host: siteOrigin(),
  };
}
