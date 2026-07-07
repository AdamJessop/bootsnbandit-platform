import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CalendarLegend } from "./CalendarLegend";

const artists = [
  { id: "a1", name: "Boots", hue: "crimson" },
  { id: "a2", name: "Bandit", hue: "teal" },
  { id: "a3", name: "Mercy", hue: null },
];

describe("CalendarLegend", () => {
  it("renders a name + colour swatch per artist", () => {
    const html = renderToStaticMarkup(<CalendarLegend artists={artists} />);
    for (const a of artists) {
      expect(html).toContain(a.name);
    }
    expect(html).toContain("bg-bb-crimson");
    expect(html).toContain("bg-bb-teal");
  });

  it("swatch colours follow artistTone order (fallback for null hue)", () => {
    const html = renderToStaticMarkup(<CalendarLegend artists={artists} />);
    // Mercy (index 2, null hue) falls back deterministically — a swatch is
    // still rendered (3 swatch spans total).
    expect(html.split("rounded-sm").length - 1).toBe(3);
  });
});
