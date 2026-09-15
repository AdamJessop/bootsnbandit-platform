import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("./aftercare.module.css", () => ({
  default: new Proxy({}, { get: (_t, k) => String(k) }),
}));

import { HealingTracker } from "./HealingTracker";

const STAGES = [
  {
    order: 0,
    title: "Day 1–2 · Fresh & wrapped",
    body: "Care: keep the wrap on; pat dry. How it feels: tender and warm.",
    hue: "crimson",
  },
  {
    order: 1,
    title: "Day 3–6 · Settling in",
    body: "Care: thin balm. How it feels: tight.",
    hue: "gold",
  },
  {
    order: 2,
    title: "Day 7–14 · The itchy peel",
    body: "Care: do not pick. How it feels: itchy.",
    hue: "teal",
  },
  {
    order: 3,
    title: "Day 15–30 · Almost there",
    body: "Care: moisturise. How it feels: nearly done.",
    hue: "moss",
  },
  {
    order: 4,
    title: "Day 30+ · Healed",
    body: "Care: SPF forever. How it feels: fully healed.",
    hue: "gold",
  },
];

describe("HealingTracker", () => {
  it("renders a node per stage, the day input, and the active stage detail", () => {
    const html = renderToStaticMarkup(<HealingTracker stages={STAGES} />);
    // Track: one button per stage, labelled by its day range.
    expect(html.match(/aria-pressed/g)).toHaveLength(5);
    expect(html).toContain("Day 1–2");
    expect(html).toContain("Day 30+");
    expect(html).toContain("Days since your tattoo");
    // Default day 2 → first stage is active; its detail is split into
    // care bullets and the "how it feels" column.
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("Fresh &amp; wrapped");
    expect(html).toContain("Keep the wrap on.");
    expect(html).toContain("Pat dry.");
    expect(html).toContain("How it feels");
    expect(html).toContain("Tender and warm.");
    // Other stages' copy is not rendered until selected.
    expect(html).not.toContain("SPF forever");
    // Progress line sits at the start.
    expect(html).toContain("width:0%");
  });

  it("orders nodes by stage order even if the input is unsorted", () => {
    const html = renderToStaticMarkup(
      <HealingTracker stages={[...STAGES].reverse()} />,
    );
    expect(html.indexOf("Day 1–2")).toBeLessThan(html.indexOf("Day 30+"));
  });
});
