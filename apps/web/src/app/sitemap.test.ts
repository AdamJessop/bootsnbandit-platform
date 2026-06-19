import { afterEach, describe, expect, it } from "vitest";
import sitemap from "./sitemap";

const original = process.env.APP_ORIGIN;
afterEach(() => {
  if (original === undefined) delete process.env.APP_ORIGIN;
  else process.env.APP_ORIGIN = original;
});

describe("public sitemap", () => {
  it("lists the core public routes under APP_ORIGIN", () => {
    process.env.APP_ORIGIN = "https://example.test";
    const urls = sitemap().map((e) => e.url);
    expect(urls).toContain("https://example.test");
    expect(urls).toContain("https://example.test/artists");
    expect(urls).toContain("https://example.test/gallery");
    expect(urls).toContain("https://example.test/flash");
    expect(urls).toContain("https://example.test/aftercare");
    expect(urls).toContain("https://example.test/studio");
    expect(urls).toContain("https://example.test/enquire");
    expect(urls).toContain("https://example.test/inkling");
    expect(urls).toContain("https://example.test/passport");
  });

  it("does not expose staff routes", () => {
    const urls = sitemap().map((e) => e.url);
    expect(urls.some((u) => u.includes("/admin"))).toBe(false);
  });
});
