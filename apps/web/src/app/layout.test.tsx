import { describe, expect, it, vi } from "vitest";

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

describe("web RootLayout metadata", () => {
  it("declares the public site title + description", async () => {
    const mod = await import("./layout");
    expect(mod.metadata.title).toContain("Boots 'n' Bandit");
    expect(typeof mod.metadata.description).toBe("string");
  });

  it("does NOT ship the staff PWA manifest (admin-only)", async () => {
    const mod = await import("./layout");
    expect(mod.metadata.manifest).toBeUndefined();
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
