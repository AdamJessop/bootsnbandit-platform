import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@bnb/core/auth", () => ({
  requireRole: vi.fn(async () => ({ id: "o1", role: "OWNER" })),
}));
vi.mock("@bnb/core/services/reviews", () => ({
  countReviewsAwaitingModeration: vi.fn(async () => 2),
}));

describe("ContentHubPage", () => {
  it("renders the content hub with links to each CMS section", async () => {
    const { default: Page } = await import("./page");
    const html = renderToStaticMarkup(await Page());
    expect(html).toContain("Content");
    expect(html).toContain("/content/gallery");
    expect(html).toContain("/content/loyalty");
    expect(html).toContain("/content/site");
  });

  it("links Reviews and badges how many are awaiting moderation", async () => {
    const { default: Page } = await import("./page");
    const html = renderToStaticMarkup(await Page());
    expect(html).toContain("/content/reviews");
    expect(html).toContain('2<span class="sr-only"> awaiting</span>');
  });
});
