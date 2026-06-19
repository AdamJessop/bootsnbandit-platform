import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/lib/auth", () => ({
  requireRole: vi.fn(async () => ({ id: "o1", role: "OWNER" })),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    artist: {
      findMany: vi.fn(async () => [
        {
          id: "a1",
          slug: "sarah",
          name: "Sarah",
          status: "CO_OWNER",
          tag: null,
          bio: null,
          specials: [],
          hourlyRatePence: 9000,
          dayRatePence: 60000,
          insta: null,
          headshot: null,
          hue: null,
          booksStatus: "open",
          sortOrder: 0,
          active: true,
          user: { email: "sarah@studio.test", role: "OWNER" },
          styles: [{ id: "s1" }],
        },
      ]),
    },
    tattooStyle: {
      findMany: vi.fn(async () => [{ id: "s1", name: "Fine-line" }]),
    },
  },
}));
vi.mock("./_lib/artist-action", () => ({
  createArtist: vi.fn(),
  updateArtist: vi.fn(),
  deleteArtist: vi.fn(),
}));

describe("ArtistsContentPage", () => {
  it("renders the unified artist editor with rows + status + £ rates", async () => {
    const { default: Page } = await import("./page");
    const html = renderToStaticMarkup(await Page());
    expect(html).toContain("Artists");
    expect(html).toContain("Sarah");
    expect(html).toContain("sarah@studio.test");
    expect(html).toContain("Co-owner");
    expect(html).toContain("£90");
  });
});
