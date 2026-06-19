import type { CalendarView } from "@/components/admin/CalendarGrid";

/** Step the calendar anchor forward/back by one day or week. */
export function shiftAnchor(
  iso: string,
  view: CalendarView,
  dir: number,
): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + dir * (view === "week" ? 7 : 1));
  return d.toISOString();
}
