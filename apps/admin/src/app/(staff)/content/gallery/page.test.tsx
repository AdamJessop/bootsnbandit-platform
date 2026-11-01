import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@bnb/core/auth", () => ({
  requireRole: vi.fn(async () => ({ id: "o1", role: "OWNER" })),
}));
const prisma = vi.hoisted(() => ({
  galleryItem: { findMany: vi.fn() },
  artist: { findMany: vi.fn() },
}));
vi.mock("@bnb/core/db", () => ({ prisma }));
vi.mock("../_lib/crud", () => ({
  createRow: vi.fn(),
  updateRow: vi.fn(),
  deleteRow: vi.fn(),
}));

describe("GalleryContentPage", () => {
  it("renders the gallery editor with existing rows and the artist's name", async () => {
    prisma.galleryItem.findMany.mockResolvedValue([
      {
        id: "g1",
        title: "Snake",
        style: "Traditional",
        artistId: "a1",
        featured: true,
        sortOrder: 0,
      },
    ]);
    prisma.artist.findMany.mockResolvedValue([
      { id: "a1", name: "Sarah Boots" },
    ]);
    const { default: Page } = await import("./page");
    const html = renderToStaticMarkup(await Page());
    expect(html).toContain("Gallery");
    expect(html).toContain("Snake");
    expect(html).toContain("Sarah Boots");
    expect(html).not.toContain("Artist ID");
    // Image column: this row has no photo yet.
    expect(html).toContain("No image");
  });

  it("no longer offers the decorative free-text Hue field", async () => {
    prisma.galleryItem.findMany.mockResolvedValue([]);
    prisma.artist.findMany.mockResolvedValue([]);
    const { default: Page } = await import("./page");
    const tree = await Page();
    const fields = (tree.props.children as { props: { fields?: unknown } }[])
      .map((c) => c?.props?.fields)
      .find(Boolean) as { name: string }[];
    expect(fields.map((f) => f.name)).not.toContain("hue");
    expect(fields.map((f) => f.name)).toContain("image");
  });
});
