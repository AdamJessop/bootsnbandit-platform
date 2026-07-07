import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("../_data", () => ({
  getAftercareStages: vi.fn(async () => [
    {
      id: "s0",
      order: 0,
      title: "Day 1–2 · Fresh & wrapped",
      body: "Keep wrap on.",
      hue: "crimson",
    },
    {
      id: "s4",
      order: 4,
      title: "Day 30+ · Healed",
      body: "SPF forever.",
      hue: "gold",
    },
  ]),
  getFaqs: vi.fn(async () => [
    { id: "f1", question: "Does it hurt?", answer: "A bit.", sortOrder: 0 },
  ]),
}));

vi.mock("./aftercare.module.css", () => ({ default: {} }));

describe("AftercarePage", () => {
  it("renders tracker stages, do/don't and the FAQ", async () => {
    const { default: AftercarePage } = await import("./page");
    const html = renderToStaticMarkup(await AftercarePage());
    expect(html).toContain("Aftercare");
    expect(html).toContain("Fresh &amp; wrapped");
    expect(html).toContain("Do &amp; don"); // section head "Do & don't"
    expect(html).toContain("Don"); // do/don't cards
    expect(html).toContain("Does it hurt?");
  });
});
