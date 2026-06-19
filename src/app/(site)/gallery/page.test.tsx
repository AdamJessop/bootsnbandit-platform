import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("../_data", () => ({
  getGallery: vi.fn(async () => [
    {
      id: "g1",
      title: "Koi & lotus",
      style: "Japanese",
      placement: "Forearm",
      artistSlug: "rhodri",
      artistName: "Alisha",
      hue: "rust",
      big: true,
    },
  ]),
  getStyles: vi.fn(async () => ["Japanese", "Fine-line"]),
  getArtists: vi.fn(async () => [
    { slug: "rhodri", name: "Alisha", books: "limited" },
  ]),
}));

describe("GalleryPage", () => {
  it("renders the page head and the browser with seeded pieces", async () => {
    const { default: GalleryPage } = await import("./page");
    const html = renderToStaticMarkup(await GalleryPage());
    expect(html).toContain("Gallery");
    expect(html).toContain("Koi &amp; lotus");
    expect(html).toContain("1 piece");
  });
});
