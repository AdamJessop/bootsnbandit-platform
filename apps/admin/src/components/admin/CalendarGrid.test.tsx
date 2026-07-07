import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  CalendarGrid,
  type CalendarEvent,
  type CalendarLeave,
} from "./CalendarGrid";
import { eventBox, weekDays } from "./calendar-layout";

describe("CalendarGrid module", () => {
  it("exports the component", () => {
    expect(typeof CalendarGrid).toBe("function");
  });

  it("week view renders 7 day columns (layout helper contract)", () => {
    const days = weekDays(new Date("2026-06-16"));
    expect(days).toHaveLength(7);
  });

  it("event geometry matches the layout helper used by blocks", () => {
    const ev: CalendarEvent = {
      id: "e1",
      type: "session",
      title: "Sleeve",
      start: new Date(2026, 5, 16, 12, 0).toISOString(),
      end: new Date(2026, 5, 16, 14, 0).toISOString(),
    };
    const box = eventBox(new Date(ev.start), new Date(ev.end));
    expect(box.topPx).toBe(120);
    expect(box.heightPx).toBe(120);
  });
});

// ---- all-staff modes (BACKOFHOUSE Task 5) ----

const TUE = "2026-06-16"; // Tue 16 Jun 2026, working day
const at = (h: number, m = 0) => new Date(2026, 5, 16, h, m).toISOString();

const artists = [
  { id: "a1", name: "Boots", hue: "crimson" },
  { id: "a2", name: "Bandit", hue: "teal" },
  { id: "a3", name: "Mercy", hue: null },
];

const events: CalendarEvent[] = [
  {
    id: "e1",
    type: "session",
    title: "SleevePiece",
    start: at(12),
    end: at(14),
    status: "confirmed",
    artistId: "a1",
  },
  {
    id: "e2",
    type: "consult",
    title: "WalkInChat",
    start: at(11),
    end: at(11, 30),
    status: "pending",
    artistId: "a2",
  },
];

/** The leave-shading gradient uses a 5px stripe; closed-day shading uses 6px. */
const LEAVE_STRIPE = "transparent_5px";

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe("CalendarGrid allStaff day view", () => {
  it("renders one column per artist, headed by the artist name", () => {
    const html = renderToStaticMarkup(
      <CalendarGrid
        artistId="a1"
        view="day"
        date={TUE}
        mode="allStaff"
        artists={artists}
        events={events}
      />,
    );
    for (const a of artists) {
      expect(countOccurrences(html, a.name)).toBe(1);
    }
    // events land in their artist's column (columns render in artists order)
    expect(html.indexOf("SleevePiece")).toBeGreaterThan(html.indexOf("Boots"));
    expect(html.indexOf("SleevePiece")).toBeLessThan(html.indexOf("Bandit"));
    expect(html.indexOf("WalkInChat")).toBeGreaterThan(html.indexOf("Bandit"));
    expect(html.indexOf("WalkInChat")).toBeLessThan(html.indexOf("Mercy"));
  });

  it("shades leave only in the owning artist's column; untagged leave shades all", () => {
    const tagged: CalendarLeave[] = [
      { start: at(10), end: at(18), artistId: "a2" },
    ];
    const taggedHtml = renderToStaticMarkup(
      <CalendarGrid
        artistId="a1"
        view="day"
        date={TUE}
        mode="allStaff"
        artists={artists}
        events={[]}
        leave={tagged}
      />,
    );
    expect(countOccurrences(taggedHtml, LEAVE_STRIPE)).toBe(1);

    const untagged: CalendarLeave[] = [{ start: at(10), end: at(18) }];
    const untaggedHtml = renderToStaticMarkup(
      <CalendarGrid
        artistId="a1"
        view="day"
        date={TUE}
        mode="allStaff"
        artists={artists}
        events={[]}
        leave={untagged}
      />,
    );
    expect(countOccurrences(untaggedHtml, LEAVE_STRIPE)).toBe(3);
  });
});

describe("CalendarGrid allStaff week overlay", () => {
  it("tints blocks per artist and shows the artist name on the block", () => {
    const html = renderToStaticMarkup(
      <CalendarGrid
        artistId="a1"
        view="week"
        date={TUE}
        mode="allStaff"
        artists={artists}
        events={events}
      />,
    );
    // e1 is a confirmed session (status tone crimson) for crimson-hue Boots;
    // e2 is a pending consult (status tone gold) for teal-hue Bandit — the
    // teal tint proves artist colour wins over the status tone in overlay.
    expect(html).toContain("bg-bb-crimson/20");
    expect(html).toContain("bg-bb-teal/20");
    expect(html).not.toContain("bg-bb-gold/20");
    // artist names on the blocks + once more in the legend
    expect(countOccurrences(html, "Boots")).toBe(2);
    expect(countOccurrences(html, "Bandit")).toBe(2);
  });

  it("renders a colour legend listing every artist", () => {
    const html = renderToStaticMarkup(
      <CalendarGrid
        artistId="a1"
        view="week"
        date={TUE}
        mode="allStaff"
        artists={artists}
        events={[]}
      />,
    );
    for (const a of artists) {
      expect(html).toContain(a.name);
    }
    // solid swatches (crimson + teal known hues; Mercy falls back)
    expect(html).toContain("bg-bb-crimson");
    expect(html).toContain("bg-bb-teal");
  });
});

describe("CalendarGrid single mode (unchanged)", () => {
  it("ignores the artists prop: day headers stay day labels, no legend, status tones", () => {
    const html = renderToStaticMarkup(
      <CalendarGrid
        artistId="a1"
        view="week"
        date={TUE}
        artists={artists}
        events={events}
      />,
    );
    // day header, not artist headers
    expect(html).toContain("Tue 16");
    expect(html).not.toContain("Mercy"); // no legend rendered
    // status tones apply: pending consult stays gold, not artist teal
    expect(html).toContain("bg-bb-gold/20");
    expect(html).not.toContain("bg-bb-teal/20");
    // artist names never shown on blocks in single mode
    expect(countOccurrences(html, "Bandit")).toBe(0);
  });
});
