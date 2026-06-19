import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/lib/auth", () => ({
  requireRole: vi.fn(async () => ({ id: "o1", role: "OWNER" })),
}));

describe("ContentHubPage", () => {
  it("renders the content hub with links to each CMS section", async () => {
    const { default: Page } = await import("./page");
    const html = renderToStaticMarkup(await Page());
    expect(html).toContain("Content");
    expect(html).toContain("/admin/content/gallery");
    expect(html).toContain("/admin/content/loyalty");
    expect(html).toContain("/admin/content/site");
  });
});
