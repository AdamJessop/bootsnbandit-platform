import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { BookingsTable, type BookingRow } from "./BookingsTable";

/**
 * Bookings — list/search all appointments (BACKOFHOUSE-IA Bookings). Owners see
 * every artist; artists are self-scoped (mirrors /api/bookings GET).
 */
export const dynamic = "force-dynamic";

export default async function BookingsPage() {
  const user = await requireRole();
  const owner = user.role === "OWNER";
  const artistId = owner ? undefined : (user.artistId ?? "__none__");

  const bookings = await prisma.booking.findMany({
    where: artistId ? { artistId } : {},
    orderBy: { start: "desc" },
    take: 500,
    include: {
      customer: { select: { name: true } },
      artist: { select: { name: true } },
    },
  });

  const rows: BookingRow[] = bookings.map((b) => ({
    id: b.id,
    customerName: b.customer.name,
    artistName: b.artist.name,
    type: b.type,
    status: b.status,
    startISO: b.start.toISOString(),
    priceEstimatePence: b.priceEstimatePence,
  }));

  return (
    <main className="mx-auto max-w-[1200px] px-6 py-10">
      <p className="kicker mb-2">Back of house</p>
      <h1 className="display text-[clamp(24px,4vw,38px)] text-text-primary">
        Bookings
      </h1>
      <p className="mt-2 max-w-[60ch] text-sm text-text-muted">
        {owner
          ? "Every appointment across the studio."
          : "Your appointments."}{" "}
        Filter, search, and export.
      </p>
      <div className="mt-8">
        <BookingsTable rows={rows} />
      </div>
    </main>
  );
}
