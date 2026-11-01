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
      endsAt: null,
      status: "available",
    },
  ]),
  getPublishedReviews: vi.fn(async () => []),
  getReviewStats: vi.fn(async () => ({ count: 0, average: null })),
  getSiteSettings: vi.fn(async () => ({ enquiriesOpen: true })),
  getStyleShowcase: vi.fn(async () => []),
}));

const FUTURE = new Date(Date.now() + 3 * 86_400_000);
const PAST = new Date(Date.now() - 86_400_000);
const flashRow = (over: Record<string, unknown>) => ({
  id: "f",
  title: "Flash",
  artistName: "Amy",
  image: null,
  hue: null,
  size: null,
  pricePence: 10000,
  total: 2,
  claimed: 0,
  endsAt: null,
  status: "available",
  ...over,
});

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

  it("renders CMS gallery images and hides the review band when too few are published", async () => {
    const { default: HomePage } = await import("./page");
    const html = renderToStaticMarkup(await HomePage());
    expect(html).toContain('src="/uploads/gallery/snake.jpg"');
    // < 3 published reviews → no band, and never the old sample quotes.
    expect(html).not.toContain("What people say");
    expect(html).not.toContain("Hannah M.");
    expect(html).not.toContain("Priya K.");
  });

  it("shows no invented figures: no seeded rating, years or piece counts", async () => {
    const { default: HomePage } = await import("./page");
    const html = renderToStaticMarkup(await HomePage());
    expect(html).not.toContain("380+");
    expect(html).not.toContain("4.9 from");
    expect(html).not.toContain("10+");
    expect(html).not.toContain("12k+");
    expect(html).not.toContain("Average rating");
    expect(html).not.toContain("Summer 2026");
    expect(html).not.toContain("this weekend");
    // The artist count alone doesn't earn a stat band.
    expect(html).not.toContain("stat-strip");
  });

  it("shows the real review average and count once 3+ are published", async () => {
    const data = await import("./_data");
    vi.mocked(data.getReviewStats).mockResolvedValueOnce({
      count: 5,
      average: 4.6,
    });
    const { default: HomePage } = await import("./page");
    const html = renderToStaticMarkup(await HomePage());
    expect(html).toContain("4.6 from 5 reviews");
    expect(html).toContain("Average rating");
    expect(html).toContain("Published reviews");
  });

  it("keeps the rating hidden with fewer than 3 rated reviews", async () => {
    const data = await import("./_data");
    vi.mocked(data.getReviewStats).mockResolvedValueOnce({
      count: 2,
      average: 5,
    });
    const { default: HomePage } = await import("./page");
    const html = renderToStaticMarkup(await HomePage());
    expect(html).not.toContain("from 2 reviews");
    expect(html).not.toContain("Average rating");
  });

  it("drives the hero ribbon from the enquiries switch", async () => {
    const data = await import("./_data");
    const { default: HomePage } = await import("./page");
    const ribbon = (html: string) =>
      /<span class="hero-ribbon">(.*?)<\/span><h1/.exec(html)?.[1] ?? "";
    expect(ribbon(renderToStaticMarkup(await HomePage()))).toContain(
      "Books open",
    );
    vi.mocked(data.getSiteSettings).mockResolvedValueOnce({
      enquiriesOpen: false,
    } as never);
    const closed = ribbon(renderToStaticMarkup(await HomePage()));
    expect(closed).toContain("Books closed");
    expect(closed).not.toContain("Books open");
  });

  it("labels the Bandit Pass card as an example", async () => {
    const { default: HomePage } = await import("./page");
    const html = renderToStaticMarkup(await HomePage());
    expect(html).toContain("Example card");
  });

  it("hides expired flash and labels the band with the real closing date", async () => {
    const data = await import("./_data");
    vi.mocked(data.getFlash).mockResolvedValueOnce([
      flashRow({ id: "old", title: "Gone Moth", endsAt: PAST }),
      flashRow({ id: "new", title: "Fresh Swallow", endsAt: FUTURE }),
    ]);
    const { default: HomePage } = await import("./page");
    const html = renderToStaticMarkup(await HomePage());
    expect(html).not.toContain("Gone Moth");
    expect(html).toContain("Fresh Swallow");
    expect(html).toContain("Flash drop · live until");
  });

  it("drops the flash band entirely when nothing is live", async () => {
    const data = await import("./_data");
    vi.mocked(data.getFlash).mockResolvedValueOnce([
      flashRow({ id: "old", title: "Gone Moth", endsAt: PAST }),
    ]);
    const { default: HomePage } = await import("./page");
    const html = renderToStaticMarkup(await HomePage());
    expect(html).not.toContain("Claim a one-off design");
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
