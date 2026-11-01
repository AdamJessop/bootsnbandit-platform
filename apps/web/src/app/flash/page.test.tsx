import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const FUTURE = new Date("2099-11-14T18:00:00Z");
const PAST = new Date("2020-06-07T18:00:00Z");

vi.mock("../_data", () => ({
  getFlash: vi.fn(async () => [
    {
      id: "f1",
      title: "Pearl Shell",
      artistName: "Amy",
      image: "/uploads/flash/pearl.jpg",
      hue: "teal",
      size: "~11cm",
      pricePence: 13000,
      total: 3,
      claimed: 1,
      endsAt: FUTURE,
      status: "available",
    },
    {
      id: "f2",
      title: "Tribal Turtle",
      artistName: "Holly",
      image: null,
      hue: "ink",
      size: "~10cm",
      pricePence: 14000,
      total: 3,
      claimed: 3,
      endsAt: FUTURE,
      status: "claimed",
    },
    {
      id: "f3",
      title: "Expired Moth",
      artistName: "Holly",
      image: null,
      hue: "ink",
      size: "~8cm",
      pricePence: 9000,
      total: 2,
      claimed: 0,
      endsAt: PAST,
      status: "available",
    },
  ]),
  getSiteSettings: vi.fn(async () => ({ enquiriesOpen: true })),
}));

vi.mock("./flash.module.css", () => ({ default: {} }));

describe("FlashPage", () => {
  it("groups by closing date, shows price, stock and claim CTA", async () => {
    const { default: FlashPage } = await import("./page");
    const html = renderToStaticMarkup(await FlashPage());
    expect(html).toContain("Pearl Shell");
    expect(html).toContain("£130");
    expect(html).toContain("Live until Sat 14 Nov, 6pm");
    expect(html).toContain("2 of 3 left");
    expect(html).toContain("All claimed");
    expect(html).toContain("/enquire?flash=f1");
    // Only the unclaimed design counts as available.
    expect(html).toContain("1 available");
  });

  it("takes expired drops off the wall entirely", async () => {
    const { default: FlashPage } = await import("./page");
    const html = renderToStaticMarkup(await FlashPage());
    expect(html).not.toContain("Expired Moth");
    expect(html).not.toContain("Sun 7 Jun");
  });

  it("derives the drop banner from the data and renders CMS images", async () => {
    const { default: FlashPage } = await import("./page");
    const html = renderToStaticMarkup(await FlashPage());
    expect(html).toContain("Next drop closes Sat 14 Nov, 6pm");
    expect(html).not.toContain("every Friday");
    expect(html).toContain('src="/uploads/flash/pearl.jpg"');
    expect(html).toContain('alt="Pearl Shell"');
    expect(html).toContain('loading="lazy"');
  });

  it("never prints 'Live until' for designs with no closing date", async () => {
    const data = await import("../_data");
    vi.mocked(data.getFlash).mockResolvedValueOnce([
      {
        id: "f9",
        title: "Open Swallow",
        artistName: null,
        image: null,
        hue: null,
        size: null,
        pricePence: 8000,
        total: 1,
        claimed: 0,
        endsAt: null,
        status: "available",
      },
    ]);
    const { default: FlashPage } = await import("./page");
    const html = renderToStaticMarkup(await FlashPage());
    expect(html).toContain("Open Swallow");
    expect(html).not.toContain("Live until");
    expect(html).not.toContain("Next drop closes");
  });

  it("pauses claims while the studio's enquiries switch is off", async () => {
    const data = await import("../_data");
    vi.mocked(data.getSiteSettings).mockResolvedValueOnce({
      enquiriesOpen: false,
    } as never);
    const { default: FlashPage } = await import("./page");
    const html = renderToStaticMarkup(await FlashPage());
    expect(html).toContain("flash claims are paused");
    expect(html).toContain("Claims paused");
    expect(html).not.toContain("/enquire?flash=f1");
  });

  it("shows an empty state when nothing is live", async () => {
    const data = await import("../_data");
    vi.mocked(data.getFlash).mockResolvedValueOnce([]);
    const { default: FlashPage } = await import("./page");
    const html = renderToStaticMarkup(await FlashPage());
    expect(html).toContain("No flash on the wall right now");
  });
});

describe("Flash metadata", () => {
  it("has a canonical URL and shares the first live design's photo", async () => {
    const { generateMetadata } = await import("./page");
    const m = await generateMetadata();
    expect(m.alternates?.canonical).toBe("/flash");
    expect(m.openGraph?.images).toEqual([
      { url: "/uploads/flash/pearl.jpg", alt: "Pearl Shell" },
    ]);
  });
});
