"use client";

import { AlertTriangle, ArrowLeft, Check, CheckCircle2 } from "lucide-react";
import { ArtistAvatar } from "./ArtistAvatar";
import {
  hhmm,
  pounds,
  takingsPence,
  typeLabel,
  type BoardArtist,
  type BoardSession,
} from "./kiosk-logic";

function rowStatus(s: BoardSession, now: Date) {
  if (s.completed)
    return (
      <span className="rk-pill done-pill">
        <Check className="ic" style={{ width: 11, height: 11 }} />
        Complete · {pounds(s.amountChargedPence ?? 0)}
      </span>
    );
  const t = now.getTime();
  if (
    s.checkedInAt &&
    new Date(s.start).getTime() <= t &&
    t < new Date(s.end).getTime()
  )
    return <span className="rk-pill busy">In session</span>;
  if (s.checkedInAt) return <span className="rk-pill free">Arrived</span>;
  return <span className="rk-pill out">Booked</span>;
}

/** Every session today — status, consent and running takings. */
export function DayListScreen({
  artists,
  sessions,
  now,
  onCheckout,
  onExit,
}: {
  artists: BoardArtist[];
  sessions: BoardSession[];
  now: Date;
  onCheckout: (bookingId: string) => void;
  onExit: () => void;
}) {
  const sorted = [...sessions].sort((a, b) => a.start.localeCompare(b.start));
  const complete = sorted.filter((s) => s.completed);
  const flagged = sorted.filter(
    (s) => s.consentFlagged === true && !s.completed,
  ).length;
  const takings = takingsPence(sorted);

  return (
    <div className="rk-screen">
      <div className="rk-screen-head">
        <button className="rk-back" onClick={onExit}>
          <ArrowLeft className="ic" />
          Back
        </button>
        <div style={{ flex: 1 }}>
          <div className="rk-screen-title">Today&rsquo;s sessions</div>
          <div className="rk-screen-sub">
            {sorted.length} booked · {complete.length} complete
            {flagged
              ? ` · ${flagged} consent flag${flagged === 1 ? "" : "s"} to review`
              : ""}
          </div>
        </div>
        <div className="rk-takings">
          <small>Takings today</small>
          <b>{pounds(takings)}</b>
        </div>
      </div>
      <div className="rk-screen-body">
        <div className="rk-day-list">
          {sorted.map((s) => {
            const a = artists.find((x) => x.id === s.artistId);
            const canCheckout =
              !s.completed &&
              (s.checkedInAt != null ||
                new Date(s.start).getTime() <= now.getTime());
            return (
              <div
                key={s.id}
                className={"rk-day-row " + (s.completed ? "is-done" : "")}
              >
                <span className="rk-sess-time">
                  {hhmm(s.start)}
                  <small>{hhmm(s.end)}</small>
                </span>
                {a && <ArtistAvatar artist={a} size={42} />}
                <span className="rk-sess-main" style={{ flex: 1, minWidth: 0 }}>
                  <b>{s.customerName}</b>
                  <small>
                    {a ? `${a.name} · ` : ""}
                    {typeLabel(s.type)}
                  </small>
                </span>
                <span className="rk-day-consent">
                  {s.consentFlagged != null ? (
                    s.consentFlagged ? (
                      <span className="rk-pill soon">
                        <AlertTriangle
                          className="ic"
                          style={{ width: 11, height: 11 }}
                        />
                        Form flagged
                      </span>
                    ) : (
                      <span className="rk-pill free">
                        <Check
                          className="ic"
                          style={{ width: 11, height: 11 }}
                        />
                        Form signed
                      </span>
                    )
                  ) : (
                    <span className="meta">No form yet</span>
                  )}
                </span>
                {rowStatus(s, now)}
                {canCheckout ? (
                  <button
                    className="rk-mini-btn gold"
                    onClick={() => onCheckout(s.id)}
                  >
                    <CheckCircle2 className="ic" />
                    Check out
                  </button>
                ) : (
                  <span style={{ width: 110 }}></span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
