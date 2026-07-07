import { endOfDay, startOfDay } from "date-fns";
import { requireRole } from "@bnb/core/auth";
import { prisma } from "@bnb/core/db";
import { Badge } from "@/components/ui/badge";
import { formatPence } from "@/components/admin/money";
import { formatDateTime } from "../_shared/labels";
import { CompletedSessionsList } from "./CompletedSessionsList";
import type { CompletedSessionRow } from "./receipt-resend";
import {
  SessionCompleteForm,
  type PendingSession,
} from "./SessionCompleteForm";

/**
 * Sessions & Receipts (BACKOFHOUSE-IA G1–G3). Today's confirmed/pending
 * bookings without a completed Session (Complete Session flow), plus recent
 * completed sessions with a "Resend receipt" action. Owners see all artists;
 * artists see self.
 */
export const dynamic = "force-dynamic";

export default async function SessionsPage() {
  const user = await requireRole();
  const owner = user.role === "OWNER";
  const artistId = owner ? undefined : (user.artistId ?? "__none__");

  const now = new Date();

  const [bookings, completedSessions] = await Promise.all([
    prisma.booking.findMany({
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
    }),
    prisma.session.findMany({
      where: artistId ? { booking: { artistId } } : {},
      orderBy: { completedAt: "desc" },
      take: 50,
      include: {
        booking: {
          select: {
            customer: { select: { name: true } },
            artist: { select: { name: true } },
          },
        },
      },
    }),
  ]);

  const sessions: PendingSession[] = bookings.map((b) => ({
    bookingId: b.id,
    customerName: b.customer.name,
    artistName: b.artist.name,
    startISO: b.start.toISOString(),
    type: b.type,
    priceEstimatePence: b.priceEstimatePence,
  }));

  const completed: CompletedSessionRow[] = completedSessions.map((s) => ({
    sessionId: s.id,
    customerName: s.booking.customer.name,
    artistName: s.booking.artist.name,
    completedAtISO: s.completedAt.toISOString(),
    amountChargedPence: s.amountChargedPence,
    tipPence: s.tipPence,
    receiptSentAtISO: s.receiptSentAt?.toISOString() ?? null,
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
                <p className="font-medium text-text-primary">
                  {s.customerName}
                </p>
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

      <section className="mt-12">
        <h2 className="mb-1 font-termina text-sm uppercase tracking-wide text-text-secondary">
          Completed
        </h2>
        <p className="mb-4 text-sm text-text-muted">
          Recent completed sessions — view or re-send a receipt.
        </p>
        <CompletedSessionsList rows={completed} />
      </section>
    </main>
  );
}
