import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@bnb/core/auth", () => ({
  requireRole: vi.fn(async () => ({ id: "o1", role: "OWNER" })),
}));
vi.mock("@bnb/core/db", () => ({
  prisma: {
    galleryItem: {
      findMany: vi.fn(async () => [
        { id: "g1", title: "Snake", style: "Traditional", featured: true, sortOrder: 0 },
      ]),
    },
  },
}));
vi.mock("../_lib/crud", () => ({
  createRow: vi.fn(),
  updateRow: vi.fn(),
  deleteRow: vi.fn(),
}));

describe("GalleryContentPage", () => {
  it("renders the gallery editor with existing rows", async () => {
    const { default: Page } = await import("./page");
    const html = renderToStaticMarkup(await Page());
    expect(html).toContain("Gallery");
    expect(html).toContain("Snake");
  });
});
