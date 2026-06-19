import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("../_data", () => ({
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
}));

describe("ArtistsPage", () => {
  it("renders the heading, filter chips and an artist card", async () => {
    const { default: ArtistsPage } = await import("./page");
    const html = renderToStaticMarkup(await ArtistsPage());
    expect(html).toContain("Our artists");
    expect(html).toContain("Everyone");
    expect(html).toContain("Sarah");
  });
});
