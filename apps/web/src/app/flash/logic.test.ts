import { describe, it, expect } from "vitest";
import {
  flashStock,
  formatEndsAt,
  groupByEndsAt,
  isLive,
  liveFlash,
  nextDropEnds,
} from "./logic";

const NOW = new Date("2026-11-10T12:00:00Z");
const SAT_6PM = new Date("2026-11-14T18:00:00Z");
const SUN_EOD = new Date("2026-11-15T23:59:00Z");
const PAST = new Date("2026-11-09T18:00:00Z");

describe("isLive / liveFlash", () => {
  it("keeps open-ended and future drops, hides expired ones", () => {
    expect(isLive({ endsAt: null }, NOW)).toBe(true);
    expect(isLive({ endsAt: SAT_6PM }, NOW)).toBe(true);
    expect(isLive({ endsAt: PAST }, NOW)).toBe(false);
    expect(isLive({ endsAt: NOW }, NOW)).toBe(false);
    const items = [
      { id: "a", endsAt: PAST },
      { id: "b", endsAt: null },
      { id: "c", endsAt: SAT_6PM },
    ];
    expect(liveFlash(items, NOW).map((i) => i.id)).toEqual(["b", "c"]);
  });
});

describe("formatEndsAt", () => {
  it("shows the date alone for an end-of-day close", () => {
    expect(formatEndsAt(SUN_EOD)).toBe("Sun 15 Nov");
  });

  it("adds the studio-time hour otherwise (BST aware)", () => {
    expect(formatEndsAt(SAT_6PM)).toBe("Sat 14 Nov, 6pm");
    expect(formatEndsAt(new Date("2026-06-13T17:30:00Z"))).toBe(
      "Sat 13 Jun, 6:30pm",
    );
  });
});

describe("groupByEndsAt", () => {
  it("groups by closing time, soonest first, open-ended last", () => {
    const groups = groupByEndsAt([
      { id: "a", endsAt: null },
      { id: "b", endsAt: SUN_EOD },
      { id: "c", endsAt: SAT_6PM },
      { id: "d", endsAt: SAT_6PM },
    ]);
    expect(groups.map((g) => g.label)).toEqual([
      "Live until Sat 14 Nov, 6pm",
      "Live until Sun 15 Nov",
      null,
    ]);
    expect(groups[0].items.map((i) => i.id)).toEqual(["c", "d"]);
    expect(groups[2].items.map((i) => i.id)).toEqual(["a"]);
  });

  it("never labels an open-ended group 'Live until'", () => {
    const groups = groupByEndsAt([{ id: "a", endsAt: null }]);
    expect(groups).toEqual([
      { label: null, items: [{ id: "a", endsAt: null }] },
    ]);
  });
});

describe("nextDropEnds", () => {
  it("returns the soonest future end date", () => {
    expect(
      nextDropEnds(
        [{ endsAt: null }, { endsAt: SUN_EOD }, { endsAt: SAT_6PM }],
        NOW,
      ),
    ).toEqual(SAT_6PM);
  });

  it("ignores expired drops and returns null when none are dated (banner hides)", () => {
    expect(nextDropEnds([], NOW)).toBeNull();
    expect(nextDropEnds([{ endsAt: null }, { endsAt: PAST }], NOW)).toBeNull();
  });
});

describe("flashStock", () => {
  it("reports remaining stock", () => {
    expect(flashStock(3, 1)).toEqual({ left: 2, gone: false, low: false });
  });

  it("flags low stock at <=1 remaining", () => {
    expect(flashStock(2, 1)).toEqual({ left: 1, gone: false, low: true });
  });

  it("flags gone when fully claimed", () => {
    expect(flashStock(2, 2)).toEqual({ left: 0, gone: true, low: true });
    expect(flashStock(2, 5)).toEqual({ left: 0, gone: true, low: true });
  });
});
