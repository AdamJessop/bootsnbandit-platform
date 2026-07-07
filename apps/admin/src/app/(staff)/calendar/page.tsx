import { getCurrentUser } from "@bnb/core/auth";
import { redirect } from "next/navigation";
import type { CalendarView } from "@/components/admin/CalendarGrid";
import { CalendarClient } from "./CalendarClient";
import {
  loadArtistsForUser,
  loadCalendarData,
  loadCalendarDataAll,
  loadCustomerOptions,
  resolveActiveArtist,
} from "./data";

/**
 * Calendar screen (BACKOFHOUSE-IA C). Server component: resolves the signed-in
 * user, the artist whose calendar to show (owner/front-desk can switch via the
 * `?artist=` param), and the visible window, then hands off to the client
 * island for view state, drag and the booking drawer.
 */

export const dynamic = "force-dynamic";

function parseView(v: string | undefined): CalendarView {
  return v === "week" ? "week" : "day";
}

function parseAnchor(v: string | undefined): Date {
  if (v) {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const sp = await searchParams;
  const view = parseView(typeof sp.view === "string" ? sp.view : undefined);
  const anchor = parseAnchor(typeof sp.date === "string" ? sp.date : undefined);
  const requested = typeof sp.artist === "string" ? sp.artist : undefined;

  const artists = await loadArtistsForUser(user);
  const activeArtistId = resolveActiveArtist(user, artists, requested);

  if (!activeArtistId) {
    return (
      <main className="mx-auto max-w-[1200px] px-7 py-10">
        <h1 className="display text-2xl text-text-primary">Calendar</h1>
        <p className="mt-4 text-text-muted">
          No artist profile is linked to your account yet.
        </p>
      </main>
    );
  }

  // "all" (owner-only sentinel from resolveActiveArtist): every artist's
  // calendar at once, events/leave tagged with their owning artistId.
  const allStaff = activeArtistId === "all";
  const [{ events, leave }, customers] = await Promise.all([
    allStaff
      ? loadCalendarDataAll(
          artists.map((a) => a.id),
          anchor,
          view,
        )
      : loadCalendarData(activeArtistId, anchor, view),
    loadCustomerOptions(),
  ]);

  return (
    <main className="mx-auto max-w-[1200px] px-4 py-6 sm:px-7">
      <p className="kicker mb-2">Schedule</p>
      <h1 className="display mb-5 text-[clamp(22px,4vw,32px)] text-text-primary">
        Calendar
      </h1>
      <CalendarClient
        canSwitchArtist={user.role === "OWNER"}
        artists={artists.map((a) => ({
          id: a.id,
          name: a.name,
          hue: a.hue,
          hourlyRatePence: a.hourlyRatePence,
          dayRatePence: a.dayRatePence,
        }))}
        activeArtistId={activeArtistId}
        view={view}
        anchorISO={anchor.toISOString()}
        events={events}
        leave={leave}
        customers={customers}
      />
    </main>
  );
}
