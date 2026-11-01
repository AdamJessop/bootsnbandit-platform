"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ArtistShowcase } from "@bnb/core/services/artist-showcase";
import {
  AlertTriangle,
  CalendarPlus,
  CheckCircle2,
  Heart,
  Layers,
  Lock,
  LogOut,
  Plus,
  Unlock,
  Users,
} from "lucide-react";
import { ArtistAvatar } from "./ArtistAvatar";
import { ArtistShowcaseScreen } from "./ArtistShowcaseScreen";
import { BoardCard } from "./BoardCard";
import { CheckoutScreen } from "./CheckoutScreen";
import { CustomerFlow, type CheckinPayload } from "./CustomerFlow";
import { DayListScreen } from "./DayListScreen";
import { IdleGuard } from "./IdleGuard";
import { NewSessionScreen, type WalkInPayload } from "./NewSessionScreen";
import { StaffGate } from "./StaffGate";
import { StaffScreen } from "./StaffScreen";
import {
  headerDate,
  hhmm,
  OFFLINE_MSG,
  safeAction,
  shortName,
  type BoardArtist,
  type BoardSession,
} from "./kiosk-logic";

export interface KioskBoard {
  artists: BoardArtist[];
  sessions: BoardSession[];
}

type Result = { ok: true } | { ok: false; error: string };

/** Server-action bridge — injected by the page so this shell stays testable. */
export interface KioskActions {
  toggleStaff: (artistId: string, present: boolean) => Promise<Result>;
  customerCheckin: (payload: CheckinPayload) => Promise<Result>;
  walkIn: (payload: WalkInPayload) => Promise<Result>;
  checkout: (
    bookingId: string,
    amountPence: number,
    consentAcknowledged: boolean,
  ) => Promise<Result>;
  artistShowcase: (
    artistId: string,
  ) => Promise<
    { ok: true; data: ArtistShowcase } | { ok: false; error: string }
  >;
  verifyStaffPin: (pin: string) => Promise<Result>;
}

type Screen =
  | "home"
  | "staff"
  | "new"
  | "customer"
  | "day"
  | "checkout"
  | "artist";

function Clock({ now }: { now: Date }) {
  return (
    <div className="rk-clock">
      <b>{hhmm(now)}</b>
      <small>{headerDate(now)}</small>
    </div>
  );
}

/** Sign the tablet out (clears the kiosk's staff session cookie). */
async function signOutRequest(): Promise<Result> {
  const res = await fetch("/api/auth/logout", { method: "POST" });
  return res.ok ? { ok: true } : { ok: false, error: OFFLINE_MSG };
}

/**
 * Front-desk kiosk shell: home board + overlay screens. The board data is
 * server-rendered props; a 30s refresh loop (plus a refresh after every
 * mutation) keeps it live.
 *
 * Customer vs staff: the tablet is signed in as staff, but it sits in the
 * waiting area. Customer check-in and the artist showcase are open to
 * anyone; everything else (staff check-in, new session, today's sessions,
 * check out, signing the tablet out) sits behind the StaffGate. Unlocking
 * opens "staff mode" until someone taps Lock, a customer starts checking in,
 * or the kiosk goes idle. While any overlay is open the board underneath is
 * `inert`, so a customer mid-form can't reach a staff control behind it.
 */
