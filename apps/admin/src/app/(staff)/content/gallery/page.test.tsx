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
  });
});
