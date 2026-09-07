import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@bnb/core/auth", () => ({
  requireRole: vi.fn(async () => ({ id: "o1", role: "OWNER" })),
}));

describe("StudioHubPage", () => {
  it("renders the studio hub with links to each section", async () => {
    const { default: Page } = await import("./page");
    const html = renderToStaticMarkup(await Page());
    expect(html).toContain("Studio");
    expect(html).toContain("/studio/staff");
    expect(html).toContain("/studio/integrations");
    expect(html).toContain("/studio/channels");
  });
});
