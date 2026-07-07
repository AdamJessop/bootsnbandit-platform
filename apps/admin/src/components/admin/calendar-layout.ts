/**
 * Pure layout/geometry helpers for CalendarGrid (BACKOFHOUSE-IA C1/C2).
 *
 * Kept framework-free so the grid maths (slot positions, drag snapping,
 * day columns) is unit-testable in a node environment without a DOM.
 *
 * Studio opening: Tue–Sat, 10:00–18:00. The grid renders that window only.
 */

/** Studio day window, in whole hours (10:00 .. 18:00). */
export const GRID_START_HOUR = 10;
export const GRID_END_HOUR = 18;
/** Drag/click snapping granularity, in minutes. */
export const SLOT_MINUTES = 30;
/** Pixels per minute — drives block heights and pointer maths. */
export const PX_PER_MIN = 1;

/** Studio working weekdays (0=Sun .. 6=Sat) → Tue(2)..Sat(6). */
export const WORKING_WEEKDAYS = [2, 3, 4, 5, 6] as const;

export function isWorkingDay(date: Date): boolean {
  return (WORKING_WEEKDAYS as readonly number[]).includes(date.getDay());
}

/** Total minutes in the rendered day window. */
export function gridMinutes(): number {
  return (GRID_END_HOUR - GRID_START_HOUR) * 60;
}

/** Total grid height in px. */
export function gridHeightPx(): number {
  return gridMinutes() * PX_PER_MIN;
}

/** Hour-boundary "HH:MM" labels for the gutter (inclusive of close). */
export function slotLabels(): string[] {
  const labels: string[] = [];
  for (let h = GRID_START_HOUR; h <= GRID_END_HOUR; h++) {
    labels.push(`${String(h).padStart(2, "0")}:00`);
  }
  return labels;
}

/** Minutes from the grid top (GRID_START_HOUR) for a given Date. */
export function minutesFromGridTop(date: Date): number {
  return (date.getHours() - GRID_START_HOUR) * 60 + date.getMinutes();
}

export interface EventBox {
  /** Offset from the top of the day column, px. */
  topPx: number;
  /** Block height, px (clamped to ≥ one slot). */
  heightPx: number;
}

/**
 * Position a [start,end) event within the day window. Events that start before
 * the window are clamped to the top; events ending after are clamped to the
 * bottom. Height is floored at one slot so very short blocks stay tappable.
 */
export function eventBox(start: Date, end: Date): EventBox {
  const gridBottom = gridMinutes();
  const rawTop = minutesFromGridTop(start);
  const rawBottom = minutesFromGridTop(end);
  const top = Math.max(0, Math.min(rawTop, gridBottom));
  const bottom = Math.max(0, Math.min(rawBottom, gridBottom));
  const height = Math.max(0, bottom - top);
  return {
    topPx: top * PX_PER_MIN,
    heightPx: Math.max(SLOT_MINUTES * PX_PER_MIN, height * PX_PER_MIN),
  };
}

/** Snap a minute offset to the nearest slot boundary. */
export function snapMinutes(min: number): number {
  return Math.round(min / SLOT_MINUTES) * SLOT_MINUTES;
}

/**
 * Convert a vertical pixel offset (from the top of a day column) plus the
 * column's date into a snapped Date start. Used by click-to-create and drag.
 */
export function pxToSlotStart(offsetPx: number, dayDate: Date): Date {
  const minutes = snapMinutes(offsetPx / PX_PER_MIN);
  const clamped = Math.max(0, Math.min(minutes, gridMinutes() - SLOT_MINUTES));
  const d = new Date(dayDate);
  d.setHours(GRID_START_HOUR, 0, 0, 0);
  d.setMinutes(d.getMinutes() + clamped);
  return d;
}

/**
 * Given a drag delta in px applied to an existing event, return the new
 * snapped [start,end) preserving duration and clamping inside the window.
 */
export function applyDragDelta(
  start: Date,
  end: Date,
  deltaPx: number,
): { start: Date; end: Date } {
  const durationMin = Math.round((end.getTime() - start.getTime()) / 60000);
  const newTopMin = snapMinutes(
    minutesFromGridTop(start) + deltaPx / PX_PER_MIN,
  );
  const maxTop = Math.max(0, gridMinutes() - durationMin);
  const clampedTop = Math.max(0, Math.min(newTopMin, maxTop));
  const newStart = new Date(start);
  newStart.setHours(GRID_START_HOUR, 0, 0, 0);
  newStart.setMinutes(newStart.getMinutes() + clampedTop);
  const newEnd = new Date(newStart.getTime() + durationMin * 60000);
  return { start: newStart, end: newEnd };
}

/** Same calendar day (local time). */
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** The 7 dates of the week containing `date` (Sun..Sat, midnight). */
export function weekDays(date: Date): Date[] {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

/** Status → heritage colour tone used for the booking block. */
export type BlockTone = "crimson" | "gold" | "teal" | "muted";

export function blockTone(type: string, status?: string): BlockTone {
  if (status === "cancelled" || status === "no_show") return "muted";
  if (status === "completed") return "teal";
  if (type === "consult") return "gold";
  return "crimson"; // session + flash
}

/**
 * Per-artist colour pair for the all-staff overlay: `block` styles an event
 * block (tint bg + border), `swatch` is the solid legend chip.
 */
export interface ArtistTone {
  block: string;
  swatch: string;
}

/** Known Artist.hue tokens (see seed.ts) → heritage/complementary colours. */
const HUE_TONES: Record<string, ArtistTone> = {
  crimson: {
    block: "bg-bb-crimson/20 border-bb-crimson/60 text-text-primary",
    swatch: "bg-bb-crimson",
  },
  gold: {
    block: "bg-bb-gold/20 border-bb-gold/60 text-text-primary",
    swatch: "bg-bb-gold",
  },
  teal: {
    block: "bg-bb-teal/20 border-bb-teal/60 text-text-primary",
    swatch: "bg-bb-teal",
  },
  ink: {
    block: "bg-[#4b5563]/25 border-[#4b5563]/70 text-text-primary",
    swatch: "bg-[#4b5563]",
  },
  rust: {
    block: "bg-[#b7410e]/20 border-[#b7410e]/60 text-text-primary",
    swatch: "bg-[#b7410e]",
  },
  plum: {
    block: "bg-[#8e4585]/20 border-[#8e4585]/60 text-text-primary",
    swatch: "bg-[#8e4585]",
  },
  steel: {
    block: "bg-[#64748b]/20 border-[#64748b]/60 text-text-primary",
    swatch: "bg-[#64748b]",
  },
};

/** Deterministic fallback order for artists without a recognised hue. */
const FALLBACK_ORDER = [
  "crimson",
  "gold",
  "teal",
  "rust",
  "plum",
  "steel",
  "ink",
] as const;

/**
 * Colour for an artist in the all-staff calendar. Known `hue` tokens map to
 * their brand colour; null/unknown hues fall back to a deterministic palette
 * keyed by the artist's index (cycling modulo the palette length).
 */
export function artistTone(hue: string | null, index: number): ArtistTone {
  if (hue && HUE_TONES[hue]) return HUE_TONES[hue];
  return HUE_TONES[FALLBACK_ORDER[Math.abs(index) % FALLBACK_ORDER.length]];
}
