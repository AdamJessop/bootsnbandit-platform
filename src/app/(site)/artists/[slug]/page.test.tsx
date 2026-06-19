import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const ARTIST = {
  id: "sarah",
  slug: "sarah",
  name: "Sarah",
  first: "Sarah",
  status: "CO_OWNER" as const,
  tag: "Fine-line, florals & black-and-grey",
  books: "open" as const,
  rating: 4.9,
  pieces: 62,
  styles: ["Fine-line", "Realism"],
  specials: ["Fine-line", "Floral"],
  bio: "Sarah co-founded the studio in 2016.",
  experience: "14 yrs",
  dayRatePence: 55000,
  hourlyRatePence: 9000,
  insta: "@sarah.bnb",
  hue: "crimson",
  headshot: null,
};

vi.mock("../../_data", () => ({
  getArtist: vi.fn(async (slug: string) => (slug === "sarah" ? ARTIST : null)),
  getArtists: vi.fn(async () => [ARTIST]),
  getArtistGallery: vi.fn(async () => [
    {
      id: "g1",
      title: "Ornamental snake & dagger",
      style: "Fine-line",
      placement: "Calf",
      artistSlug: "sarah",
      artistName: "Sarah",
      hue: "crimson",
      big: true,
    },
  ]),
}));

vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("notFound"); } }));

// CSS modules aren't processed in the unit-test env (no PostCSS/Tailwind).
vi.mock("../artists.module.css", () => ({ default: {} }));

describe("ArtistDetailPage", () => {
  it("renders the artist hero, bio, specialisms and portfolio", async () => {
    const { default: Page } = await import("./page");
    const html = renderToStaticMarkup(
      await Page({ params: Promise.resolve({ slug: "sarah" }) }),
    );
    expect(html).toContain("Sarah");
    expect(html).toContain("co-founded");
    expect(html).toContain("Enquire with Sarah");
    expect(html).toContain("Ornamental snake");
    // Status label (not free-text role) and £ rates from numeric pence.
    expect(html).toContain("Co-owner");
    expect(html).toContain("£90"); // hourly 9000p
    expect(html).toContain("£550"); // day 55000p
    expect(html).not.toContain("rateText");
  });

  it("calls notFound for an unknown slug", async () => {
    const { default: Page } = await import("./page");
    await expect(
      Page({ params: Promise.resolve({ slug: "nope" }) }),
    ).rejects.toThrow("notFound");
  });
});
