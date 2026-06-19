import type { MetadataRoute } from "next";

/**
 * The admin app is a private staff PWA on its own origin (admin.<domain>). It
 * must never be indexed and ships no public sitemap — disallow everything.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: "/",
    },
  };
}
