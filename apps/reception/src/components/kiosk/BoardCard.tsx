"use client";

import { CheckCircle2 } from "lucide-react";
import { ArtistAvatar } from "./ArtistAvatar";
import {
  currentSession,
  hhmm,
  nextSession,
  progressPct,
  type BoardArtist,
  type BoardSession,
} from "./kiosk-logic";

/** One on-the-floor artist's card on the kiosk home board. */
export function BoardCard({
  artist,
  sessions,
  now,
  onCheckout,
}: {
  artist: BoardArtist;
  sessions: BoardSession[];
  now: Date;
  onCheckout: (bookingId: string) => void;
}) {
  const current = currentSession(sessions, artist.id, now);
  const next = nextSession(sessions, artist.id, now);
  const dueSoon =
    !current &&
    next != null &&
    new Date(next.start).getTime() - now.getTime() <= 30 * 60_000;

  return (
    <div className="rk-card">
      <ArtistAvatar artist={artist} size={60} />
      <div className="rk-card-main">
        <div className="rk-card-name">
          <b>{artist.name}</b>
          {current ? (
            <span className="rk-pill busy">
              <span
                className="dot"
                style={{ background: "var(--bb-crimson)", width: 6, height: 6 }}
              ></span>
              In session
            </span>
          ) : dueSoon ? (
            <span className="rk-pill soon">Client due</span>
          ) : (
            <span className="rk-pill free">Free</span>
          )}
        </div>
        {current ? (
          <>
            <div className="rk-now">
              With <b>{current.customerName}</b>
              <span className="rk-time">
                {hhmm(current.start)}–{hhmm(current.end)}
              </span>
            </div>
            <div className="rk-progress">
              <div style={{ width: `${progressPct(current, now)}%` }}></div>
            </div>
            <div className="rk-card-btns">
              <button
                className="rk-mini-btn gold"
                onClick={() => onCheckout(current.id)}
              >
                <CheckCircle2 className="ic" />
                Check out
              </button>
            </div>
          </>
        ) : (
          <div
            className="rk-now"
            style={{ color: "var(--text-muted)", fontSize: 15 }}
          >
            {next ? (
              <span>
                Free until{" "}
                <b style={{ color: "var(--text-secondary)" }}>
                  {hhmm(next.start)}
                </b>
              </span>
            ) : (
              "No more bookings today"
            )}
          </div>
        )}
        {next && (
          <div className="rk-next">
            Next: <b>{next.customerName}</b> · {hhmm(next.start)}–
            {hhmm(next.end)}
            {next.checkedInAt && (
              <span className="rk-arrived" style={{ marginLeft: 8 }}>
                <CheckCircle2 className="ic" />
                here
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
