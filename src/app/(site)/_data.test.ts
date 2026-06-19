import { describe, it, expect, vi } from "vitest";

// `_data.ts` is a thin Prisma data-access layer for the public site. We mock
// the db + `server-only` so we can assert it exposes the expected query helpers
// without needing a live database in the unit-test run.
vi.mock("server-only", () => ({}));
vi.mock("@bnb/core/db", () => ({ prisma: {} }));

describe("_data module surface", () => {
  it("exports the page data-access helpers", async () => {
    const mod = await import("./_data");
    for (const fn of [
      "getArtists",
      "getArtist",
      "getGallery",
      "getArtistGallery",
      "getFlash",
      "getStyles",
      "getAftercareStages",
      "getFaqs",
      "getSiteSettings",
      "getLoyaltyConfig",
    ]) {
      expect(typeof (mod as Record<string, unknown>)[fn]).toBe("function");
    }
  });
});
