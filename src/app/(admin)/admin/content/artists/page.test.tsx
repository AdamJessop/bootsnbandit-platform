import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/lib/auth", () => ({
  requireRole: vi.fn(async () => ({ id: "o1", role: "OWNER" })),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    artist: {
      findMany: vi.fn(async () => [
        { id: "a1", name: "Sarah", role: "Co-owner", booksStatus: "open", sortOrder: 0 },
      ]),
    },
  },
}));
vi.mock("../_lib/crud", () => ({
  createRow: vi.fn(),
  updateRow: vi.fn(),
  deleteRow: vi.fn(),
}));

describe("ArtistsContentPage", () => {
  it("renders the artists editor with rows", async () => {
    const { default: Page } = await import("./page");
    const html = renderToStaticMarkup(await Page());
    expect(html).toContain("Artists");
    expect(html).toContain("Sarah");
  });
});
