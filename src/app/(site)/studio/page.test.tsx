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
    { slug: "sarah", name: "Sarah", status: "CO_OWNER", bio: "Sarah co-founded the studio.", headshot: null, hue: "crimson" },
    { slug: "cal", name: "Calum", status: "CO_OWNER", bio: "The other half.", headshot: null, hue: "ink" },
    { slug: "tom", name: "Tom", status: "APPRENTICE", bio: "Learning the ropes.", headshot: null, hue: "teal" },
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
    // Founders are filtered by CO_OWNER status; the apprentice is excluded and
    // the co-owner status label is rendered.
    expect(html).not.toContain("Tom");
    expect(html).toContain("Co-owner");
    expect(html).toContain("Spotless");
    expect(html).toContain("Gift vouchers");
    expect(html).toContain("google.com/maps");
  });
});
