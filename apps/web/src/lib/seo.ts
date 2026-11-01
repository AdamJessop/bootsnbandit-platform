import type { Metadata } from "next";

/**
 * Per-page SEO metadata: title + description, a canonical URL and the matching
 * Open Graph / Twitter card. Paths are relative — the root layout's
 * `metadataBase` (APP_ORIGIN) makes them absolute. Pages without their own
 * image share the branded card rendered by app/opengraph-image.tsx.
 */

export const SITE_NAME = "Boots 'n' Bandit";

export const DEFAULT_OG_IMAGE = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: "Boots 'n' Bandit Tattoo Studio, Worksop",
};

export interface PageMetaInput {
  title: string;
  description: string;
  /** Canonical path, e.g. "/flash". */
  path: string;
  /** Page-specific share image (e.g. an artist headshot). */
  image?: { url: string; alt: string };
}

export function pageMetadata({
  title,
  description,
  path,
  image,
}: PageMetaInput): Metadata {
  const images = [image ?? DEFAULT_OG_IMAGE];
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: "en_GB",
      url: path,
      title,
      description,
      images,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: images.map((i) => i.url),
    },
  };
}
