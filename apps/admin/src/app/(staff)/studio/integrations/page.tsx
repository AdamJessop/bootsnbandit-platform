import {
  CheckCircle2,
  XCircle,
  CalendarClock,
  Mail,
  Calendar,
} from "lucide-react";
import { requireRole } from "@bnb/core/auth";
import { prisma } from "@bnb/core/db";

/**
 * Studio › Integrations (K4). Owner-only. Shows per-artist iCal feed status
 * (the feed endpoint itself ships in P12) and the Resend email status derived
 * from env configuration. Google Calendar sync isn't built yet: it is shown as
 * "Planned" with no Connect button, so nobody clicks into a dead end. The
 * connect link (and /api/integrations/google) stay in place behind
 * `GOOGLE_CALENDAR_READY` for when it ships.
 */
export const dynamic = "force-dynamic";

const GOOGLE_CALENDAR_READY = false;

export default async function IntegrationsPage() {
  await requireRole("OWNER");

  const artists = await prisma.artist.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      calendarFeed: { select: { active: true } },
    },
  });

  const resendConfigured = Boolean(process.env.RESEND_API_KEY?.trim());

  return (
    <main className="mx-auto max-w-[1100px] px-7 py-10">
      <p className="kicker mb-2">Studio</p>
      <h1 className="display text-[clamp(24px,4vw,36px)] text-text-primary">
        Integrations
      </h1>
      <p className="mt-2 mb-6 text-text-muted">
        Calendar feeds and email delivery.
      </p>

      <section className="mb-8 rounded-lg border border-border-default bg-bg-card p-5">
        <h2 className="mb-3 flex items-center gap-2 font-termina text-sm font-bold uppercase tracking-wide text-text-primary">
          <Mail className="h-4 w-4" /> Resend (email)
        </h2>
        <p className="flex items-center gap-2 text-sm">
          {resendConfigured ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-bb-teal" />
              <span className="text-text-secondary">
                Connected — live sends enabled.
              </span>
            </>
          ) : (
            <>
              <XCircle className="h-4 w-4 text-bb-gold" />
              <span className="text-text-secondary">
                No API key — emails are logged only (dev mode).
              </span>
            </>
          )}
        </p>
      </section>

      <section className="rounded-lg border border-border-default bg-bg-card p-5">
        <h2 className="mb-3 flex items-center gap-2 font-termina text-sm font-bold uppercase tracking-wide text-text-primary">
          <CalendarClock className="h-4 w-4" /> iCal feeds (per artist)
        </h2>
        <ul className="divide-y divide-border-default">
          {artists.map((a) => {
            const ready = Boolean(a.calendarFeed?.active);
            return (
              <li
                key={a.id}
                className="flex items-center justify-between py-2.5 text-sm"
              >
                <span className="text-text-secondary">{a.name}</span>
                <span className="flex items-center gap-1.5">
                  {ready ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-bb-teal" />
                      <span className="text-text-muted">Feed active</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4 text-bb-gold" />
                      <span className="text-text-muted">No feed yet</span>
                    </>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-xs text-text-muted">
          Each artist&rsquo;s subscribe URL is shown on their My Profile page.
        </p>
      </section>

      <section className="mt-8 rounded-lg border border-dashed border-border-default p-5">
        <h2 className="mb-3 flex items-center gap-2 font-termina text-sm font-bold uppercase tracking-wide text-text-muted">
          <Calendar className="h-4 w-4" /> Google Calendar
          <span className="rounded bg-bg-raised px-1.5 py-0.5 text-[10px] font-normal tracking-wide text-text-muted">
            Planned
          </span>
        </h2>
        <p className="text-sm text-text-muted">
          Not available yet. Planned: two-way sync — studio bookings pushed to
          Google, and outside busy times pulled back into availability. The iCal
          feeds above already put bookings on any phone calendar.
        </p>
        {GOOGLE_CALENDAR_READY && (
          <a
            href="/api/integrations/google"
            className="mt-3 inline-flex h-9 items-center gap-2 rounded-md border border-border-default px-3 text-sm text-text-secondary"
          >
            <Calendar className="h-4 w-4" /> Connect Google Calendar
          </a>
        )}
      </section>
    </main>
  );
}
