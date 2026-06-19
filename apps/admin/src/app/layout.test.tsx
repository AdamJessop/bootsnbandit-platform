import { describe, expect, it, vi } from "vitest";

// next/font/google + the CSS side-effect import don't run in the node test env.
vi.mock("next/font/google", () => ({
  Pirata_One: () => ({ variable: "--font-pirata" }),
  Cinzel: () => ({ variable: "--font-cinzel-google" }),
  Inter: () => ({ variable: "--font-termina-google" }),
}));
vi.mock("./globals.css", () => ({}));

describe("admin RootLayout metadata", () => {
  it("links the PWA manifest and declares app + icons", async () => {
    const mod = await import("./layout");
    expect(mod.metadata.manifest).toBe("/manifest.webmanifest");
    expect(mod.metadata.applicationName).toBe("Boots 'n' Bandit Studio");
    expect(mod.metadata.appleWebApp).toMatchObject({ capable: true });
  });

  it("sets the heritage theme color in the viewport", async () => {
    const mod = await import("./layout");
    expect(mod.viewport.themeColor).toBe("#c92f4d");
  });

  it("keeps the staff PWA out of search indexes", async () => {
    const mod = await import("./layout");
    expect(mod.metadata.robots).toMatchObject({ index: false, follow: false });
  });
});
