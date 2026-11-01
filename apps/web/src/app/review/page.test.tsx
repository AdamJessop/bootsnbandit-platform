import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("../_data", () => ({
  getSiteSettings: vi.fn(async () => ({ email: "hello@studio.test" })),
}));

const { default: ReviewIndexPage, metadata } = await import("./page");

describe("ReviewIndexPage (/review without a token)", () => {
  it("explains to use the emailed link and how to reach the studio", async () => {
    const html = renderToStaticMarkup(await ReviewIndexPage());
    expect(html).toContain("Use the link from your email");
    expect(html).toContain("send you a fresh one");
    expect(html).toContain("mailto:hello@studio.test");
    expect(html).toContain('href="/studio"');
  });

  it("still points at the contact page when no studio email is set", async () => {
    const data = await import("../_data");
    vi.mocked(data.getSiteSettings).mockResolvedValueOnce(null);
    const html = renderToStaticMarkup(await ReviewIndexPage());
    expect(html).not.toContain("mailto:");
    expect(html).toContain('href="/studio"');
  });

  it("keeps the page out of search indexes", () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});
