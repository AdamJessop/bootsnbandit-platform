import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@bnb/core/auth", () => ({
  requireRole: vi.fn(async () => ({ id: "o1", role: "OWNER" })),
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
});
