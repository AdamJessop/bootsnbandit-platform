import { describe, expect, it } from "vitest";
import { CalendarGrid, type CalendarEvent } from "./CalendarGrid";
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
