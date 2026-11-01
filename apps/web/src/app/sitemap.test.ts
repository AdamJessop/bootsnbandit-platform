import { afterEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  artist: {
    findMany: vi.fn(async () => [{ slug: "sarah" }, { slug: "calum" }]),
  },
}));
vi.mock("@bnb/core/db", () => ({ prisma }));

const { default: sitemap, dynamic } = await import("./sitemap");

const original = process.env.APP_ORIGIN;
afterEach(() => {
  if (original === undefined) delete process.env.APP_ORIGIN;
  else process.env.APP_ORIGIN = original;
});

describe("public sitemap", () => {
  it("is rendered per request, not prerendered at build", () => {
    expect(dynamic).toBe("force-dynamic");
  });

  it("lists the core public routes under APP_ORIGIN", async () => {
    process.env.APP_ORIGIN = "https://example.test";
    const urls = (await sitemap()).map((e) => e.url);
    expect(urls).toContain("https://example.test");
    expect(urls).toContain("https://example.test/artists");
    expect(urls).toContain("https://example.test/gallery");
    expect(urls).toContain("https://example.test/flash");
    expect(urls).toContain("https://example.test/aftercare");
    expect(urls).toContain("https://example.test/studio");
    expect(urls).toContain("https://example.test/enquire");
    expect(urls).toContain("https://example.test/inkling");
    expect(urls).toContain("https://example.test/account/sign-in");
    expect(urls).toContain("https://example.test/privacy");
    expect(urls).toContain("https://example.test/data-deletion");
  });

  it("includes artist detail pages from the DB", async () => {
    process.env.APP_ORIGIN = "https://example.test";
    const urls = (await sitemap()).map((e) => e.url);
    expect(urls).toContain("https://example.test/artists/sarah");
    expect(urls).toContain("https://example.test/artists/calum");
  });

  it("omits artist pages (but keeps statics) when the DB is unavailable", async () => {
    process.env.APP_ORIGIN = "https://example.test";
    prisma.artist.findMany.mockRejectedValueOnce(new Error("no db"));
    const urls = (await sitemap()).map((e) => e.url);
    expect(urls).toContain("https://example.test/artists");
    expect(urls.some((u) => u.includes("/artists/"))).toBe(false);
  });

  it("leaves out the sign-in-gated passport", async () => {
    process.env.APP_ORIGIN = "https://example.test";
    const urls = (await sitemap()).map((e) => e.url);
    expect(urls).not.toContain("https://example.test/passport");
  });

  it("uses the local dev origin, not a guessed domain, when APP_ORIGIN is unset", async () => {
    delete process.env.APP_ORIGIN;
    const urls = (await sitemap()).map((e) => e.url);
    expect(urls[0]).toBe("http://localhost:3000");
    expect(urls.some((u) => u.includes("co.uk"))).toBe(false);
  });

  it("does not expose staff routes", async () => {
    const urls = (await sitemap()).map((e) => e.url);
    expect(urls.some((u) => u.includes("/admin"))).toBe(false);
  });
});
