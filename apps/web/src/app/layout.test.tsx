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
vi.mock("@/components/site/Ticker", () => ({ Ticker: () => null }));
vi.mock("@/components/site/Footer", () => ({ Footer: () => null }));

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
});
