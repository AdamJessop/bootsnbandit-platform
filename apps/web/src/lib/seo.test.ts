import { describe, expect, it } from "vitest";
import { DEFAULT_OG_IMAGE, pageMetadata } from "./seo";

describe("pageMetadata", () => {
  it("sets the canonical path and a matching OG + Twitter card", () => {
    const m = pageMetadata({
      title: "Flash · Boots 'n' Bandit",
      description: "One-off designs.",
      path: "/flash",
    });
    expect(m.alternates?.canonical).toBe("/flash");
    expect(m.openGraph).toMatchObject({
      url: "/flash",
      title: "Flash · Boots 'n' Bandit",
      siteName: "Boots 'n' Bandit",
      locale: "en_GB",
      images: [DEFAULT_OG_IMAGE],
    });
    expect(m.twitter).toMatchObject({
      card: "summary_large_image",
      images: ["/opengraph-image"],
    });
  });

  it("uses a page-specific image when given", () => {
    const m = pageMetadata({
      title: "Sarah",
      description: "Fine-line.",
      path: "/artists/sarah",
      image: { url: "/media/abc", alt: "Sarah" },
    });
    expect(m.openGraph?.images).toEqual([{ url: "/media/abc", alt: "Sarah" }]);
    expect(m.twitter?.images).toEqual(["/media/abc"]);
  });
});
