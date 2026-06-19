import { endOfDay, startOfDay } from "date-fns";
import { requireRole } from "@bnb/core/auth";
import { prisma } from "@bnb/core/db";
import { Badge } from "@/components/ui/badge";
import { formatPence } from "@/components/admin/money";
import { formatDateTime } from "../_shared/labels";
import { SessionCompleteForm, type PendingSession } from "./SessionCompleteForm";

/**
 * Sessions & Receipts — Today's sessions to complete (BACKOFHOUSE-IA G1/G2).
 * Lists today's confirmed/pending bookings without a completed Session, each
 * with the Complete Session flow. Owners see all artists; artists see self.
 */
export const dynamic = "force-dynamic";

export default async function SessionsPage() {
  const user = await requireRole();
  const owner = user.role === "OWNER";
  const artistId = owner ? undefined : (user.artistId ?? "__none__");

  const now = new Date();

  const bookings = await prisma.booking.findMany({
    where: {
      ...(artistId ? { artistId } : {}),
      status: { in: ["pending", "confirmed"] },
      session: null,
      start: { gte: startOfDay(now), lte: endOfDay(now) },
    },
    orderBy: { start: "asc" },
    include: {
      customer: { select: { name: true } },
      artist: { select: { name: true } },
    },
  });

  const sessions: PendingSession[] = bookings.map((b) => ({
    bookingId: b.id,
    customerName: b.customer.name,
    artistName: b.artist.name,
    startISO: b.start.toISOString(),
    type: b.type,
    priceEstimatePence: b.priceEstimatePence,
  }));

  return (
    <main className="mx-auto max-w-[1000px] px-6 py-10">
      <p className="kicker mb-2">Back of house</p>
      <h1 className="display text-[clamp(24px,4vw,38px)] text-text-primary">
        Today&rsquo;s sessions
      </h1>
      <p className="mt-2 max-w-[60ch] text-sm text-text-muted">
        Confirm the amount charged to send a receipt + aftercare and award a
        Bandit Pass stamp.
      </p>

      <div className="mt-8 space-y-3">
        {sessions.length === 0 ? (
          <div className="rounded-lg border border-border-default bg-bg-card p-8 text-center text-sm text-text-muted">
            Nothing left to complete today.
          </div>
        ) : (
          sessions.map((s) => (
            <div
              key={s.bookingId}
              className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border-default bg-bg-card px-5 py-4"
            >
              <div>
                <p className="font-medium text-text-primary">{s.customerName}</p>
                <p className="text-sm text-text-muted">
                  <Badge variant="outline" className="mr-2 capitalize">
                    {s.type}
                  </Badge>
                  {s.artistName} · {formatDateTime(s.startISO)}
                </p>
              </div>
              <div className="flex items-center gap-4">
                {s.priceEstimatePence != null && (
                  <span className="tabular-nums text-sm text-text-muted">
                    est. {formatPence(s.priceEstimatePence)}
                  </span>
                )}
                <SessionCompleteForm session={s} />
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
