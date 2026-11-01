import { afterEach, describe, expect, it, vi } from "vitest";

const headerMap = vi.hoisted(() => new Map<string, string>());
vi.mock("next/headers", () => ({
  headers: async () => ({ get: (k: string) => headerMap.get(k) ?? null }),
}));

const { default: robots, dynamic } = await import("./robots");

const env = { ...process.env };
afterEach(() => {
  process.env = { ...env };
  headerMap.clear();
});

describe("public robots", () => {
  it("is rendered per request, not baked in at build", () => {
    expect(dynamic).toBe("force-dynamic");
  });

  it("allows all crawlers on the production origin and points at its sitemap", async () => {
    process.env.APP_ORIGIN = "https://bootsnbandit.com";
    process.env.PRODUCTION_ORIGIN = "https://bootsnbandit.com";
    headerMap.set("host", "bootsnbandit.com");
    const r = await robots();
    expect(r.rules).toEqual([{ userAgent: "*", allow: "/" }]);
    expect(r.sitemap).toBe("https://bootsnbandit.com/sitemap.xml");
  });

  it("disallows everything on staging", async () => {
    process.env.APP_ORIGIN = "https://staging.bootsnbandit.com";
    process.env.PRODUCTION_ORIGIN = "https://bootsnbandit.com";
    headerMap.set("host", "staging.bootsnbandit.com");
    const r = await robots();
    expect(r.rules).toEqual([{ userAgent: "*", disallow: "/" }]);
    expect(r.sitemap).toBeUndefined();
  });

  it("disallows everything when PRODUCTION_ORIGIN is unset (safe default)", async () => {
    process.env.APP_ORIGIN = "https://bootsnbandit.com";
    delete process.env.PRODUCTION_ORIGIN;
    const r = await robots();
    expect(r.rules).toEqual([{ userAgent: "*", disallow: "/" }]);
  });

  it("never mentions the old .co.uk domain", async () => {
    delete process.env.APP_ORIGIN;
    delete process.env.PRODUCTION_ORIGIN;
    expect(JSON.stringify(await robots())).not.toContain("co.uk");
  });
});
