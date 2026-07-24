"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { ArtistAvatar } from "./ArtistAvatar";
import { SignaturePad, type SignaturePadApi } from "./SignaturePad";
import {
  allAnswered,
  awaitingCheckin,
  CONSENT_QUESTIONS,
  flaggedQuestions,
  hhmm,
  type BoardArtist,
  type BoardSession,
} from "./kiosk-logic";

export interface CheckinPayload {
  bookingId: string;
  answers: Record<string, boolean>;
  signature: string;
}

type CheckinResult = { ok: true } | { ok: false; error: string };

/** Consent questionnaire + signature for one session. */
export function ConsentScreen({
  session,
  artist,
  onDone,
  onBack,
}: {
  session: BoardSession;
  artist: BoardArtist | undefined;
  onDone: (payload: CheckinPayload) => Promise<CheckinResult>;
  onBack: () => void;
}) {
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const [signed, setSigned] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const padApi = useRef<SignaturePadApi>({ getDataUrl: () => null }).current;

  const set = (id: string, v: boolean) =>
    setAnswers((a) => ({ ...a, [id]: v }));
  const answered = allAnswered(answers);
  const flags = flaggedQuestions(answers);
  const ready = answered && signed && !busy;

  const submit = async () => {
    const signature = padApi.getDataUrl();
    if (!signature) return;
    setBusy(true);
    setError(null);
    const result = await onDone({ bookingId: session.id, answers, signature });
    if (!result.ok) {
      setError(result.error);
      setBusy(false);
    }
  };

  return (
    <div className="rk-screen">
      <div className="rk-screen-head">
        <button className="rk-back" onClick={onBack}>
          <ArrowLeft className="ic" />
          Back
        </button>
        <div>
          <div className="rk-screen-title">
            Quick check-in, {session.customerName.split(" ")[0]}
          </div>
          <div className="rk-screen-sub">
            {session.type === "consult" ? "Consultation" : "Tattoo session"}
            {artist ? ` with ${artist.name}` : ""} · {hhmm(session.start)}–
            {hhmm(session.end)}. A few questions, then sign at the bottom.
          </div>
        </div>
      </div>
      <div className="rk-screen-body">
        <div className="rk-consent">
          <div className="rk-consent-intro">
            <ShieldCheck className="ic" />
            <p style={{ margin: 0, fontSize: 15 }}>
              This is your consent form — it keeps you safe and it&rsquo;s
              required before any needle comes out. Answer honestly; nothing
              here is a problem, it just helps your artist look after you.
            </p>
          </div>

          {CONSENT_QUESTIONS.map((q) => (
            <div key={q.id} className="rk-q">
              <p>{q.q}</p>
              <div className="rk-yn">
                <button
                  className={"yes " + (answers[q.id] === true ? "on" : "")}
                  onClick={() => set(q.id, true)}
                >
                  Yes
                </button>
                <button
                  className={"no " + (answers[q.id] === false ? "on" : "")}
                  onClick={() => set(q.id, false)}
                >
                  No
                </button>
              </div>
            </div>
          ))}

          {flags.length > 0 && (
            <div className="rk-flag">
              <AlertTriangle className="ic" />
              <span>
                No problem — just have a quick word with the front desk about{" "}
                {flags.length === 1 ? "that answer" : "those answers"} before
                your session starts.
              </span>
            </div>
          )}

          <div className="rk-sign">
            <span className="rk-sign-label">
              Signature — {session.customerName}
            </span>
            <SignaturePad onChange={setSigned} api={padApi} />
          </div>

          {error && (
            <div className="rk-flag" role="alert">
              <AlertTriangle className="ic" />
              <span>{error}</span>
            </div>
          )}

          <div className="rk-consent-foot">
            <button className="btn btn-lg" disabled={!ready} onClick={submit}>
              <Check className="ic" />
              {busy
                ? "Checking you in…"
                : ready
                  ? "Complete check-in"
                  : answered
                    ? "Sign above to finish"
                    : "Answer all questions to finish"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Customer arrival flow: pick your session → consent form → done. Auto-exits
 * from the done screen so the kiosk returns to the board for the next person.
 */
export function CustomerFlow({
  artists,
  sessions,
  onCheckin,
  onExit,
}: {
  artists: BoardArtist[];
  sessions: BoardSession[];
  onCheckin: (payload: CheckinPayload) => Promise<CheckinResult>;
  onExit: () => void;
}) {
  const [stage, setStage] = useState<"pick" | "consent" | "done">("pick");
  const [picked, setPicked] = useState<BoardSession | null>(null);
  const [flagged, setFlagged] = useState(false);
  const todays = useMemo(() => awaitingCheckin(sessions), [sessions]);
  const artistOf = (s: BoardSession) =>
    artists.find((a) => a.id === s.artistId);

  useEffect(() => {
    if (stage !== "done") return;
    const t = setTimeout(onExit, 7000);
    return () => clearTimeout(t);
  }, [stage, onExit]);

  if (stage === "consent" && picked) {
    return (
      <ConsentScreen
        session={picked}
        artist={artistOf(picked)}
        onBack={() => setStage("pick")}
        onDone={async (payload) => {
          const result = await onCheckin(payload);
          if (result.ok) {
            setFlagged(flaggedQuestions(payload.answers).length > 0);
            setStage("done");
          }
          return result;
        }}
      />
    );
  }

  if (stage === "done" && picked) {
    const artist = artistOf(picked);
    return (
      <div className="rk-screen">
        <div className="rk-done fade-up">
          <div className="done-orb">
            <Check className="ic" />
          </div>
          <h2>You&rsquo;re checked in!</h2>
          <p>
            Thanks {picked.customerName.split(" ")[0]} —{" "}
            {artist
              ? `${artist.name.split(" ")[0]} knows you're here`
              : "your artist knows you're here"}
            . Grab a seat and a brew
            {flagged
              ? ", and the front desk will have a quick word before you start"
              : ""}
            .
          </p>
          <button className="btn btn-lg" onClick={onExit}>
            <Check className="ic" />
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rk-screen">
      <div className="rk-screen-head">
        <button className="rk-back" onClick={onExit}>
          <ArrowLeft className="ic" />
          Back
        </button>
        <div>
          <div className="rk-screen-title">Welcome in — find your session</div>
          <div className="rk-screen-sub">
            Tap your name and we&rsquo;ll let your artist know you&rsquo;re
            here.
          </div>
        </div>
      </div>
      <div className="rk-screen-body">
        {todays.length ? (
          <div className="rk-sess-list">
            {todays.map((s) => {
              const a = artistOf(s);
              return (
                <button
                  key={s.id}
                  className="rk-sess"
                  onClick={() => {
                    setPicked(s);
                    setStage("consent");
                  }}
                >
                  <span className="rk-sess-time">
                    {hhmm(s.start)}
                    <small>
                      {s.type === "consult" ? "consult" : "session"}
                    </small>
                  </span>
                  {a && <ArtistAvatar artist={a} size={46} />}
                  <span className="rk-sess-main">
                    <b>{s.customerName}</b>
                    <small>
                      {a ? `with ${a.name} · ` : ""}
                      {hhmm(s.start)}–{hhmm(s.end)}
                    </small>
                  </span>
                  <ChevronRight className="ic" />
                </button>
              );
            })}
          </div>
        ) : (
          <div className="rk-done">
            <ShieldCheck
              className="ic"
              style={{ width: 60, height: 60, color: "var(--text-disabled)" }}
            />
            <p>
              Everyone&rsquo;s checked in — if you can&rsquo;t see your session,
              give the front desk a shout.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
