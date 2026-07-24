import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("./passport/passport.module.css", () => ({ default: {} }));

vi.mock("./_data", () => ({
  getArtists: vi.fn(async () => [
    {
      id: "sarah",
      slug: "sarah",
      name: "Sarah",
      first: "Sarah",
      status: "CO_OWNER",
      tag: "Fine-line",
      books: "open",
      rating: 4.9,
      pieces: 62,
      styles: ["Fine-line"],
      specials: [],
      bio: null,
      experience: null,
      dayRatePence: null,
      hourlyRatePence: null,
      insta: null,
      hue: null,
      headshot: null,
    },
  ]),
  getGallery: vi.fn(async () => [
    {
      id: "g1",
      title: "Ornamental snake",
      style: "Fine-line",
      placement: "Calf",
      artistSlug: "sarah",
      artistName: "Sarah",
      image: "/uploads/gallery/snake.jpg",
      hue: "crimson",
      big: true,
    },
  ]),
  getFlash: vi.fn(async () => [
    {
      id: "f1",
      title: "Pearl Shell",
      artistName: "Amy",
      image: null,
      hue: "teal",
      size: "~11cm",
      pricePence: 13000,
      total: 3,
      claimed: 1,
      deadline: "Sat 7 Jun",
      status: "available",
    },
  ]),
  getPublishedReviews: vi.fn(async () => []),
  getStyleShowcase: vi.fn(async () => []),
}));

describe("HomePage", () => {
  it("renders the hero, sections and seeded flash price", async () => {
    const { default: HomePage } = await import("./page");
    const html = renderToStaticMarkup(await HomePage());
    expect(html).toContain("Boots");
    expect(html).toContain("Meet the artists");
    expect(html).toContain("Recent work");
    expect(html).toContain("Pearl Shell");
    expect(html).toContain("£130"); // 13000 pence formatted
    expect(html).toContain("The Bandit Pass");
  });

  it("renders CMS gallery images and falls back to sample reviews when too few are published", async () => {
    const { default: HomePage } = await import("./page");
    const html = renderToStaticMarkup(await HomePage());
    expect(html).toContain('src="/uploads/gallery/snake.jpg"');
    // < 3 published reviews → sample quotes fill the band.
    expect(html).toContain("Hannah M.");
  });

  it("shows the abstract teaser plate when no styles have images", async () => {
    const { default: HomePage } = await import("./page");
    const html = renderToStaticMarkup(await HomePage());
    // The teaser fallback art is a unique crimson radial gradient.
    expect(html).toContain("rgba(201,47,77,.22)");
    expect(html).not.toContain("style-showcase");
  });

  it("renders the style showcase grid linking to the matcher when styles have images", async () => {
    const data = await import("./_data");
    vi.mocked(data.getStyleShowcase).mockResolvedValueOnce([
      { name: "Blackwork", image: "/uploads/styles/blackwork.jpg" },
      { name: "Fine-line", image: "/uploads/styles/fineline.jpg" },
    ]);
    const { default: HomePage } = await import("./page");
    const html = renderToStaticMarkup(await HomePage());
    expect(html).toContain('src="/uploads/styles/blackwork.jpg"');
    expect(html).toContain('src="/uploads/styles/fineline.jpg"');
    expect(html).toContain("Blackwork");
    expect(html).toContain('href="/inkling?tab=match"');
    expect(html).toContain('data-cols="2"');
    expect(html).not.toContain("rgba(201,47,77,.22)");
  });

  it("uses a 3-column grid when more than four styles have images", async () => {
    const data = await import("./_data");
    vi.mocked(data.getStyleShowcase).mockResolvedValueOnce(
      ["Blackwork", "Fine-line", "Realism", "Japanese", "Colour"].map((n) => ({
        name: n,
        image: `/uploads/styles/${n.toLowerCase()}.jpg`,
      })),
    );
    const { default: HomePage } = await import("./page");
    const html = renderToStaticMarkup(await HomePage());
    expect(html).toContain('data-cols="3"');
  });

  it("uses published reviews when there are at least 3", async () => {
    const data = await import("./_data");
    vi.mocked(data.getPublishedReviews).mockResolvedValueOnce([
      { id: "r1", name: "Real A", artist: "Amy", rating: 5, quote: "Superb." },
      { id: "r2", name: "Real B", artist: null, rating: 4, quote: "Great." },
      { id: "r3", name: "Real C", artist: "Cal", rating: 5, quote: "Class." },
    ]);
    const { default: HomePage } = await import("./page");
    const html = renderToStaticMarkup(await HomePage());
    expect(html).toContain("Real A");
    expect(html).toContain("Superb.");
    expect(html).not.toContain("Hannah M.");
  });
});
