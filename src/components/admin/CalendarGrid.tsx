/**
 * STUB — Calendar day/week grid (BACKOFHOUSE-IA C1/C2). Wave-4 phase P9 fills
 * in the vertical time grid, drag-to-move/resize and click-empty-to-create.
 * The prop interface below is the stable contract other phases code against.
 */

export type CalendarView = "day" | "week";

export interface CalendarEvent {
  id: string;
  /** Booking type drives the status colour. */
  type: "consult" | "session" | "flash";
  title: string;
  /** ISO start/end timestamps. */
  start: string;
  end: string;
  status?: string;
  customerName?: string;
}

export interface CalendarGridProps {
  /** Artist whose calendar is shown (owner/front-desk can switch). */
  artistId: string;
  view: CalendarView;
  /** Anchor date (ISO, day or week-of). */
  date: string;
  events: CalendarEvent[];
  /** Drag an event to a new slot. */
  onMove?: (eventId: string, start: string, end: string) => void;
  /** Click an empty slot to create a booking. */
  onCreate?: (start: string) => void;
}

export function CalendarGrid({ view, date, events }: CalendarGridProps) {
  return (
    <div className="rounded-lg border border-border-default bg-bg-card p-6 text-text-muted">
      <p className="font-termina text-sm uppercase tracking-wide text-text-primary">
        Calendar · {view} view
      </p>
      <p className="mt-1 text-sm">
        {date} — {events.length} event(s). Grid implementation lands in Phase 9.
      </p>
    </div>
  );
}
