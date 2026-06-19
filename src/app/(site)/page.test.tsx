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
      role: "Co-owner",
      tag: "Fine-line",
      books: "open",
      rating: 4.9,
      pieces: 62,
      styles: ["Fine-line"],
      specials: [],
      bio: null,
      experience: null,
      rateText: null,
      dayRatePence: null,
      hourlyPence: null,
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
      hue: "crimson",
      big: true,
    },
  ]),
  getFlash: vi.fn(async () => [
    {
      id: "f1",
      title: "Pearl Shell",
      artistName: "Amy",
      hue: "teal",
      size: "~11cm",
      pricePence: 13000,
      total: 3,
      claimed: 1,
      deadline: "Sat 7 Jun",
      status: "available",
    },
  ]),
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
});
