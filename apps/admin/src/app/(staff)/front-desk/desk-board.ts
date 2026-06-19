/**
 * Client-safe front-desk board types + pure helpers (BACKOFHOUSE-IA D). Kept
 * free of prisma so the FrontDeskClient island can import them without dragging
 * the database adapter into the browser bundle. The server loader lives in
 * ./data and re-exports these.
 */

export interface DeskBooking {
  id: string;
  start: string;
  end: string;
  type: string;
  status: string;
  customerName: string;
}

export interface DeskArtist {
  id: string;
  name: string;
  onLeave: boolean;
  bookings: DeskBooking[];
}

/** Booking the artist is mid-session on (start ≤ now < end), if any. */
export function currentBooking(
  bookings: DeskBooking[],
  now: Date,
): DeskBooking | null {
  const t = now.getTime();
  return (
    bookings.find(
      (b) => new Date(b.start).getTime() <= t && t < new Date(b.end).getTime(),
    ) ?? null
  );
}

/** Earliest booking starting after `now`, if any. */
export function nextBooking(
  bookings: DeskBooking[],
  now: Date,
): DeskBooking | null {
  const t = now.getTime();
  const upcoming = bookings
    .filter((b) => new Date(b.start).getTime() > t)
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  return upcoming[0] ?? null;
}
