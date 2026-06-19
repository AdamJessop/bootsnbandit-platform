import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@bnb/core/auth", () => ({
  requireRole: vi.fn(async () => ({ id: "o1", role: "OWNER" })),
}));
vi.mock("@bnb/core/db", () => ({
  prisma: {
    loyaltyConfig: {
      findFirst: vi.fn(async () => ({
        name: "Bandit Pass",
        stampsPerVisit: 1,
        spendPerStamp: 5000,
        rewardThreshold: 8,
        rewardDesc: null,
        expiryMonths: 12,
        messaging: null,
        perks: [{ stamps: 2, title: "Birthday", desc: "" }],
        active: true,
      })),
    },
  },
}));
vi.mock("../_lib/loyalty-action", () => ({ saveLoyalty: vi.fn() }));

describe("LoyaltyContentPage", () => {
  it("renders the loyalty editor seeded from the config", async () => {
    const { default: Page } = await import("./page");
    const html = renderToStaticMarkup(await Page());
    expect(html).toContain("Loyalty");
    expect(html).toContain("2 | Birthday | ");
  });
});
