"use client";

import { useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Mail,
  Phone,
  ShieldCheck,
} from "lucide-react";
import { ArtistAvatar } from "./ArtistAvatar";
import {
  estimatePence,
  hhmm,
  typeLabel,
  type BoardArtist,
  type BoardSession,
} from "./kiosk-logic";

type CheckoutResult = { ok: true } | { ok: false; error: string };

/**
 * Check-out: confirm the final price and complete the session. Completing
 * sends the receipt + aftercare emails and awards the loyalty stamp via the
 * core sessions service.
 */
export function CheckoutScreen({
  session,
  artist,
  onComplete,
  onExit,
}: {
  session: BoardSession;
  artist: BoardArtist | undefined;
  onComplete: (
    bookingId: string,
    amountPence: number,
  ) => Promise<CheckoutResult>;
  onExit: () => void;
}) {
  const est = estimatePence(session, artist);
  const [cost, setCost] = useState(() =>
    session.amountChargedPence != null
      ? String(Math.round(session.amountChargedPence / 100))
      : String(Math.round(est / 100)),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid =
    cost.trim() !== "" && !Number.isNaN(Number(cost)) && Number(cost) >= 0;
  const durH = session.durationMin / 60;
  const firstName = session.customerName.split(" ")[0];
  const hourly = artist?.hourlyRatePence ?? 0;

  const bump = (d: number) =>
    setCost(String(Math.max(0, (Number(cost) || 0) + d)));

  const submit = async () => {
    if (!valid) return;
    setBusy(true);
    setError(null);
    const result = await onComplete(session.id, Math.round(Number(cost) * 100));
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
          <div className="rk-screen-title">Check out {firstName}</div>
          <div className="rk-screen-sub">
            Confirm the final price, complete the session, and the receipt goes
            out automatically.
          </div>
        </div>
      </div>
      <div className="rk-screen-body rk-checkout-body">
        <div className="rk-checkout">
          {/* left: session summary */}
          <div className="rk-co-summary">
            {artist && <ArtistAvatar artist={artist} size={84} />}
            <div className="rk-co-cust">{session.customerName}</div>
            {artist && (
              <div className="rk-co-with">
                with <b>{artist.name}</b>
              </div>
            )}
            <div className="rk-co-facts">
              <div className="rk-co-fact">
                <Clock className="ic" />
                <span>
                  <b>
                    {hhmm(session.start)}–{hhmm(session.end)}
                  </b>
                  <small>
                    {durH} hour{durH === 1 ? "" : "s"} ·{" "}
                    {typeLabel(session.type)}
                  </small>
                </span>
              </div>
              <div className="rk-co-fact">
                <ShieldCheck className="ic" />
                <span>
                  {session.checkedInAt ? (
                    <>
                      <b>
                        {session.consentFlagged
                          ? "Form signed · flagged"
                          : "Consent form signed"}
                      </b>
                      <small>
                        {session.consentFlagged
                          ? "Front desk reviewed at check-in"
                          : "Signed at check-in today"}
                      </small>
                    </>
                  ) : (
                    <>
                      <b>No consent form</b>
                      <small>Checked in without the kiosk</small>
                    </>
                  )}
                </span>
              </div>
              {session.customerPhone ? (
                <div className="rk-co-fact">
                  <Phone className="ic" />
                  <span>
                    <b>{session.customerPhone}</b>
                    <small>Receipt goes to their email &amp; phone</small>
                  </span>
                </div>
              ) : null}
            </div>
          </div>

          {/* right: cost + complete */}
          <div className="rk-co-pay">
            <span className="rk-co-label">Session cost</span>
            <div className="rk-cost">
              <span className="rk-cost-sym">£</span>
              <input
                className="input rk-cost-in"
                inputMode="numeric"
                aria-label="Session cost in pounds"
                value={cost}
                onChange={(e) =>
                  setCost(e.target.value.replace(/[^0-9.]/g, ""))
                }
              />
            </div>
            <p className="meta" style={{ margin: "10px 0 0" }}>
              {session.type === "consult"
                ? "Consults are free — overwrite if anything was charged."
                : artist
                  ? `Pre-filled from ${artist.name.split(" ")[0]}'s rate (£${Math.round(hourly / 100)}/hr × ${durH}h = £${Math.round(est / 100)}) — overwrite with the final price.`
                  : "Overwrite with the final price."}
            </p>
            <div className="rk-slot-row" style={{ marginTop: 14 }}>
              {[-50, -20, -10, 10, 20, 50].map((d) => (
                <button
                  key={d}
                  className="chip"
                  style={{ padding: "13px 18px", fontSize: 14 }}
                  onClick={() => bump(d)}
                >
                  {d > 0 ? "+" : "−"}£{Math.abs(d)}
                </button>
              ))}
              <button
                className="chip gold"
                style={{ padding: "13px 18px", fontSize: 14 }}
                onClick={() => setCost(String(Math.round(est / 100)))}
              >
                Reset
              </button>
            </div>
            <div className="rk-co-foot">
              <div className="rk-consent-intro">
                <Mail className="ic" />
                <p style={{ margin: 0, fontSize: 14 }}>
                  {session.customerEmail
                    ? `Completing sends ${firstName} their receipt and aftercare guide by email automatically.`
                    : `${firstName} has no email on file — the session is still recorded and the receipt can be re-sent later from the studio app.`}
                </p>
              </div>
              {error && (
                <div className="rk-flag" role="alert">
                  <AlertTriangle className="ic" />
                  <span>{error}</span>
                </div>
              )}
              <button
                className="btn btn-lg rk-co-btn"
                disabled={!valid || busy}
                onClick={submit}
              >
                <CheckCircle2 className="ic" />
                {busy
                  ? "Completing…"
                  : `Complete session · £${valid ? Math.round(Number(cost)) : "—"}`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
