"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, CalendarDays } from "lucide-react";
import { ArtistAvatar } from "./ArtistAvatar";
import { DURATIONS, hhmm, startSlots, type BoardArtist } from "./kiosk-logic";

export interface WalkInPayload {
  customerName: string;
  phone?: string;
  email?: string;
  artistId: string;
  startIso: string;
  durationMin: number;
  type: "consult" | "session";
}

type WalkInResult = { ok: true } | { ok: false; error: string };

/** Front-desk walk-in: create a customer and book them in for today. */
export function NewSessionScreen({
  artists,
  now,
  onCreate,
  onExit,
}: {
  artists: BoardArtist[];
  now: Date;
  onCreate: (payload: WalkInPayload) => Promise<WalkInResult>;
  onExit: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [artistId, setArtistId] = useState<string | null>(null);
  const [durIdx, setDurIdx] = useState(2);
  const [start, setStart] = useState<Date | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const slots = useMemo(() => startSlots(now), [now]);
  const ready = Boolean(name.trim() && artistId && start && !busy);

  const create = async () => {
    if (!artistId || !start) return;
    const { minutes, type } = DURATIONS[durIdx];
    setBusy(true);
    setError(null);
    const result = await onCreate({
      customerName: name.trim(),
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      artistId,
      startIso: start.toISOString(),
      durationMin: minutes,
      type,
    });
    if (!result.ok) {
      setError(result.error);
      setBusy(false);
    }
  };

  return (
    <div className="rk-screen">
      <div className="rk-screen-head">
        <button className="rk-back" onClick={onExit}>
          <ArrowLeft className="ic" />
          Back
        </button>
        <div>
          <div className="rk-screen-title">New session</div>
          <div className="rk-screen-sub">
            Create a customer and book them in for today.
          </div>
        </div>
      </div>
      <div className="rk-screen-body">
        <div className="rk-form">
          <div className="gen-two" style={{ marginBottom: 18 }}>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="rk-name">Customer name</label>
              <input
                id="rk-name"
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="First & last"
                style={{ fontSize: 17, padding: 16 }}
              />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="rk-phone">Phone (optional)</label>
              <input
                id="rk-phone"
                className="input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="07…"
                inputMode="tel"
                style={{ fontSize: 17, padding: 16 }}
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="rk-email">Email — receipt &amp; aftercare</label>
            <input
              id="rk-email"
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              inputMode="email"
              autoComplete="off"
              autoCapitalize="none"
              style={{ fontSize: 17, padding: 16 }}
            />
          </div>
          <div className="field">
            <label>Artist</label>
            <div className="rk-artist-row">
              {artists.map((a) => (
                <button
                  key={a.id}
                  className={
                    "rk-artist-pick " + (artistId === a.id ? "on" : "")
                  }
                  onClick={() => setArtistId(a.id)}
                >
                  <ArtistAvatar artist={a} size={32} />
                  {a.name}
                  {!a.checkedIn && (
                    <span className="meta" style={{ fontSize: 10 }}>
                      (out)
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label>Length</label>
            <div className="rk-slot-row">
              {DURATIONS.map((d, i) => (
                <button
                  key={d.label}
                  className={"chip " + (durIdx === i ? "on" : "")}
                  style={{ padding: "12px 18px", fontSize: 13 }}
                  onClick={() => setDurIdx(i)}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label>Start time — today</label>
            <div className="rk-slot-row">
              {slots.map((s) => (
                <button
                  key={s.toISOString()}
                  className={
                    "chip gold " +
                    (start?.getTime() === s.getTime() ? "on" : "")
                  }
                  style={{ padding: "12px 18px", fontSize: 13 }}
                  onClick={() => setStart(s)}
                >
                  {hhmm(s)}
                </button>
              ))}
            </div>
          </div>
          {error && (
            <div className="rk-flag" role="alert" style={{ marginBottom: 14 }}>
              <AlertTriangle className="ic" />
              <span>{error}</span>
            </div>
          )}
          <button
            className="btn btn-lg"
            style={{ width: "100%", marginTop: 10 }}
            disabled={!ready}
            onClick={create}
          >
            <CalendarDays className="ic" />
            {busy ? "Booking…" : "Book it in"}
          </button>
        </div>
      </div>
    </div>
  );
}
