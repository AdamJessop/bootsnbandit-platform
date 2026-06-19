import Link from "next/link";
import {
  CalendarClock,
  Inbox,
  ReceiptText,
  Palmtree,
  Users,
  Banknote,
  Armchair,
} from "lucide-react";
import { getCurrentUser } from "@bnb/core/auth";
import { redirect } from "next/navigation";
import { prisma } from "@bnb/core/db";
import { reportOverview } from "@bnb/core/services/reports";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPence } from "@/components/admin/booking-form";

/**
 * Today / Dashboard (BACKOFHOUSE-IA B). Server component. Artists see a personal
 * day view (next appointment, today's column, enquiries awaiting, sessions to
 * complete, leave reminder); owners see studio-wide KPIs, a per-artist strip and
 * alerts. Reads via prisma + the Phase-6 reports service.
 */

export const dynamic = "force-dynamic";

function todayWindow(): { from: Date; to: Date } {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date();
  to.setHours(23, 59, 59, 999);
  return { from, to };
}

function monthStart(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

const TIME = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
});

export default async function AdminHomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  return user.role === "OWNER" ? <OwnerToday /> : <ArtistToday artistId={user.artistId} />;
}

/* ----------------------------- Owner dashboard ---------------------------- */

async function OwnerToday() {
  const { from, to } = todayWindow();
  const [todayBookings, newEnquiries, chairs, overview, perArtistToday] =
    await Promise.all([
      prisma.booking.count({
        where: { start: { gte: from, lte: to }, status: { not: "cancelled" } },
      }),
      prisma.enquiry.count({ where: { status: "new" } }),
      prisma.chair.count({ where: { active: true } }),
      reportOverview({ from: monthStart(), to }),
      prisma.artist.findMany({
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          name: true,
          bookings: {
            where: { start: { gte: from, lte: to }, status: { not: "cancelled" } },
            select: { id: true },
          },
        },
      }),
    ]);

  const chairsUtilised = Math.min(todayBookings, chairs);

  return (
    <main className="mx-auto max-w-[1200px] px-4 py-6 sm:px-7">
      <p className="kicker mb-2">Back of house</p>
      <h1 className="display mb-6 text-[clamp(22px,4vw,32px)] text-text-primary">
        Today
      </h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi
          icon={<CalendarClock />}
          label="Bookings today"
          value={String(todayBookings)}
        />
        <Kpi
          icon={<Armchair />}
          label="Chairs in use"
          value={`${chairsUtilised}/${chairs || "—"}`}
        />
        <Kpi
          icon={<Banknote />}
          label="Revenue MTD"
          value={formatPence(overview.totals.revenuePence)}
        />
        <Kpi
          icon={<Inbox />}
          label="New enquiries"
          value={String(newEnquiries)}
        />
      </div>

      <section className="mt-8">
        <h2 className="mb-3 font-termina text-sm uppercase tracking-wide text-text-secondary">
          Artists today
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {perArtistToday.map((a) => (
            <Card key={a.id} className="border-border-default bg-bg-card">
              <CardContent className="flex items-center justify-between py-4">
                <Link
                  href={`/calendar?artist=${a.id}`}
                  className="text-text-primary hover:underline"
                >
                  {a.name}
                </Link>
                <span className="text-sm tabular-nums text-text-muted">
                  {a.bookings.length} booking{a.bookings.length === 1 ? "" : "s"}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {newEnquiries > 0 ? (
        <Alert
          href="/enquiries"
          text={`${newEnquiries} new enquiry${newEnquiries === 1 ? "" : "s"} awaiting reply`}
        />
      ) : null}
    </main>
  );
}

/* ----------------------------- Artist dashboard --------------------------- */

async function ArtistToday({ artistId }: { artistId?: string | null }) {
  if (!artistId) {
    return (
      <main className="mx-auto max-w-[1200px] px-7 py-10">
        <h1 className="display text-2xl text-text-primary">Today</h1>
        <p className="mt-4 text-text-muted">
          No artist profile is linked to your account yet.
        </p>
      </main>
    );
  }

  const { from, to } = todayWindow();
  const now = new Date();
  const [todays, nextAppt, enquiriesAwaiting, sessionsToComplete, upcomingLeave] =
    await Promise.all([
      prisma.booking.findMany({
        where: { artistId, start: { gte: from, lte: to }, status: { not: "cancelled" } },
        orderBy: { start: "asc" },
        include: { customer: { select: { name: true } } },
      }),
      prisma.booking.findFirst({
        where: { artistId, start: { gte: now }, status: { in: ["pending", "confirmed"] } },
        orderBy: { start: "asc" },
        include: { customer: { select: { name: true } } },
      }),
      prisma.enquiry.count({ where: { preferredArtistId: artistId, status: "new" } }),
      prisma.booking.count({
        where: { artistId, start: { gte: from, lte: to }, status: "confirmed", session: null },
      }),
      prisma.leave.findFirst({
        where: { artistId, status: "approved", endDate: { gte: now } },
        orderBy: { startDate: "asc" },
      }),
    ]);

  return (
    <main className="mx-auto max-w-[1200px] px-4 py-6 sm:px-7">
      <p className="kicker mb-2">Back of house</p>
      <h1 className="display mb-6 text-[clamp(22px,4vw,32px)] text-text-primary">
        Today
      </h1>

      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi
          icon={<CalendarClock />}
          label="Next appointment"
          value={nextAppt ? TIME.format(nextAppt.start) : "—"}
          sub={nextAppt?.customer?.name ?? "Nothing booked"}
        />
        <Kpi
          icon={<Inbox />}
          label="Enquiries awaiting"
          value={String(enquiriesAwaiting)}
        />
        <Kpi
          icon={<ReceiptText />}
          label="Sessions to complete"
          value={String(sessionsToComplete)}
        />
      </div>

      <section className="mt-8">
        <h2 className="mb-3 font-termina text-sm uppercase tracking-wide text-text-secondary">
          Today&rsquo;s column
        </h2>
        {todays.length === 0 ? (
          <p className="text-sm text-text-muted">No bookings today.</p>
        ) : (
          <ul className="divide-y divide-border-default rounded-lg border border-border-default bg-bg-card">
            {todays.map((b) => (
              <li
                key={b.id}
                className="flex items-center gap-3 px-4 py-3 text-sm"
              >
                <span className="tabular-nums text-text-muted">
                  {TIME.format(b.start)}
                </span>
                <span className="text-text-primary">{b.customer.name}</span>
                <span className="ml-auto capitalize text-text-muted">
                  {b.type}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {upcomingLeave ? (
        <Alert
          icon={<Palmtree />}
          href="/availability"
          text={`Leave booked from ${upcomingLeave.startDate.toLocaleDateString("en-GB")}`}
        />
      ) : null}
    </main>
  );
}

/* -------------------------------- partials -------------------------------- */

function Kpi({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card className="border-border-default bg-bg-card">
      <CardHeader className="flex-row items-center gap-2 space-y-0 pb-1">
        <span className="text-bb-gold [&_svg]:size-4">{icon}</span>
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-text-muted">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="font-termina text-2xl tabular-nums text-text-primary">
          {value}
        </p>
        {sub ? <p className="mt-0.5 text-xs text-text-muted">{sub}</p> : null}
      </CardContent>
    </Card>
  );
}

function Alert({
  icon = <Users />,
  href,
  text,
}: {
  icon?: React.ReactNode;
  href: string;
  text: string;
}) {
  return (
    <Link
      href={href}
      className="mt-6 flex items-center gap-2 rounded-lg border border-bb-gold/40 bg-bb-gold/10 px-4 py-3 text-sm text-text-primary transition-colors hover:bg-bb-gold/15 [&_svg]:size-4 [&_svg]:text-bb-gold"
    >
      {icon}
      {text}
    </Link>
  );
}
