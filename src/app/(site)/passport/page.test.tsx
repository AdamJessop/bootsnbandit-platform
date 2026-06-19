import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("../_data", () => ({
  getLoyaltyConfig: vi.fn(async () => ({
    name: "Bandit Pass",
    rewardThreshold: 8,
    rewardDesc: "Free small tattoo.",
    perks: [
      { stamps: 2, title: "Birthday treat", desc: "10% off in your birthday month." },
      { stamps: 4, title: "Early flash access", desc: "Claim 24h early." },
      { stamps: 6, title: "Priority booking", desc: "Skip the waitlist." },
      { stamps: 8, title: "Free small tattoo", desc: "On the house." },
    ],
  })),
}));

vi.mock("./passport.module.css", () => ({ default: {} }));

describe("PassportPage", () => {
  it("renders the card, perks ladder and a sample collection", async () => {
    const { default: PassportPage } = await import("./page");
    const html = renderToStaticMarkup(await PassportPage());
    expect(html).toContain("Bandit Pass");
    expect(html).toContain("Birthday treat");
    expect(html).toContain("Free small tattoo");
    expect(html).toContain("Your collection");
  });
});
