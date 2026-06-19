import { prisma } from "@bnb/core/db";
import { listBookings } from "@bnb/core/services/bookings";
import { listLeave } from "@bnb/core/services/leave";
import type { SessionUser } from "@bnb/core/auth";
import type {
  CalendarEvent,
  CalendarLeave,
} from "@/components/admin/CalendarGrid";
import type { NamedOption } from "@/components/admin/BookingDrawer";

/**
 * Server data loaders shared by the Phase-9 admin surfaces (calendar, front
 * desk, today). Reads go straight through prisma / the Phase-6 services and
 * apply the same owner-vs-artist scoping as the API: owners see every artist,
 * artists are pinned to their own `artistId`.
 */

export interface ArtistLite {
  id: string;
  name: string;
  hue: string | null;
  booksStatus: string;
  /** Numeric rates feed the booking-drawer price suggestion. */
  hourlyRatePence: number | null;
  dayRatePence: number | null;
}

/** Artists the signed-in user may view/switch between. */
export async function loadArtistsForUser(
  user: SessionUser,
): Promise<ArtistLite[]> {
  const where =
    user.role === "OWNER" ? {} : { id: user.artistId ?? "__none__" };
  const artists = await prisma.artist.findMany({
    where,
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      hue: true,
      booksStatus: true,
      hourlyRatePence: true,
      dayRatePence: true,
    },
  });
  return artists.map((a) => ({
    id: a.id,
    name: a.name,
    hue: a.hue,
    booksStatus: a.booksStatus,
    hourlyRatePence: a.hourlyRatePence,
    dayRatePence: a.dayRatePence,
  }));
}

/** Resolve the artist whose calendar should show first. */
export function resolveActiveArtist(
  user: SessionUser,
  artists: ArtistLite[],
  requested?: string,
): string | undefined {
  if (user.role !== "OWNER") return user.artistId ?? artists[0]?.id;
  if (requested && artists.some((a) => a.id === requested)) return requested;
  return artists[0]?.id;
}

function dayWindow(date: Date): { from: Date; to: Date } {
  const from = new Date(date);
  from.setHours(0, 0, 0, 0);
  const to = new Date(date);
  to.setHours(23, 59, 59, 999);
  return { from, to };
}

function rangeWindow(
  anchor: Date,
  view: "day" | "week",
): { from: Date; to: Date } {
  if (view === "day") return dayWindow(anchor);
  const from = new Date(anchor);
  from.setDate(from.getDate() - from.getDay());
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(from.getDate() + 6);
  to.setHours(23, 59, 59, 999);
  return { from, to };
}

export interface CalendarData {
  events: CalendarEvent[];
  leave: CalendarLeave[];
}

/** Bookings + approved leave for one artist over the visible window. */
export async function loadCalendarData(
  artistId: string,
  anchor: Date,
  view: "day" | "week",
): Promise<CalendarData> {
  const { from, to } = rangeWindow(anchor, view);
  const [bookings, leave, customers] = await Promise.all([
    listBookings({ artistId, from, to }),
    listLeave({ artistId, status: "approved", from, to }),
    prisma.customer.findMany({ select: { id: true, name: true } }),
  ]);
  const nameById = new Map(customers.map((c) => [c.id, c.name]));
  return {
    events: bookings.map((b) => ({
      id: b.id,
      type: b.type,
      title: b.style ?? b.type,
      start: b.start.toISOString(),
      end: b.end.toISOString(),
      status: b.status,
      customerName: nameById.get(b.customerId),
    })),
    leave: leave.map((l) => ({
      start: l.startDate.toISOString(),
      end: l.endDate.toISOString(),
    })),
  };
}

/** Customer directory for the booking drawer picker. */
export async function loadCustomerOptions(): Promise<NamedOption[]> {
  const customers = await prisma.customer.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
    take: 500,
  });
  return customers;
}
