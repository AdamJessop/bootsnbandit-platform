import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("../_data", () => ({
  getSiteSettings: vi.fn(async () => ({
    studioName: "Boots 'n' Bandit Tattoo Studio",
    addressLine: "67 Newcastle Avenue",
    city: "Worksop",
    county: "Nottinghamshire",
    postcode: "S80 1LX",
    hoursText: "Tue–Sat 10am–6pm · Closed Sun & Mon",
    phone: "01909 000 000",
    email: null,
    licensingText: "Licensed by Bassetlaw District Council",
    facebookUrl: "https://facebook.com/test",
    instagramUrl: null,
  })),
  getArtists: vi.fn(async () => [
    { slug: "sarah", name: "Sarah", role: "Co-owner", bio: "Sarah co-founded the studio.", headshot: null, hue: "crimson" },
    { slug: "cal", name: "Calum", role: "Co-owner", bio: "The other half.", headshot: null, hue: "ink" },
  ]),
}));

vi.mock("./studio.module.css", () => ({ default: {} }));

describe("StudioPage", () => {
  it("renders address, hours, founders, values and gift vouchers", async () => {
    const { default: StudioPage } = await import("./page");
    const html = renderToStaticMarkup(await StudioPage());
    expect(html).toContain("67 Newcastle Avenue");
    expect(html).toContain("Tue");
    expect(html).toContain("Sarah");
    expect(html).toContain("Calum");
    expect(html).toContain("Spotless");
    expect(html).toContain("Gift vouchers");
    expect(html).toContain("google.com/maps");
  });
});
