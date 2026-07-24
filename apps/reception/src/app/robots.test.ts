import { describe, expect, it } from "vitest";
import robots from "./robots";

/**
 * The reception app is a private studio kiosk — it must never be indexed.
 * robots.ts disallows all crawling and ships no sitemap.
 */
describe("reception robots", () => {
  it("disallows all crawling", () => {
    const result = robots();
    expect(result.rules).toMatchObject({ userAgent: "*", disallow: "/" });
  });

  it("ships no sitemap", () => {
    const result = robots();
    expect(result.sitemap).toBeUndefined();
  });
});
