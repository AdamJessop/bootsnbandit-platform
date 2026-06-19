import { KeyRound, RefreshCw, Trash2, CalendarClock } from "lucide-react";
import { requireRole } from "@bnb/core/auth";
import { prisma } from "@bnb/core/db";
import { getAuthConfig } from "@bnb/core/auth/config";
import { Button } from "@/components/ui/button";
import {
  ProfileEditor,
  type ProfileEditorValues,
} from "./_components/ProfileEditor";
import { regenerateFeed, removeOwnPasskey, saveProfile } from "./_lib/actions";

/**
 * My Profile (BACKOFHOUSE-IA L). All staff: edit own artist profile/portfolio,
 * view the personal iCal subscribe URL (+ regenerate), manage passkeys/devices.
 * The iCal feed endpoint itself (`/api/calendar/<token>.ics`) ships in P12 —
 * here we surface the URL derived from the CalendarFeed token.
 */
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await requireRole();
  const { origin } = getAuthConfig();

  const artist = user.artistId
    ? await prisma.artist.findUnique({
        where: { id: user.artistId },
        include: { styles: { select: { id: true } } },
      })
    : null;
  const styles = await prisma.tattooStyle.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
  });
  const feed = user.artistId
    ? await prisma.calendarFeed.findUnique({
        where: { artistId: user.artistId },
      })
    : null;
  const passkeys = await prisma.authenticator.findMany({
    where: { userId: user.id },
    select: { id: true, deviceName: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const feedUrl = feed ? `${origin}/api/calendar/${feed.token}.ics` : null;

  const values: ProfileEditorValues = {
    status: artist?.status ?? "RESIDENT",
    bio: artist?.bio ?? null,
    insta: artist?.insta ?? null,
    headshot: artist?.headshot ?? null,
    hourlyRatePence: artist?.hourlyRatePence ?? null,
    dayRatePence: artist?.dayRatePence ?? null,
    selectedStyleIds: artist?.styles.map((s) => s.id) ?? [],
    specials: artist?.specials ?? [],
  };

  return (
    <main className="mx-auto max-w-[1100px] px-7 py-10">
      <p className="kicker mb-2">My profile</p>
      <h1 className="display text-[clamp(24px,4vw,36px)] text-text-primary">
        {user.displayName}
      </h1>
      <p className="mt-2 mb-8 text-text-muted">{user.email}</p>

      <section className="mb-10">
        <h2 className="mb-4 font-termina text-sm font-bold uppercase tracking-wide text-text-primary">
          Profile &amp; portfolio
        </h2>
        {artist ? (
          <ProfileEditor values={values} styles={styles} action={saveProfile} />
        ) : (
          <p className="text-sm text-text-muted">
            Your account has no linked artist profile yet. Ask an owner to link
            one in Content &rsaquo; Artists.
          </p>
        )}
      </section>

      <section className="mb-10 rounded-lg border border-border-default bg-bg-card p-5">
        <h2 className="mb-3 flex items-center gap-2 font-termina text-sm font-bold uppercase tracking-wide text-text-primary">
          <CalendarClock className="h-4 w-4" /> My calendar feed
        </h2>
        {feedUrl ? (
          <>
            <p className="mb-2 text-sm text-text-muted">
              Subscribe to this URL in Apple/Google Calendar to see your
              bookings:
            </p>
            <code className="block overflow-x-auto rounded-md border border-border-default bg-bg-raised px-3 py-2 text-sm text-bb-teal">
              {feedUrl}
            </code>
            <form action={regenerateFeed} className="mt-3">
              <Button
                type="submit"
                variant="outline"
                size="sm"
                className="gap-1.5"
              >
                <RefreshCw className="h-4 w-4" /> Regenerate URL
              </Button>
            </form>
            <p className="mt-2 text-xs text-text-muted">
              Regenerating invalidates the old link on every device.
            </p>
          </>
        ) : (
          <p className="text-sm text-text-muted">
            No calendar feed yet — link an artist profile to your account to get
            a subscribe URL.
          </p>
        )}
      </section>

      <section className="rounded-lg border border-border-default bg-bg-card p-5">
        <h2 className="mb-3 flex items-center gap-2 font-termina text-sm font-bold uppercase tracking-wide text-text-primary">
          <KeyRound className="h-4 w-4" /> Passkeys &amp; devices
        </h2>
        {passkeys.length === 0 ? (
          <p className="text-sm text-text-muted">No passkeys enrolled.</p>
        ) : (
          <ul className="space-y-1.5">
            {passkeys.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between text-sm text-text-secondary"
              >
                <span>
                  {p.deviceName ?? "Device"}
                  <span className="ml-2 text-xs text-text-muted">
                    added {p.createdAt.toLocaleDateString("en-GB")}
                  </span>
                </span>
                <form action={removeOwnPasskey}>
                  <input type="hidden" name="credentialId" value={p.id} />
                  <button
                    type="submit"
                    aria-label="Remove passkey"
                    className="grid h-7 w-7 place-items-center rounded-md border border-border-default text-text-muted hover:text-bb-crimson"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
