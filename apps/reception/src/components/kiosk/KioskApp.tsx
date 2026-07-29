"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ArtistShowcase } from "@bnb/core/services/artist-showcase";
import {
  AlertTriangle,
  CheckCircle2,
  Heart,
  Layers,
  Plus,
  Users,
} from "lucide-react";
import { ArtistAvatar } from "./ArtistAvatar";
import { ArtistShowcaseScreen } from "./ArtistShowcaseScreen";
import { BoardCard } from "./BoardCard";
import { CheckoutScreen } from "./CheckoutScreen";
import { CustomerFlow, type CheckinPayload } from "./CustomerFlow";
import { DayListScreen } from "./DayListScreen";
import { NewSessionScreen, type WalkInPayload } from "./NewSessionScreen";
import { StaffScreen } from "./StaffScreen";
import {
  headerDate,
  hhmm,
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
  checkout: (bookingId: string, amountPence: number) => Promise<Result>;
  artistShowcase: (
    artistId: string,
  ) => Promise<
    { ok: true; data: ArtistShowcase } | { ok: false; error: string }
  >;
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

/**
 * Front-desk kiosk shell: home board + overlay screens. The board data is
 * server-rendered props; a 30s refresh loop (plus a refresh after every
 * mutation) keeps it live.
 */
export function KioskApp({
  board,
  actions,
}: {
  board: KioskBoard;
  actions: KioskActions;
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

  const inToday = board.artists.filter((a) => a.checkedIn);
  const outToday = board.artists.filter((a) => !a.checkedIn);

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
    const res = await actions.artistShowcase(artistId);
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
    const res = await actions.toggleStaff(artistId, present);
    if (res.ok) router.refresh();
    else say(res.error, "error");
  };

  const customerCheckin = async (payload: CheckinPayload) => {
    const res = await actions.customerCheckin(payload);
    if (res.ok) router.refresh();
    return res;
  };

  const walkIn = async (payload: WalkInPayload) => {
    const res = await actions.walkIn(payload);
    if (res.ok) {
      router.refresh();
      const artist = board.artists.find((a) => a.id === payload.artistId);
      setScreen("home");
      say(
        `${payload.customerName} booked${artist ? ` with ${artist.name}` : ""} at ${hhmm(new Date(payload.startIso))}`,
      );
    }
    return res;
  };

  const openCheckout = (from: Screen) => (bookingId: string) => {
    setCheckoutId(bookingId);
    setCheckoutFrom(from);
    setScreen("checkout");
  };

  const checkout = async (bookingId: string, amountPence: number) => {
    const res = await actions.checkout(bookingId, amountPence);
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

  const checkoutSession = checkoutId
    ? (board.sessions.find((s) => s.id === checkoutId) ?? null)
    : null;

  return (
    <div className="rk-root">
      <div className="rk-top">
        <div className="brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/bb-logo.png" alt="Boots 'n' Bandit" />
          <span className="brand-txt">
            <b>Front Desk</b>
            <small>Boots &rsquo;n&rsquo; Bandit · Worksop</small>
          </span>
        </div>
        <Clock now={now} />
      </div>

      <div className="rk-actions">
        <button
          className="rk-action customer"
          onClick={() => setScreen("customer")}
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
        <button className="rk-action staff" onClick={() => setScreen("staff")}>
          <span className="rk-action-ic">
            <Users className="ic" />
          </span>
          <span>
            <b>Staff check-in</b>
            <small>Start or end your day</small>
          </span>
        </button>
        <button className="rk-action new" onClick={() => setScreen("new")}>
          <span className="rk-action-ic">
            <Plus className="ic" />
          </span>
          <span>
            <b>New session</b>
            <small>Book a customer in</small>
          </span>
        </button>
      </div>

      <div className="rk-board">
        <div className="rk-board-h">
          <h2>On the floor today</h2>
          <span className="meta">{inToday.length} in · updated live</span>
          <button className="rk-day-btn" onClick={() => setScreen("day")}>
            <Layers className="ic" />
            Today&rsquo;s sessions
          </button>
        </div>
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
