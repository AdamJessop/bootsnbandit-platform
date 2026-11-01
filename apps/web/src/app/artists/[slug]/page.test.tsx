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

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("notFound");
  },
}));

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

  it("renders each profile stat only when the owner has filled it in", async () => {
    const data = await import("../../_data");
    vi.mocked(data.getArtist).mockResolvedValueOnce({
      ...ARTIST,
      rating: null,
      pieces: null,
      experience: null,
      hourlyRatePence: null,
      dayRatePence: null,
      insta: null,
    });
    const { default: Page } = await import("./page");
    const html = renderToStaticMarkup(
      await Page({ params: Promise.resolve({ slug: "sarah" }) }),
    );
    expect(html).not.toContain("out of 5");
    expect(html).not.toContain("pieces");
    expect(html).not.toContain("experience");
    expect(html).not.toContain("Rates");
    expect(html).not.toContain("Find them");
    expect(html).not.toContain("instagram.com");
  });
});

describe("Artist metadata", () => {
  it("gives each artist a canonical URL and their own share card", async () => {
    const data = await import("../../_data");
    vi.mocked(data.getArtist).mockResolvedValueOnce({
      ...ARTIST,
      headshot: "/media/abc",
    });
    const { generateMetadata } = await import("./page");
    const m = await generateMetadata({
      params: Promise.resolve({ slug: "sarah" }),
    });
    expect(m.title).toBe("Sarah · Co-owner · Boots 'n' Bandit");
    expect(m.description).toBe("Sarah co-founded the studio in 2016.");
    expect(m.alternates?.canonical).toBe("/artists/sarah");
    expect(m.openGraph?.images).toEqual([
      { url: "/media/abc", alt: "Sarah, Co-owner" },
    ]);
  });

  it("falls back to the branded card and a built blurb without a headshot or bio", async () => {
    const data = await import("../../_data");
    vi.mocked(data.getArtist).mockResolvedValueOnce({ ...ARTIST, bio: null });
    const { generateMetadata } = await import("./page");
    const m = await generateMetadata({
      params: Promise.resolve({ slug: "sarah" }),
    });
    expect(m.description).toContain("co-owner at Boots 'n' Bandit");
    expect(m.description).toContain("Fine-line, Realism");
    expect(m.openGraph?.images).toEqual([
      expect.objectContaining({ url: "/opengraph-image" }),
    ]);
  });
});
