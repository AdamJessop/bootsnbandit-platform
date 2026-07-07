import { endOfDay, format, startOfDay, subDays } from "date-fns";
import { requireRole } from "@bnb/core/auth";
import { prisma } from "@bnb/core/db";
import { reportOverview } from "@bnb/core/services/reports";
import {
  bookingsByStatusData,
  capacityByArtistData,
  revenueTrendData,
  styleMixData,
  type RawBooking,
  type ReportCsvRow,
} from "./report-data";
import { ReportsView } from "./ReportsView";

/**
 * Reports (BACKOFHOUSE-IA I1). Date range + per-artist (owner) or self
 * (artist) bookings / capacity / revenue, with charts and CSV. Range comes
 * from searchParams so it is shareable and drives a server re-query.
 */
export const dynamic = "force-dynamic";

function parseDate(value: string | undefined, fallback: Date): Date {
  if (!value) return fallback;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? fallback : d;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole();
  const owner = user.role === "OWNER";
  const sp = await searchParams;

  const fromDate = startOfDay(
    parseDate(sp.from as string | undefined, subDays(new Date(), 30)),
  );
  const toDate = endOfDay(parseDate(sp.to as string | undefined, new Date()));

  // Scope: owners may pick an artist; artists are forced to self.
  const requestedArtist = (sp.artistId as string | undefined) ?? "";
  const scopedArtistId = owner
    ? requestedArtist || undefined
    : (user.artistId ?? "__none__");

  const [overview, rawBookings, artists] = await Promise.all([
    reportOverview({ from: fromDate, to: toDate, artistId: scopedArtistId }),
    prisma.booking.findMany({
      where: {
        ...(scopedArtistId ? { artistId: scopedArtistId } : {}),
        start: { gte: fromDate, lte: toDate },
      },
      select: {
        status: true,
        style: true,
        start: true,
        artist: { select: { name: true } },
        session: { select: { amountChargedPence: true, tipPence: true } },
      },
    }),
    owner
      ? prisma.artist.findMany({
          where: { active: true },
          orderBy: { sortOrder: "asc" },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
  ]);

  const bookings: RawBooking[] = rawBookings.map((b) => ({
    artistName: b.artist.name,
    status: b.status,
    style: b.style,
    startISO: b.start.toISOString(),
    revenuePence:
      b.status === "completed"
        ? (b.session?.amountChargedPence ?? 0) + (b.session?.tipPence ?? 0)
        : 0,
  }));

  // Revenue trend uses only completed bookings.
  const completed = bookings.filter(
    (b) => b.revenuePence > 0 || b.status === "completed",
  );

  const csvRows: ReportCsvRow[] = overview.perArtist.map((r) => ({
    artistName: r.artistName,
    bookings: r.bookings,
    completed: r.completed,
    revenuePence: r.revenuePence,
    utilisationPct: r.utilisationPct,
  }));

  return (
    <main className="mx-auto max-w-[1200px] px-6 py-10">
      <p className="kicker mb-2">Back of house</p>
      <h1 className="display text-[clamp(24px,4vw,38px)] text-text-primary">
        Reports
      </h1>
      <p className="mt-2 max-w-[60ch] text-sm text-text-muted">
        {owner
          ? "Bookings, capacity and revenue across the studio."
          : "Your bookings, capacity and revenue."}
      </p>
      <div className="mt-8">
        <ReportsView
          from={format(fromDate, "yyyy-MM-dd")}
          to={format(toDate, "yyyy-MM-dd")}
          artistId={owner ? requestedArtist : ""}
          artists={artists}
          canChooseArtist={owner}
          totals={overview.totals}
          revenueTrend={revenueTrendData(completed)}
          bookingsByStatus={bookingsByStatusData(bookings)}
          capacityByArtist={capacityByArtistData(
            overview.perArtist.map((r) => ({
              artistName: r.artistName,
              bookedMinutes: r.bookedMinutes,
              capacityMinutes: r.capacityMinutes,
            })),
          )}
          styleMix={styleMixData(bookings)}
          csvRows={csvRows}
        />
      </div>
    </main>
  );
}
