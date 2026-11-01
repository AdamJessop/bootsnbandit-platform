"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, Delete, Lock } from "lucide-react";
import {
  HOLD_TO_UNLOCK_MS,
  isPinShaped,
  KIOSK_PIN_LENGTH,
  safeAction,
} from "./kiosk-logic";

type PinResult = { ok: true } | { ok: false; error: string };

/**
 * The staff unlock control, used by the full-screen StaffGate and inline by
 * the customer flow's "ID checked" step.
 *
 * Why two modes: the tablet is signed in once with a staff passkey, so the
 * session alone can't tell staff from the customer holding it. A studio-wide
 * 4–6 digit PIN (hashed in SiteSettings, verified server-side) is the real
 * gate. Until an owner sets one (`npm run kiosk:pin` — there is no admin UI
 * for it yet), the kiosk falls back to press-and-hold for 2 seconds: no
 * secret, but enough to stop a customer's casual tap landing on a staff
 * action.
 */
export function StaffUnlock({
  pinConfigured,
  onVerifyPin,
  onUnlocked,
  holdLabel = "Hold to unlock",
}: {
  pinConfigured: boolean;
  onVerifyPin: (pin: string) => Promise<PinResult>;
  onUnlocked: () => void;
  holdLabel?: string;
}) {
  return pinConfigured ? (
    <PinPad onVerifyPin={onVerifyPin} onUnlocked={onUnlocked} />
  ) : (
    <HoldButton label={holdLabel} onUnlocked={onUnlocked} />
  );
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"];

function PinPad({
  onVerifyPin,
  onUnlocked,
}: {
  onVerifyPin: (pin: string) => Promise<PinResult>;
  onUnlocked: () => void;
}) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const press = (k: string) => {
    setError(null);
    if (k === "del") setPin((p) => p.slice(0, -1));
    else if (pin.length < KIOSK_PIN_LENGTH.max) setPin((p) => p + k);
  };

  const submit = async () => {
    if (!isPinShaped(pin) || busy) return;
    setBusy(true);
    const res = await safeAction(() => onVerifyPin(pin));
    setBusy(false);
    setPin("");
    if (res.ok) onUnlocked();
    else setError(res.error);
  };

  return (
    <div className="rk-pin">
      <div
        className="rk-pin-dots"
        aria-label={`${pin.length} digits entered`}
        role="status"
      >
        {Array.from({ length: KIOSK_PIN_LENGTH.max }, (_, i) => (
          <span key={i} className={i < pin.length ? "on" : ""}></span>
        ))}
      </div>
      <div className="rk-pin-keys">
        {KEYS.map((k, i) =>
          k === "" ? (
            <span key={i}></span>
          ) : (
            <button
              key={i}
              type="button"
              className="rk-pin-key"
              aria-label={k === "del" ? "Delete digit" : k}
              onClick={() => press(k)}
              disabled={busy}
            >
              {k === "del" ? <Delete className="ic" /> : k}
            </button>
          ),
        )}
      </div>
      {error && (
        <div className="rk-flag" role="alert">
          <AlertTriangle className="ic" />
          <span>{error}</span>
        </div>
      )}
      <button
        type="button"
        className="btn btn-lg"
        disabled={!isPinShaped(pin) || busy}
        onClick={submit}
      >
        <Lock className="ic" />
        {busy ? "Checking…" : "Unlock"}
      </button>
    </div>
  );
}

function HoldButton({
  label,
  onUnlocked,
}: {
  label: string;
  onUnlocked: () => void;
}) {
  const [holding, setHolding] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setHolding(false);
  };
  const start = () => {
    if (timer.current) return;
    setHolding(true);
    timer.current = setTimeout(() => {
      timer.current = null;
      setHolding(false);
      onUnlocked();
    }, HOLD_TO_UNLOCK_MS);
  };

  // Never fire an unlock after the control has gone (idle reset, Back).
  useEffect(() => {
    const t = timer;
    return () => {
      if (t.current) clearTimeout(t.current);
    };
  }, []);

  return (
    <button
      type="button"
      className={"rk-hold" + (holding ? " holding" : "")}
      style={{ ["--hold-ms" as string]: `${HOLD_TO_UNLOCK_MS}ms` }}
      onPointerDown={(e) => {
        e.preventDefault();
        start();
      }}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          start();
        }
      }}
      onKeyUp={cancel}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span className="rk-hold-fill" aria-hidden="true"></span>
      <span className="rk-hold-label">
        <Lock className="ic" />
        {holding ? "Keep holding…" : label}
      </span>
    </button>
  );
}

/**
 * Full-screen staff gate shown before any staff-only action on the board
 * (staff check-in, new session, today's sessions, check out, sign out).
 */
export function StaffGate({
  pinConfigured,
  onVerifyPin,
  onUnlocked,
  onCancel,
}: {
  pinConfigured: boolean;
  onVerifyPin: (pin: string) => Promise<PinResult>;
  onUnlocked: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="rk-screen rk-gate">
      <div className="rk-screen-head">
        <button className="rk-back" onClick={onCancel}>
          <ArrowLeft className="ic" />
          Back
        </button>
        <div>
          <div className="rk-screen-title">Staff only</div>
          <div className="rk-screen-sub">
            {pinConfigured
              ? "Enter the studio PIN to carry on."
              : "Press and hold the button for 2 seconds to carry on."}
          </div>
        </div>
      </div>
      <div className="rk-screen-body rk-gate-body">
        <StaffUnlock
          pinConfigured={pinConfigured}
          onVerifyPin={onVerifyPin}
          onUnlocked={onUnlocked}
          holdLabel="Hold to unlock"
        />
      </div>
    </div>
  );
}
