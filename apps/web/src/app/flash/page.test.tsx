import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

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
      deadline: "Sat 7 Jun",
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
      deadline: "Sat 7 Jun",
      status: "claimed",
    },
  ]),
}));

vi.mock("./flash.module.css", () => ({ default: {} }));

describe("FlashPage", () => {
  it("groups by deadline, shows price, stock and claim CTA", async () => {
    const { default: FlashPage } = await import("./page");
    const html = renderToStaticMarkup(await FlashPage());
    expect(html).toContain("Pearl Shell");
    expect(html).toContain("£130");
    expect(html).toContain("Sat 7 Jun");
    expect(html).toContain("2 of 3 left");
    expect(html).toContain("All claimed");
    expect(html).toContain("/enquire?flash=f1");
  });

  it("derives the drop banner from the data and renders CMS images", async () => {
    const { default: FlashPage } = await import("./page");
    const html = renderToStaticMarkup(await FlashPage());
    expect(html).toContain("Next drop closes Sat 7 Jun");
    expect(html).not.toContain("Saturday 7 June"); // old hardcoded date
    expect(html).toContain('src="/uploads/flash/pearl.jpg"');
  });
});
