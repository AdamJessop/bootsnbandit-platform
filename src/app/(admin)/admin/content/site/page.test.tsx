import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/lib/auth", () => ({
  requireRole: vi.fn(async () => ({ id: "o1", role: "OWNER" })),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    siteSettings: {
      findFirst: vi.fn(async () => ({
        studioName: "Boots 'n' Bandit",
        tickerLines: ["Walk-ins welcome"],
        enquiriesOpen: true,
        visualDirection: "heritage",
      })),
    },
  },
}));
vi.mock("../_lib/site-action", () => ({ saveSite: vi.fn() }));

describe("SiteContentPage", () => {
  it("renders the site settings editor seeded from settings", async () => {
    const { default: Page } = await import("./page");
    const html = renderToStaticMarkup(await Page());
    expect(html).toContain("Site settings");
    expect(html).toContain("Walk-ins welcome");
  });
});
