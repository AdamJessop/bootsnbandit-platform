import { afterEach, describe, expect, it } from "vitest";
import robots from "./robots";

const original = process.env.APP_ORIGIN;
afterEach(() => {
  if (original === undefined) delete process.env.APP_ORIGIN;
  else process.env.APP_ORIGIN = original;
});

describe("public robots", () => {
  it("allows all crawlers (public marketing site)", () => {
    const r = robots();
    expect(r.rules).toEqual([{ userAgent: "*", allow: "/" }]);
  });

  it("points the sitemap at APP_ORIGIN when set", () => {
    process.env.APP_ORIGIN = "https://example.test";
    expect(robots().sitemap).toBe("https://example.test/sitemap.xml");
  });
});
