import { afterEach, describe, expect, it, vi } from "vitest";

// next/font/google + the CSS side-effect imports don't run in the node test env.
vi.mock("next/font/google", () => ({
  Pirata_One: () => ({ variable: "--font-pirata" }),
  Cinzel: () => ({ variable: "--font-cinzel-google" }),
  Inter: () => ({ variable: "--font-termina-google" }),
}));
vi.mock("./globals.css", () => ({}));
vi.mock("./site.css", () => ({}));
// The shell pulls in client components; stub them so the metadata module loads.
vi.mock("@/components/site/Nav", () => ({ Nav: () => null }));
vi.mock("@/components/site/Ticker", () => ({
  Ticker: ({ lines }: { lines?: string[] }) => (
    <div data-ticker>{lines?.join(" | ")}</div>
  ),
}));
vi.mock("@/components/site/Footer", () => ({
  Footer: ({ studio }: { studio?: { address: string } }) => (
    <div data-footer>{studio?.address}</div>
  ),
}));
// The layout queries SiteSettings for the shell (Ticker/Footer); stub the db.
const prisma = vi.hoisted(() => ({
  siteSettings: { findFirst: vi.fn(async () => null) },
}));
vi.mock("@bnb/core/db", () => ({ prisma }));
// Indexing reads the request host; stub next/headers for the node env.
const headerMap = vi.hoisted(() => new Map<string, string>());
vi.mock("next/headers", () => ({
  headers: async () => ({ get: (k: string) => headerMap.get(k) ?? null }),
}));

const env = { ...process.env };
afterEach(() => {
  process.env = { ...env };
  headerMap.clear();
});

describe("web RootLayout metadata", () => {
  it("declares the public site title + description", async () => {
    const m = await (await import("./layout")).generateMetadata();
    expect(m.title).toContain("Boots 'n' Bandit");
    expect(typeof m.description).toBe("string");
  });

  it("does NOT ship the staff PWA manifest (admin-only)", async () => {
    const m = await (await import("./layout")).generateMetadata();
    expect(m.manifest).toBeUndefined();
  });

  it("bases URLs on APP_ORIGIN and ships a branded OG + Twitter card", async () => {
    process.env.APP_ORIGIN = "https://staging.bootsnbandit.com";
    const m = await (await import("./layout")).generateMetadata();
    expect(String(m.metadataBase)).toBe("https://staging.bootsnbandit.com/");
    expect(m.openGraph).toMatchObject({
      siteName: "Boots 'n' Bandit",
      images: [expect.objectContaining({ url: "/opengraph-image" })],
    });
    expect(m.twitter).toMatchObject({ card: "summary_large_image" });
    // No site-wide canonical: each page declares its own.
    expect(m.alternates?.canonical).toBeUndefined();
  });

  it("is noindex on staging and indexable only on the production origin", async () => {
    process.env.PRODUCTION_ORIGIN = "https://bootsnbandit.com";
    process.env.APP_ORIGIN = "https://staging.bootsnbandit.com";
    headerMap.set("host", "staging.bootsnbandit.com");
    const { generateMetadata } = await import("./layout");
    expect((await generateMetadata()).robots).toEqual({
      index: false,
      follow: false,
    });
    process.env.APP_ORIGIN = "https://bootsnbandit.com";
    headerMap.set("host", "bootsnbandit.com");
    expect((await generateMetadata()).robots).toEqual({
      index: true,
      follow: true,
    });
  });

  it("is noindex by default when PRODUCTION_ORIGIN is unset", async () => {
    delete process.env.PRODUCTION_ORIGIN;
    process.env.APP_ORIGIN = "https://bootsnbandit.com";
    const m = await (await import("./layout")).generateMetadata();
    expect(m.robots).toEqual({ index: false, follow: false });
  });

  it("renders a skip-to-content link targeting the main landmark", async () => {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { default: RootLayout } = await import("./layout");
    const html = renderToStaticMarkup(await RootLayout({ children: null }));
    expect(html).toContain('href="#main"');
    expect(html).toContain("Skip to content");
    expect(html).toContain('<main id="main"');
  });

  it("feeds CMS ticker lines + studio details into the shell", async () => {
    const { renderToStaticMarkup } = await import("react-dom/server");
    prisma.siteSettings.findFirst.mockResolvedValueOnce({
      tickerLines: ["Books closed until March"],
      addressLine: "1 New Row",
      city: "Worksop",
      postcode: "S80 9ZZ",
    } as never);
    const { default: RootLayout } = await import("./layout");
    const html = renderToStaticMarkup(await RootLayout({ children: null }));
    expect(html).toContain("Books closed until March");
    expect(html).toContain("1 New Row, Worksop, S80 9ZZ");
  });

  it("falls back to the hardcoded ticker lines when settings are absent", async () => {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { TICKER_LINES } = await import("@/lib/site-nav");
    const { default: RootLayout } = await import("./layout");
    const html = renderToStaticMarkup(await RootLayout({ children: null }));
    expect(html).toContain(TICKER_LINES[0]);
  });
});
