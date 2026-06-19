import type { BookingStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { buildArtistCalendar, type FeedBooking } from "@/lib/calendar/ical";

/**
 * GET /api/calendar/<token>.ics — public per-artist iCal subscribe feed (P12).
 *
 * Capability URL: the unguessable `CalendarFeed.token` IS the auth (no session
 * required). The `.ics` suffix is part of the path so calendar apps treat it as
 * a file; we strip it from the param before the token lookup. Returns the
 * artist's upcoming non-cancelled bookings as VEVENTs. Read-only.
 */
export const dynamic = "force-dynamic";

// Statuses that should appear on the feed (cancelled / no_show excluded).
const VISIBLE_STATUSES: BookingStatus[] = [
  "enquiry",
  "pending",
  "confirmed",
  "completed",
];

function firstName(name: string | null | undefined): string | null {
  if (!name) return null;
  return name.trim().split(/\s+/)[0] ?? null;
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ token: string }> },
): Promise<Response> {
  const { token: raw } = await context.params;
  // Accept both `<token>.ics` and a bare `<token>`.
  const token = raw.replace(/\.ics$/i, "");

  const feed = await prisma.calendarFeed.findFirst({
    where: { token, active: true },
    include: { artist: true },
  });

  if (!feed) {
    return new Response("Calendar feed not found", { status: 404 });
  }

  // Upcoming + recent bookings for this artist (read-only snapshot).
  const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30); // last 30 days
  const rows = await prisma.booking.findMany({
    where: {
      artistId: feed.artistId,
      status: { in: VISIBLE_STATUSES },
      start: { gte: since },
    },
    orderBy: { start: "asc" },
    include: { customer: { select: { name: true } } },
  });

  const bookings: FeedBooking[] = rows.map((b) => ({
    id: b.id,
    type: b.type,
    start: b.start,
    end: b.end,
    status: b.status,
    customerFirstName: firstName(b.customer?.name),
    placement: b.placement ?? null,
  }));

  const ics = buildArtistCalendar(feed.artist.name, bookings);

  return new Response(ics, {
    status: 200,
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `inline; filename="${feed.artist.name}.ics"`,
      "cache-control": "public, max-age=300",
    },
  });
}
