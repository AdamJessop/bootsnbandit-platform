import type { MetadataRoute } from "next";

/**
 * The reception app is a private studio kiosk on its own origin
 * (reception.<domain>). It must never be indexed and ships no public
 * sitemap — disallow everything.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: "/",
    },
  };
}
