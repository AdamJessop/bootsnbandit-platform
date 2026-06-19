import { describe, expect, it } from "vitest";
import robots from "./robots";

/**
 * The admin app is a private staff PWA — it must never be indexed. robots.ts
 * disallows all crawling and ships no sitemap.
 */
describe("admin robots", () => {
  it("disallows all crawling", () => {
    const result = robots();
    expect(result.rules).toMatchObject({ userAgent: "*", disallow: "/" });
  });

  it("ships no sitemap", () => {
    const result = robots();
    expect(result.sitemap).toBeUndefined();
  });
});