export function KioskApp({
  board,
  actions,
  pinConfigured = false,
  signOut = signOutRequest,
}: {
  board: KioskBoard;
  actions: KioskActions;
  /** A studio PIN is set → PIN pad; otherwise hold-to-unlock. */
  pinConfigured?: boolean;
  signOut?: () => Promise<Result>;
}) {
  const router = useRouter();
  const [screen, setScreen] = useState<Screen>("home");
  const [checkoutId, setCheckoutId] = useState<string | null>(null);
  const [checkoutFrom, setCheckoutFrom] = useState<Screen>("home");
  const [toast, setToast] = useState<{
    msg: string;
    kind: "ok" | "error";
  } | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [showcaseArtistId, setShowcaseArtistId] = useState<string | null>(null);
  const [showcase, setShowcase] = useState<ArtistShowcase | null>(null);
  const [staffUnlocked, setStaffUnlocked] = useState(false);
  /** The staff action waiting on the gate, if it is open. */
  const [gate, setGate] = useState<{ run: () => void } | null>(null);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(t);
  }, []);

  // Live board: re-render the server component tree every 30s.
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 30_000);
    return () => clearInterval(t);
  }, [router]);

  const say = useCallback((msg: string, kind: "ok" | "error" = "ok") => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 4000);
  }, []);

  /** Back to the board, staff mode locked, nothing half-filled kept. */
  const resetKiosk = useCallback(() => {
    setScreen("home");
    setGate(null);
    setStaffUnlocked(false);
    setCheckoutId(null);
    setConfirmSignOut(false);
  }, []);

  /** Run a staff-only action, asking for the staff unlock first if needed. */
  const asStaff = (run: () => void) => {
    if (staffUnlocked) run();
    else setGate({ run });
  };

  const inToday = board.artists.filter((a) => a.checkedIn);
  const outToday = board.artists.filter((a) => !a.checkedIn);
  const overlayOpen = screen !== "home" || gate != null;

  // Open the showcase immediately (the header renders from board data) and
  // stream the richer profile/gallery payload in behind it.
  const openShowcase = async (artistId: string) => {
    // Reopening the same artist reuses the already-loaded payload.
    if (artistId === showcaseArtistId && showcase) {
      setScreen("artist");
      return;
    }
    setShowcaseArtistId(artistId);
    setShowcase(null);
    setScreen("artist");
    const res = await safeAction(() => actions.artistShowcase(artistId));
    if (res.ok) {
      setShowcase(res.data);
    } else {
      setScreen("home");
      setShowcaseArtistId(null);
      say(res.error, "error");
    }
  };

  // Keep the last payload cached so reopening the same artist is instant.
  const closeShowcase = () => setScreen("home");

  const toggleStaff = async (artistId: string, present: boolean) => {
    const res = await safeAction(() => actions.toggleStaff(artistId, present));
    if (res.ok) router.refresh();
    else say(res.error, "error");
  };

  const customerCheckin = async (payload: CheckinPayload) => {
    const res = await safeAction(() => actions.customerCheckin(payload));
    if (res.ok) router.refresh();
    return res;
  };

  const walkIn = async (payload: WalkInPayload) => {
    const res = await safeAction(() => actions.walkIn(payload));
    if (res.ok) {
      router.refresh();
      const artist = board.artists.find((a) => a.id === payload.artistId);
      setScreen("home");
      say(
        `${shortName(payload.customerName)} booked${artist ? ` with ${artist.name}` : ""} at ${hhmm(new Date(payload.startIso))}`,
      );
    }
    return res;
  };

  const openCheckout = (from: Screen) => (bookingId: string) =>
    asStaff(() => {
      setCheckoutId(bookingId);
      setCheckoutFrom(from);
      setScreen("checkout");
    });

  const checkout = async (
    bookingId: string,
    amountPence: number,
    consentAcknowledged: boolean,
  ) => {
    const res = await safeAction(() =>
      actions.checkout(bookingId, amountPence, consentAcknowledged),
    );
    if (res.ok) {
      const sess = board.sessions.find((s) => s.id === bookingId);
      router.refresh();
      setScreen("home");
      setCheckoutId(null);
      const first = sess ? sess.customerName.split(" ")[0] : "customer";
      say(
        sess?.customerEmail
          ? `Session complete · receipt & aftercare emailed to ${first}`
          : `Session complete · recorded for ${first}`,
      );
    }
    return res;
  };

  const doSignOut = async () => {
    setSigningOut(true);
    const res = await safeAction(signOut);
    if (res.ok) {
      window.location.assign("/sign-in");
      return;
    }
    setSigningOut(false);
    setConfirmSignOut(false);
    say(res.error, "error");
  };

  const checkoutSession = checkoutId
    ? (board.sessions.find((s) => s.id === checkoutId) ?? null)
    : null;

  return (
    <div className="rk-root">
      <div className="rk-top" inert={overlayOpen}>
        <div className="brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/bb-logo.png" alt="Boots 'n' Bandit" />
          <span className="brand-txt">
            <b>Front Desk</b>
            <small>Boots &rsquo;n&rsquo; Bandit · Worksop</small>
          </span>
        </div>
        <div className="rk-staff-tray">
          {staffUnlocked ? (
            confirmSignOut ? (
              <>
                <span className="meta">Sign this tablet out?</span>
                <button
                  className="rk-mini-btn"
                  onClick={() => setConfirmSignOut(false)}
                  disabled={signingOut}
                >
                  Cancel
                </button>
                <button
                  className="rk-mini-btn gold"
                  onClick={doSignOut}
                  disabled={signingOut}
                >
                  <LogOut className="ic" />
                  {signingOut ? "Signing out…" : "Sign out"}
                </button>
              </>
            ) : (
              <>
                <span className="rk-pill free">
                  <Unlock className="ic" style={{ width: 11, height: 11 }} />
                  Staff mode
                </span>
                <button
                  className="rk-mini-btn"
                  onClick={() => setConfirmSignOut(true)}
                >
                  <LogOut className="ic" />
                  Sign out of this tablet
                </button>
                <button
                  className="rk-mini-btn gold"
                  onClick={() => setStaffUnlocked(false)}
                >
                  <Lock className="ic" />
                  Lock
                </button>
              </>
            )
          ) : (
            <button
              className="rk-mini-btn"
              onClick={() => asStaff(() => {})}
              aria-label="Unlock staff mode"
            >
              <Lock className="ic" />
              Staff
            </button>
          )}
        </div>
        <Clock now={now} />
      </div>

      <div className="rk-actions" inert={overlayOpen}>
        <button
          className="rk-action customer"
          onClick={() => {
            // Customer mode: nothing staff-only stays unlocked behind them.
            setStaffUnlocked(false);
            setConfirmSignOut(false);
            setScreen("customer");
          }}
        >
          <span className="rk-action-ic">
            <Heart className="ic" />
          </span>
          <span>
            <b>Customer check-in</b>
            <small>
              Here for a session? Tap to check in &amp; sign your form.
            </small>
          </span>
        </button>
        <button
          className="rk-action staff"
          onClick={() => asStaff(() => setScreen("staff"))}
        >
          <span className="rk-action-ic">
            <Users className="ic" />
          </span>
          <span>
            <b>Staff check-in</b>
            <small>Start or end your day</small>
          </span>
        </button>
        <button
          className="rk-action new"
          onClick={() => asStaff(() => setScreen("new"))}
        >
          <span className="rk-action-ic">
            <Plus className="ic" />
          </span>
          <span>
            <b>New session</b>
            <small>Book a customer in</small>
          </span>
        </button>
      </div>

      <div className="rk-board" inert={overlayOpen}>
        <div className="rk-board-h">
          <h2>On the floor today</h2>
          <span className="meta">{inToday.length} in · updated live</span>
          <button
            className="rk-day-btn"
            onClick={() => asStaff(() => setScreen("day"))}
          >
            <Layers className="ic" />
            Today&rsquo;s sessions
          </button>
        </div>
        {board.sessions.length === 0 && (
          <div className="rk-empty-note">
            <span>No sessions booked today yet.</span>
            <button
              className="rk-mini-btn gold"
              onClick={() => asStaff(() => setScreen("new"))}
            >
              <CalendarPlus className="ic" />
              New session
            </button>
          </div>
        )}
        {inToday.length === 0 ? (
          <div className="rk-empty">
            <Users className="ic" />
            <p>
              Nobody&rsquo;s tapped in yet — tap <b>Staff check-in</b> to start
              the day.
            </p>
            <button
              className="rk-mini-btn"
              onClick={() => asStaff(() => setScreen("staff"))}
            >
              <Users className="ic" />
              Staff check-in
            </button>
          </div>
        ) : (
          <div className="rk-grid">
            {inToday.map((a) => (
              <BoardCard
                key={a.id}
                artist={a}
                sessions={board.sessions}
                now={now}
                onCheckout={openCheckout("home")}
                onOpen={openShowcase}
              />
            ))}
          </div>
        )}
        {outToday.length > 0 && (
          <>
            <div className="rk-board-h" style={{ marginTop: 6 }}>
              <h2 style={{ color: "var(--text-muted)" }}>Not in</h2>
            </div>
            <div className="rk-off">
              {outToday.map((a) => (
                <button
                  key={a.id}
                  className="rk-off-chip"
                  onClick={() => openShowcase(a.id)}
                >
                  <ArtistAvatar artist={a} size={34} />
                  <span>
                    {a.name}
                    {a.onLeave ? " · leave" : ""}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {screen === "staff" && (
        <StaffScreen
          artists={board.artists}
          onToggle={toggleStaff}
          onExit={() => setScreen("home")}
        />
      )}
      {screen === "new" && (
        <NewSessionScreen
          artists={board.artists.filter((a) => !a.onLeave)}
          now={now}
          onCreate={walkIn}
          onExit={() => setScreen("home")}
        />
      )}
      {screen === "customer" && (
        <CustomerFlow
          artists={board.artists}
          sessions={board.sessions}
          pinConfigured={pinConfigured}
          onVerifyPin={actions.verifyStaffPin}
          onCheckin={customerCheckin}
          onExit={() => setScreen("home")}
        />
      )}
      {screen === "day" && (
        <DayListScreen
          artists={board.artists}
          sessions={board.sessions}
          now={now}
          onCheckout={openCheckout("day")}
          onNew={() => setScreen("new")}
          onExit={() => setScreen("home")}
        />
      )}
      {screen === "artist" &&
        (() => {
          const a = board.artists.find((x) => x.id === showcaseArtistId);
          return a ? (
            <ArtistShowcaseScreen
              artist={a}
              showcase={showcase}
              onExit={closeShowcase}
            />
          ) : null;
        })()}
      {screen === "checkout" && checkoutSession && (
        <CheckoutScreen
          session={checkoutSession}
          artist={board.artists.find((a) => a.id === checkoutSession.artistId)}
          onComplete={checkout}
          onExit={() => setScreen(checkoutFrom)}
        />
      )}

      {gate && (
        <StaffGate
          pinConfigured={pinConfigured}
          onVerifyPin={actions.verifyStaffPin}
          onCancel={() => setGate(null)}
          onUnlocked={() => {
            setStaffUnlocked(true);
            setGate(null);
            gate.run();
          }}
        />
      )}

      <IdleGuard
        active={screen !== "home" || gate != null || staffUnlocked}
        onReset={resetKiosk}
      />

      {toast && (
        <div className={"rk-toast" + (toast.kind === "error" ? " error" : "")}>
          {toast.kind === "error" ? (
            <AlertTriangle className="ic" />
          ) : (
            <CheckCircle2 className="ic" />
          )}
          {toast.msg}
        </div>
      )}
    </div>
  );
}
