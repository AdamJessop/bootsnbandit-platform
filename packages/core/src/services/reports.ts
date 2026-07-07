import type { BookingStatus } from "@prisma/client";
import { differenceInCalendarDays } from "date-fns";
import { prisma } from "@bnb/core/db";

/**
 * Reports — bookings count, capacity/utilisation %, revenue (pence) for a date
 * range, broken down per artist (BACKOFHOUSE-IA I1).
 *
 * - Revenue = sum of completed Sessions' amountChargedPence + tipPence whose
 *   booking falls in range.
 * - Capacity (minutes) = the artist's weekly AvailabilityRule minutes summed
 *   over the matching weekdays in the range. When an artist has no rules we
 *   fall back to a default studio day so utilisation is never divide-by-zero.
 * - Utilisation % = bookedMinutes / capacityMinutes, clamped to [0, 100].
 */

const ACTIVE_FOR_BOOKINGS: BookingStatus[] = [
  "enquiry",
  "pending",
  "confirmed",
  "completed",
];

// Fallback when an artist has no availability rules (8h day, Tue–Sat).
const DEFAULT_DAY_MINUTES = 8 * 60;
const DEFAULT_WORKING_WEEKDAYS = new Set([2, 3, 4, 5, 6]); // Tue..Sat

export interface ReportInput {
  from: Date;
  to: Date;
  /** Limit to a single artist (artist self-reports); omit for studio-wide. */
  artistId?: string;
}

export interface ArtistReportRow {
  artistId: string;
  artistName: string;
  bookings: number;
  completed: number;
  revenuePence: number;
  bookedMinutes: number;
  capacityMinutes: number;
  utilisationPct: number;
}

export interface ReportOverview {
  from: Date;
  to: Date;
  totals: {
    bookings: number;
    completed: number;
    revenuePence: number;
    utilisationPct: number;
  };
  perArtist: ArtistReportRow[];
}

function minutesBetween(startHHMM: string, endHHMM: string): number {
  const [sh, sm] = startHHMM.split(":").map(Number);
  const [eh, em] = endHHMM.split(":").map(Number);
  return Math.max(0, eh * 60 + em - (sh * 60 + sm));
}

/** Count occurrences of each weekday (0..6) in the inclusive [from, to] range. */
function weekdayCounts(from: Date, to: Date): Map<number, number> {
  const counts = new Map<number, number>();
  const days = Math.max(0, differenceInCalendarDays(to, from)) + 1;
  const cursor = new Date(from);
  for (let i = 0; i < days; i++) {
    const wd = cursor.getUTCDay();
    counts.set(wd, (counts.get(wd) ?? 0) + 1);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return counts;
}

export async function reportOverview(
  input: ReportInput,
): Promise<ReportOverview> {
  const { from, to, artistId } = input;
  const artistFilter = artistId ? { id: artistId } : {};

  const artists = await prisma.artist.findMany({
    where: artistFilter,
    select: {
      id: true,
      name: true,
      availabilityRules: {
        select: { weekday: true, startTime: true, endTime: true },
      },
    },
  });

  const bookings = await prisma.booking.findMany({
    where: {
      ...(artistId ? { artistId } : {}),
      status: { in: ACTIVE_FOR_BOOKINGS },
      start: { gte: from, lte: to },
    },
    select: {
      artistId: true,
      durationMin: true,
      status: true,
      session: { select: { amountChargedPence: true, tipPence: true } },
    },
  });

  const wdCounts = weekdayCounts(from, to);

  const rows: ArtistReportRow[] = artists.map((artist) => {
    const mine = bookings.filter((b) => b.artistId === artist.id);
    const completed = mine.filter((b) => b.status === "completed");
    const revenuePence = completed.reduce(
      (sum, b) =>
        sum + (b.session?.amountChargedPence ?? 0) + (b.session?.tipPence ?? 0),
      0,
    );
    const bookedMinutes = mine.reduce((sum, b) => sum + b.durationMin, 0);

    // Capacity from availability rules, else default studio days.
    let capacityMinutes = 0;
    if (artist.availabilityRules.length > 0) {
      for (const rule of artist.availabilityRules) {
        capacityMinutes +=
          minutesBetween(rule.startTime, rule.endTime) *
          (wdCounts.get(rule.weekday) ?? 0);
      }
    } else {
      for (const [wd, count] of wdCounts) {
        if (DEFAULT_WORKING_WEEKDAYS.has(wd)) {
          capacityMinutes += DEFAULT_DAY_MINUTES * count;
        }
      }
    }

    const utilisationPct =
      capacityMinutes > 0
        ? Math.min(100, Math.round((bookedMinutes / capacityMinutes) * 100))
        : 0;

    return {
      artistId: artist.id,
      artistName: artist.name,
      bookings: mine.length,
      completed: completed.length,
      revenuePence,
      bookedMinutes,
      capacityMinutes,
      utilisationPct,
    };
  });

  const totalBookings = rows.reduce((s, r) => s + r.bookings, 0);
  const totalCompleted = rows.reduce((s, r) => s + r.completed, 0);
  const totalRevenue = rows.reduce((s, r) => s + r.revenuePence, 0);
  const totalBooked = rows.reduce((s, r) => s + r.bookedMinutes, 0);
  const totalCapacity = rows.reduce((s, r) => s + r.capacityMinutes, 0);

  return {
    from,
    to,
    totals: {
      bookings: totalBookings,
      completed: totalCompleted,
      revenuePence: totalRevenue,
      utilisationPct:
        totalCapacity > 0
          ? Math.min(100, Math.round((totalBooked / totalCapacity) * 100))
          : 0,
    },
    perArtist: rows,
  };
}
