import { describe, expect, it } from "vitest";
import {
  GRID_START_HOUR,
  GRID_END_HOUR,
  SLOT_MINUTES,
  applyDragDelta,
  artistTone,
  blockTone,
  eventBox,
  gridHeightPx,
  gridMinutes,
  isSameDay,
  isWorkingDay,
  minutesFromGridTop,
  pxToSlotStart,
  slotLabels,
  snapMinutes,
  weekDays,
} from "./calendar-layout";

const at = (h: number, m = 0) => {
  const d = new Date(2026, 5, 16); // Tue 16 Jun 2026
  d.setHours(h, m, 0, 0);
  return d;
};

describe("grid geometry", () => {
  it("spans the studio window 10:00-18:00", () => {
    expect(GRID_START_HOUR).toBe(10);
    expect(GRID_END_HOUR).toBe(18);
    expect(gridMinutes()).toBe(480);
    expect(gridHeightPx()).toBe(480);
  });

  it("labels every hour boundary inclusive", () => {
    const labels = slotLabels();
    expect(labels[0]).toBe("10:00");
    expect(labels.at(-1)).toBe("18:00");
    expect(labels).toHaveLength(9);
  });

  it("minutesFromGridTop is 0 at open and 480 at close", () => {
    expect(minutesFromGridTop(at(10, 0))).toBe(0);
    expect(minutesFromGridTop(at(11, 30))).toBe(90);
    expect(minutesFromGridTop(at(18, 0))).toBe(480);
  });
});

describe("eventBox", () => {
  it("positions a mid-day booking", () => {
    const box = eventBox(at(12, 0), at(13, 30));
    expect(box.topPx).toBe(120);
    expect(box.heightPx).toBe(90);
  });

  it("clamps an event ending after close", () => {
    const box = eventBox(at(17, 30), at(19, 0));
    expect(box.topPx).toBe(450);
    expect(box.heightPx).toBe(30); // clamped to close, min one slot
  });

  it("enforces a minimum height of one slot", () => {
    const box = eventBox(at(12, 0), at(12, 10));
    expect(box.heightPx).toBe(SLOT_MINUTES);
  });
});

describe("snapping + pixel conversion", () => {
  it("snaps to the nearest 30-minute slot", () => {
    expect(snapMinutes(20)).toBe(30);
    expect(snapMinutes(10)).toBe(0);
    expect(snapMinutes(44)).toBe(30);
  });

  it("pxToSlotStart yields a snapped start on the column day", () => {
    const start = pxToSlotStart(95, at(0)); // ~95min -> snap 90 -> 11:30
    expect(start.getHours()).toBe(11);
    expect(start.getMinutes()).toBe(30);
  });

  it("pxToSlotStart clamps below the close boundary", () => {
    const start = pxToSlotStart(100000, at(0));
    expect(minutesFromGridTop(start)).toBe(gridMinutes() - SLOT_MINUTES);
  });
});

describe("applyDragDelta", () => {
  it("preserves duration and snaps the move", () => {
    const { start, end } = applyDragDelta(at(12, 0), at(13, 0), 35);
    expect(start.getHours()).toBe(12);
    expect(start.getMinutes()).toBe(30); // +35 snapped to +30
    expect((end.getTime() - start.getTime()) / 60000).toBe(60);
  });

  it("clamps so the event stays inside the window", () => {
    const { start, end } = applyDragDelta(at(17, 0), at(18, 0), 600);
    expect(minutesFromGridTop(end)).toBeLessThanOrEqual(gridMinutes());
    expect(minutesFromGridTop(start)).toBeGreaterThanOrEqual(0);
  });
});

describe("calendar dates", () => {
  it("recognises Tue-Sat as working days", () => {
    expect(isWorkingDay(new Date(2026, 5, 16))).toBe(true); // Tue
    expect(isWorkingDay(new Date(2026, 5, 15))).toBe(false); // Mon
    expect(isWorkingDay(new Date(2026, 5, 14))).toBe(false); // Sun
  });

  it("weekDays returns Sun..Sat", () => {
    const days = weekDays(new Date(2026, 5, 16));
    expect(days).toHaveLength(7);
    expect(days[0].getDay()).toBe(0);
    expect(days[6].getDay()).toBe(6);
  });

  it("isSameDay compares calendar day", () => {
    expect(isSameDay(at(10), at(17))).toBe(true);
    expect(isSameDay(at(10), new Date(2026, 5, 17))).toBe(false);
  });
});

describe("blockTone", () => {
  it("maps status/type to heritage tones", () => {
    expect(blockTone("session", "confirmed")).toBe("crimson");
    expect(blockTone("consult", "pending")).toBe("gold");
    expect(blockTone("flash", "pending")).toBe("crimson");
    expect(blockTone("session", "completed")).toBe("teal");
    expect(blockTone("session", "cancelled")).toBe("muted");
    expect(blockTone("session", "no_show")).toBe("muted");
  });
});

describe("artistTone", () => {
  const SEED_HUES = [
    "crimson",
    "ink",
    "teal",
    "rust",
    "plum",
    "gold",
    "steel",
  ] as const;

  it("maps every known seed hue to a block + swatch class pair", () => {
    for (const hue of SEED_HUES) {
      const tone = artistTone(hue, 0);
      expect(tone.block).toBeTruthy();
      expect(tone.swatch).toBeTruthy();
    }
  });

  it("known hues are colour-faithful (brand token in the class string)", () => {
    expect(artistTone("crimson", 5).block).toContain("bb-crimson");
    expect(artistTone("gold", 5).block).toContain("bb-gold");
    expect(artistTone("teal", 5).block).toContain("bb-teal");
  });

  it("seed hues are pairwise distinct", () => {
    const blocks = SEED_HUES.map((h) => artistTone(h, 0).block);
    expect(new Set(blocks).size).toBe(SEED_HUES.length);
  });

  it("is deterministic for identical input", () => {
    expect(artistTone("plum", 3)).toEqual(artistTone("plum", 3));
    expect(artistTone(null, 2)).toEqual(artistTone(null, 2));
  });

  it("falls back by index for null/unknown hues, cycling the palette", () => {
    const a = artistTone(null, 0);
    const b = artistTone(null, 1);
    expect(a.block).not.toBe(b.block); // adjacent indices differ
    expect(artistTone("not-a-hue", 0)).toEqual(a); // unknown ≡ null
    // deterministic modulo cycle
    const paletteProbe = Array.from(
      { length: 12 },
      (_, i) => artistTone(null, i).block,
    );
    const cycle = new Set(paletteProbe).size;
    expect(artistTone(null, cycle)).toEqual(artistTone(null, 0));
  });
});
