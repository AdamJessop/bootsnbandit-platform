import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("./aftercare.module.css", () => ({ default: {} }));

import { HealingTracker } from "./HealingTracker";

const STAGES = [
  {
    order: 0,
    title: "Day 1–2 · Fresh & wrapped",
    body: "Keep the wrap on.",
    hue: "crimson",
  },
  { order: 1, title: "Day 3–6 · Settling in", body: "Thin balm.", hue: "gold" },
  {
    order: 2,
    title: "Day 7–14 · The itchy peel",
    body: "Do not pick.",
    hue: "teal",
  },
  {
    order: 3,
    title: "Day 15–30 · Almost there",
    body: "Moisturise.",
    hue: "moss",
  },
  { order: 4, title: "Day 30+ · Healed", body: "SPF forever.", hue: "gold" },
];

describe("HealingTracker", () => {
  it("renders all five stages and a day input", () => {
    const html = renderToStaticMarkup(<HealingTracker stages={STAGES} />);
    expect(html).toContain("Fresh &amp; wrapped");
    expect(html).toContain("Healed");
    expect(html).toContain("Days since");
  });
});
