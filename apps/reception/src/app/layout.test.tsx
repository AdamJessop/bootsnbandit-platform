import { describe, expect, it, vi } from "vitest";

// next/font/google + the CSS side-effect import don't run in the node test env.
vi.mock("next/font/google", () => ({
  Pirata_One: () => ({ variable: "--font-pirata" }),
  Inter: () => ({ variable: "--font-termina-google" }),
}));
vi.mock("./globals.css", () => ({}));

describe("reception RootLayout metadata", () => {
  it("links the PWA manifest and declares app + icons", async () => {
    const mod = await import("./layout");
    expect(mod.metadata.manifest).toBe("/manifest.webmanifest");
    expect(mod.metadata.applicationName).toBe("Boots 'n' Bandit Front Desk");
    expect(mod.metadata.appleWebApp).toMatchObject({ capable: true });
  });

  it("locks the viewport for a native-feeling kiosk", async () => {
    const mod = await import("./layout");
    expect(mod.viewport).toMatchObject({
      userScalable: false,
      maximumScale: 1,
      viewportFit: "cover",
    });
  });

  it("keeps the kiosk out of search indexes", async () => {
    const mod = await import("./layout");
    expect(mod.metadata.robots).toMatchObject({ index: false, follow: false });
  });
});
