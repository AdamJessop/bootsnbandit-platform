"use client";

import { useEffect, useRef, useState } from "react";
import { Hand } from "lucide-react";
import { idleStage } from "./kiosk-logic";

/**
 * Kiosk idle reset. While `active` (a customer or staff screen is open, or
 * staff mode is unlocked), ~90s without a touch shows a "Still there?"
 * prompt; if nobody taps within its 10s countdown, `onReset` returns the
 * kiosk to the home board — unmounting the open screen, which drops any
 * half-filled consent form, walk-in or checkout with it — and re-locks staff
 * mode. Any touch or key press anywhere counts as activity.
 */
export function IdleGuard({
  active,
  onReset,
}: {
  active: boolean;
  onReset: () => void;
}) {
  const last = useRef(0);
  const resetRef = useRef(onReset);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    resetRef.current = onReset;
  }, [onReset]);

  useEffect(() => {
    const bump = () => {
      last.current = Date.now();
    };
    // Capture phase so a tap that a screen stops propagating still counts.
    window.addEventListener("pointerdown", bump, true);
    window.addEventListener("keydown", bump, true);
    return () => {
      window.removeEventListener("pointerdown", bump, true);
      window.removeEventListener("keydown", bump, true);
    };
  }, []);

  useEffect(() => {
    setSecondsLeft(null);
    if (!active) return;
    // The clock starts when the screen opens, not at the last board tap.
    last.current = Date.now();
    const t = setInterval(() => {
      const s = idleStage(Date.now() - last.current);
      if (s.stage === "reset") {
        setSecondsLeft(null);
        resetRef.current();
      } else {
        setSecondsLeft(s.stage === "warning" ? s.secondsLeft : null);
      }
    }, 1000);
    return () => clearInterval(t);
  }, [active]);

  if (!active || secondsLeft == null) return null;
  return (
    <div className="rk-idle" role="alertdialog" aria-labelledby="rk-idle-t">
      <div className="rk-idle-card fade-up">
        <Hand className="ic" />
        <h2 id="rk-idle-t">Still there?</h2>
        <p>
          We&rsquo;ll head back to the start in{" "}
          <b>
            {secondsLeft} second{secondsLeft === 1 ? "" : "s"}
          </b>{" "}
          and clear anything filled in so far.
        </p>
        <button
          className="btn btn-lg"
          onClick={() => {
            last.current = Date.now();
            setSecondsLeft(null);
          }}
        >
          I&rsquo;m still here
        </button>
      </div>
    </div>
  );
}
