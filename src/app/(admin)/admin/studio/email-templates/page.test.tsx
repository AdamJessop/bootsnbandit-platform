import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/lib/auth", () => ({
  requireRole: vi.fn(async () => ({ id: "o1", role: "OWNER" })),
}));
vi.mock("@/lib/email/render", () => ({
  renderEmail: vi.fn(async (type: string) => ({
    subject: `${type} subject`,
    html: `<p>${type} body</p>`,
  })),
}));

describe("EmailTemplatesPage", () => {
  it("previews each of the 7 templates", async () => {
    const { default: Page } = await import("./page");
    const html = renderToStaticMarkup(await Page());
    expect(html).toContain("Email templates");
    expect(html).toContain("Booking confirmation");
    expect(html).toContain("Loyalty reward");
    // 7 preview iframes
    expect(html.match(/<iframe/g)?.length).toBe(7);
  });
});
