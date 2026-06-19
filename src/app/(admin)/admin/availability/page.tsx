import { requireRole } from "@bnb/core/auth";
import { prisma } from "@bnb/core/db";
import { formatDay, leaveStatusLabel } from "../_shared/labels";
import {
  AvailabilityEditor,
  type AvailabilityArtist,
} from "./AvailabilityEditor";
import type { AvailabilityRule } from "./availability-helpers";

/**
 * Availability & Leave (BACKOFHOUSE-IA H1/H2). Owners pick any artist; artists
 * edit themselves. Shows current declared leave (approved leave blocks the
 * calendar via the leave-aware conflict check).
 */
export const dynamic = "force-dynamic";

export default async function AvailabilityPage() {
  const user = await requireRole();
  const owner = user.role === "OWNER";

  const artists = owner
    ? await prisma.artist.findMany({
        where: { active: true },
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true },
      })
    : user.artistId
      ? await prisma.artist.findMany({
          where: { id: user.artistId },
          select: { id: true, name: true },
        })
      : [];

  const artistOptions: AvailabilityArtist[] = artists;
  const initialArtistId = artistOptions[0]?.id ?? "";

  const [rules, leave] = initialArtistId
    ? await Promise.all([
        prisma.availabilityRule.findMany({
          where: { artistId: initialArtistId },
          orderBy: { weekday: "asc" },
          select: { weekday: true, startTime: true, endTime: true },
        }),
        prisma.leave.findMany({
          where: { artistId: initialArtistId, endDate: { gte: new Date() } },
          orderBy: { startDate: "asc" },
        }),
      ])
    : [[], []];

  return (
    <main className="mx-auto max-w-[900px] px-6 py-10">
      <p className="kicker mb-2">Back of house</p>
      <h1 className="display text-[clamp(24px,4vw,38px)] text-text-primary">
        Availability &amp; leave
      </h1>
      <p className="mt-2 max-w-[60ch] text-sm text-text-muted">
        Set weekly working hours and declare leave. Approved leave blocks new
        bookings and hides you from the front desk.
      </p>

      {initialArtistId === "" ? (
        <div className="mt-8 rounded-lg border border-border-default bg-bg-card p-8 text-center text-sm text-text-muted">
          No artist profile linked to your account.
        </div>
      ) : (
        <>
          <div className="mt-8">
            <AvailabilityEditor
              artists={artistOptions}
              initialArtistId={initialArtistId}
              initialRules={rules as AvailabilityRule[]}
              lockArtist={!owner}
            />
          </div>

          {leave.length > 0 && (
            <section className="mt-8">
              <h2 className="mb-3 font-termina text-xs uppercase tracking-wide text-text-muted">
                Upcoming leave
              </h2>
              <ul className="space-y-2">
                {leave.map((l) => (
                  <li
                    key={l.id}
                    className="flex items-center justify-between rounded-md border border-border-default bg-bg-card px-4 py-2 text-sm"
                  >
                    <span className="tabular-nums text-text-secondary">
                      {formatDay(l.startDate)} – {formatDay(l.endDate)}
                      {l.reason ? ` · ${l.reason}` : ""}
                    </span>
                    <span className="text-text-muted">
                      {leaveStatusLabel(l.status)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </main>
  );
}
