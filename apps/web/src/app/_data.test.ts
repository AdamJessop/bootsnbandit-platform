import { describe, it, expect, vi } from "vitest";

// `_data.ts` is a thin Prisma data-access layer for the public site. We mock
// the db + `server-only` so we can assert the query→prop shaping (including
// the CMS-uploaded `image` fields) without a live database.
const prisma = vi.hoisted(() => ({
  galleryItem: { findMany: vi.fn() },
  flash: { findMany: vi.fn() },
  review: { findMany: vi.fn(), aggregate: vi.fn() },
  tattooStyle: { findMany: vi.fn() },
}));
vi.mock("server-only", () => ({}));
vi.mock("@bnb/core/db", () => ({ prisma }));

const data = await import("./_data");

describe("_data module surface", () => {
  it("exports the page data-access helpers", () => {
    for (const fn of [
      "getArtists",
      "getArtist",
      "getGallery",
      "getArtistGallery",
      "getFlash",
      "getPublishedReviews",
      "getReviewStats",
      "getStyles",
      "getStyleShowcase",
      "getAftercareStages",
      "getFaqs",
      "getSiteSettings",
      "getLoyaltyConfig",
    ]) {
      expect(typeof (data as Record<string, unknown>)[fn]).toBe("function");
    }
  });
});

describe("getGallery mapping", () => {
  it("maps the CMS image column (and null → procedural fallback)", async () => {
    prisma.galleryItem.findMany.mockResolvedValueOnce([
      {
        id: "g1",
        title: "Koi & lotus",
        style: "Japanese",
        placement: "Forearm",
        image: "/uploads/gallery/koi.jpg",
        hue: "rust",
        featured: true,
        artist: { name: "Alisha Vane", slug: "alisha" },
      },
      {
        id: "g2",
        title: "Dagger",
        style: null,
        placement: null,
        image: null,
        hue: null,
        featured: false,
        artist: null,
      },
    ]);
    const items = await data.getGallery();
    expect(items[0]).toMatchObject({
      id: "g1",
      image: "/uploads/gallery/koi.jpg",
      artistSlug: "alisha",
      artistName: "Alisha Vane",
      big: true,
    });
    expect(items[1]).toMatchObject({ id: "g2", image: null, big: false });
  });
});

describe("getFlash mapping", () => {
  it("maps the CMS image column onto the flash shape", async () => {
    prisma.flash.findMany.mockResolvedValueOnce([
      {
        id: "f1",
        title: "Pearl Shell",
        image: "/uploads/flash/pearl.jpg",
        hue: "teal",
        sizeCm: "~11cm",
        pricePence: 13000,
        total: 3,
        claimed: 1,
        endsAt: new Date("2026-11-14T18:00:00Z"),
        status: "available",
        artist: { name: "Amy" },
      },
    ]);
    const flash = await data.getFlash();
    expect(flash[0]).toMatchObject({
      id: "f1",
      image: "/uploads/flash/pearl.jpg",
      artistName: "Amy",
      size: "~11cm",
      endsAt: new Date("2026-11-14T18:00:00Z"),
    });
  });
});

describe("getPublishedReviews mapping", () => {
  it("shapes published reviews with customer + artist first name", async () => {
    prisma.review.findMany.mockResolvedValueOnce([
      {
        id: "r1",
        rating: 5,
        body: "  Healed perfectly. ",
        customer: { name: "Hannah M." },
        booking: { artist: { name: "Amy Cartwright" } },
      },
      {
        id: "r2",
        rating: null,
        body: "Brilliant.",
        customer: null,
        booking: null,
      },
    ]);
    const reviews = await data.getPublishedReviews(3);
    expect(reviews[0]).toEqual({
      id: "r1",
      name: "Hannah M.",
      artist: "Amy",
      quote: "Healed perfectly.",
      rating: 5,
    });
    expect(reviews[1]).toEqual({
      id: "r2",
      name: "A customer",
      artist: null,
      quote: "Brilliant.",
      rating: 5,
    });
  });

  it("only queries published reviews with a body", async () => {
    prisma.review.findMany.mockResolvedValueOnce([]);
    await data.getPublishedReviews(3);
    expect(prisma.review.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { status: "published", body: { not: null } },
        take: 3,
      }),
    );
  });
});

describe("getReviewStats", () => {
  it("counts rated published reviews and rounds the average", async () => {
    prisma.review.aggregate.mockResolvedValueOnce({
      _count: { rating: 4 },
      _avg: { rating: 4.75 },
    });
    expect(await data.getReviewStats()).toEqual({ count: 4, average: 4.8 });
    expect(prisma.review.aggregate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { status: "published", rating: { not: null } },
      }),
    );
  });

  it("has no average with no rated reviews", async () => {
    prisma.review.aggregate.mockResolvedValueOnce({
      _count: { rating: 0 },
      _avg: { rating: null },
    });
    expect(await data.getReviewStats()).toEqual({ count: 0, average: null });
  });
});

describe("getStyleShowcase mapping", () => {
  it("returns only styles with a non-empty image, in sortOrder", async () => {
    prisma.tattooStyle.findMany.mockResolvedValueOnce([
      { name: "Japanese", image: "/uploads/styles/japanese.jpg" },
      { name: "Blackwork", image: null },
      { name: "Fine Line", image: "" },
      { name: "Traditional", image: "/uploads/styles/traditional.jpg" },
    ]);
    const showcase = await data.getStyleShowcase();
    expect(showcase).toEqual([
      { name: "Japanese", image: "/uploads/styles/japanese.jpg" },
      { name: "Traditional", image: "/uploads/styles/traditional.jpg" },
    ]);
  });

  it("queries only styles with a non-null image, ordered by sortOrder", async () => {
    prisma.tattooStyle.findMany.mockResolvedValueOnce([]);
    await data.getStyleShowcase();
    expect(prisma.tattooStyle.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { image: { not: null } },
        orderBy: { sortOrder: "asc" },
      }),
    );
  });
});
