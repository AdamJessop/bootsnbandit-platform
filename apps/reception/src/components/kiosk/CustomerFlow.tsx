"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronRight,
  IdCard,
  ShieldCheck,
} from "lucide-react";
import { ArtistAvatar } from "./ArtistAvatar";
import { SignaturePad, type SignaturePadApi } from "./SignaturePad";
import { StaffUnlock } from "./StaffGate";
import {
  ageOn,
  allAnswered,
  awaitingCheckin,
  CONSENT_QUESTIONS,
  CONSENT_SECTIONS,
  flaggedQuestions,
  hhmm,
  isFormFlagged,
  isoDate,
  MEDICAL_NOTES_MAX,
  MIN_TATTOO_AGE,
  safeAction,
  shortName,
  type BoardArtist,
  type BoardSession,
} from "./kiosk-logic";

/** Everything the customer fills in themselves. */
export interface ConsentDraft {
  answers: Record<string, boolean>;
  printedName: string;
  /** YYYY-MM-DD from the date input. */
  dob: string;
  medicalNotes: string;
  /** Portfolio/socials photo consent — optional, null = not answered. */
  photoConsent: boolean | null;
  signature: string;
}

export interface CheckinPayload extends ConsentDraft {
  bookingId: string;
  /** The staff member who confirmed the customer's photo ID. */
  idCheckedByArtistId: string;
}

type CheckinResult = { ok: true } | { ok: false; error: string };
type PinResult = { ok: true } | { ok: false; error: string };

/** What the finish button says (and why it is still disabled). */
export function consentFootLabel(state: {
  answered: boolean;
  named: boolean;
  dobValid: boolean;
  signed: boolean;
}): string {
  if (!state.answered) return "Answer all questions to finish";
  if (!state.named) return "Print your full name";
  if (!state.dobValid) return "Add your date of birth";
  if (!state.signed) return "Sign above to finish";
  return "Done — hand to the front desk";
}

/** Consent questionnaire + name, DOB and signature for one session. */
export function ConsentScreen({
  session,
  artist,
  onNext,
  onBack,
}: {
  session: BoardSession;
  artist: BoardArtist | undefined;
  onNext: (draft: ConsentDraft) => void;
  onBack: () => void;
}) {
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const [printedName, setPrintedName] = useState(session.customerName);
  const [dob, setDob] = useState("");
  const [medicalNotes, setMedicalNotes] = useState("");
  const [photoConsent, setPhotoConsent] = useState<boolean | null>(null);
  const [signed, setSigned] = useState(false);
  const padApi = useRef<SignaturePadApi>({ getDataUrl: () => null }).current;

  const set = (id: string, v: boolean) =>
    setAnswers((a) => ({ ...a, [id]: v }));
  const answered = allAnswered(answers);
  const flags = flaggedQuestions(answers);
  const age = dob ? ageOn(dob) : null;
  const state = {
    answered,
    named: printedName.trim().length > 0,
    dobValid: age != null,
    signed,
  };
  const ready = Object.values(state).every(Boolean);

  const next = () => {
    const signature = padApi.getDataUrl();
    if (!signature || !ready) return;
    onNext({
      answers,
      printedName: printedName.trim(),
      dob,
      medicalNotes: medicalNotes.trim(),
      photoConsent,
      signature,
    });
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

          {CONSENT_SECTIONS.map((section) => (
            <div key={section.id} className="rk-consent-section">
              <h3 className="rk-consent-h">{section.title}</h3>
              {section.id === "health" && (
                <p className="rk-consent-note">
                  A &ldquo;Yes&rdquo; here doesn&rsquo;t mean we can&rsquo;t
                  tattoo you — it just means your artist may want a quick chat
                  first.
                </p>
              )}
              {CONSENT_QUESTIONS.filter((q) => q.section === section.id).map(
                (q) => (
                  <div key={q.id} className="rk-q">
                    <p>{q.q}</p>
                    <div className="rk-yn">
                      <button
                        className={
                          "yes " + (answers[q.id] === true ? "on" : "")
                        }
                        aria-pressed={answers[q.id] === true}
                        onClick={() => set(q.id, true)}
                      >
                        Yes
                      </button>
                      <button
                        className={
                          "no " + (answers[q.id] === false ? "on" : "")
                        }
                        aria-pressed={answers[q.id] === false}
                        onClick={() => set(q.id, false)}
                      >
                        No
                      </button>
                    </div>
                  </div>
                ),
              )}
              {section.id === "health" && (
                <div className="rk-q rk-q-text">
                  <label htmlFor="rk-medical">
                    Anything else we should know? A condition, medication or
                    allergy — or more about a &ldquo;Yes&rdquo; above.{" "}
                    <span className="meta">(optional)</span>
                  </label>
                  <textarea
                    id="rk-medical"
                    className="input"
                    rows={3}
                    maxLength={MEDICAL_NOTES_MAX}
                    value={medicalNotes}
                    onChange={(e) => setMedicalNotes(e.target.value)}
                  />
                </div>
              )}
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

          <div className="rk-consent-section">
            <h3 className="rk-consent-h">Photos</h3>
            <div className="rk-q">
              <p>
                Happy for us to photograph your finished piece for our portfolio
                and socials? <span className="meta">(optional)</span>
              </p>
              <div className="rk-yn">
                <button
                  className={"yes " + (photoConsent === true ? "on" : "")}
                  aria-pressed={photoConsent === true}
                  onClick={() => setPhotoConsent(true)}
                >
                  Yes
                </button>
                <button
                  className={"no " + (photoConsent === false ? "on" : "")}
                  aria-pressed={photoConsent === false}
                  onClick={() => setPhotoConsent(false)}
                >
                  No
                </button>
              </div>
            </div>
          </div>

          <div className="rk-consent-section">
            <h3 className="rk-consent-h">About you</h3>
            <div className="gen-two">
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="rk-printed">Your full name</label>
                <input
                  id="rk-printed"
                  className="input"
                  value={printedName}
                  onChange={(e) => setPrintedName(e.target.value)}
                  autoComplete="off"
                  style={{ fontSize: 17, padding: 16 }}
                />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="rk-dob">Date of birth</label>
                <input
                  id="rk-dob"
                  className="input"
                  type="date"
                  value={dob}
                  max={isoDate(new Date())}
                  onChange={(e) => setDob(e.target.value)}
                  style={{ fontSize: 17, padding: 16 }}
                />
              </div>
            </div>
            {age != null && age < MIN_TATTOO_AGE && (
              <div className="rk-flag" style={{ marginTop: 12 }}>
                <AlertTriangle className="ic" />
                <span>
                  You need to be {MIN_TATTOO_AGE} or over to be tattooed in the
                  UK — have a word with the front desk.
                </span>
              </div>
            )}
          </div>

          <div className="rk-sign">
            <span className="rk-sign-label">
              Signature — {printedName.trim() || session.customerName}
            </span>
            <SignaturePad onChange={setSigned} api={padApi} />
          </div>

          <div className="rk-consent-foot">
            <button className="btn btn-lg" disabled={!ready} onClick={next}>
              <Check className="ic" />
              {consentFootLabel(state)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** "15 Jan 1990" for a YYYY-MM-DD date. */
function longDate(dob: string): string {
  const [y, m, d] = dob.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Staff step after the customer signs: the front desk checks their photo ID,
 * picks themselves and confirms with the staff unlock (PIN, or hold when no
 * PIN is set), which submits the check-in. The customer's form stays mounted
 * underneath, so Back returns to it untouched.
 */
export function IdCheckScreen({
  session,
  draft,
  artists,
  pinConfigured,
  onVerifyPin,
  onSubmit,
  onBack,
}: {
  session: BoardSession;
  draft: ConsentDraft;
  artists: BoardArtist[];
  pinConfigured: boolean;
  onVerifyPin: (pin: string) => Promise<PinResult>;
  onSubmit: (idCheckedByArtistId: string) => Promise<CheckinResult>;
  onBack: () => void;
}) {
  const [checker, setChecker] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const age = ageOn(draft.dob);
  const flags = flaggedQuestions(draft.answers);
  // On the floor first — they're the ones likely holding the tablet.
  const staff = [...artists].sort(
    (a, b) => Number(b.checkedIn) - Number(a.checkedIn),
  );

  const submit = async (artistId: string) => {
    setBusy(true);
    setError(null);
    const res = await safeAction(() => onSubmit(artistId));
    if (!res.ok) {
      setError(res.error);
      setBusy(false);
    }
  };

  return (
    <div className="rk-screen">
      <div className="rk-screen-head">
        <button className="rk-back" onClick={onBack} disabled={busy}>
          <ArrowLeft className="ic" />
          Back
        </button>
        <div>
          <div className="rk-screen-title">Over to the front desk</div>
          <div className="rk-screen-sub">
            Thanks {session.customerName.split(" ")[0]} — pass the tablet to a
            member of the crew to check your photo ID.
          </div>
        </div>
      </div>
      <div className="rk-screen-body">
        <div className="rk-consent">
          <div className="rk-consent-intro">
            <IdCard className="ic" />
            <p style={{ margin: 0, fontSize: 15 }}>
              <b>{draft.printedName}</b> · born {longDate(draft.dob)}
              {age != null ? ` (${age})` : ""}. Check their photo ID matches,
              then tap your name.
            </p>
          </div>
          {age != null && age < MIN_TATTOO_AGE && (
            <div className="rk-flag" role="alert">
              <AlertTriangle className="ic" />
              <span>
                Under {MIN_TATTOO_AGE} — no tattoo today. A consultation is
                fine.
              </span>
            </div>
          )}
          {flags.length > 0 && (
            <div className="rk-flag">
              <AlertTriangle className="ic" />
              <span>
                {flags.length} answer{flags.length === 1 ? "" : "s"} to talk
                through: {flags.map((f) => f.q).join(" · ")}
              </span>
            </div>
          )}

          <h3 className="rk-consent-h">Who checked the ID?</h3>
          <div className="rk-artist-row">
            {staff.map((a) => (
              <button
                key={a.id}
                className={"rk-artist-pick " + (checker === a.id ? "on" : "")}
                aria-pressed={checker === a.id}
                disabled={busy || confirmed}
                onClick={() => setChecker(a.id)}
              >
                <ArtistAvatar artist={a} size={32} />
                {a.name}
              </button>
            ))}
          </div>

          {checker && !confirmed && (
            <div className="rk-idcheck-unlock">
              <StaffUnlock
                pinConfigured={pinConfigured}
                onVerifyPin={onVerifyPin}
                holdLabel="Hold to confirm ID checked"
                onUnlocked={() => {
                  setConfirmed(true);
                  void submit(checker);
                }}
              />
            </div>
          )}

          {error && (
            <div className="rk-flag" role="alert">
              <AlertTriangle className="ic" />
              <span>{error}</span>
            </div>
          )}

          {confirmed && checker && (
            <div className="rk-consent-foot">
              <button
                className="btn btn-lg"
                disabled={busy}
                onClick={() => submit(checker)}
              >
                <Check className="ic" />
                {busy ? "Checking you in…" : "Try again"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Customer arrival flow: pick your session → consent form → staff ID check →
 * done. Auto-exits from the done screen so the kiosk returns to the board for
 * the next person.
 */
export function CustomerFlow({
  artists,
  sessions,
  pinConfigured,
  onVerifyPin,
  onCheckin,
  onExit,
}: {
  artists: BoardArtist[];
  sessions: BoardSession[];
  pinConfigured: boolean;
  onVerifyPin: (pin: string) => Promise<PinResult>;
  onCheckin: (payload: CheckinPayload) => Promise<CheckinResult>;
  onExit: () => void;
}) {
  const [stage, setStage] = useState<"pick" | "consent" | "idcheck" | "done">(
    "pick",
  );
  const [picked, setPicked] = useState<BoardSession | null>(null);
  const [draft, setDraft] = useState<ConsentDraft | null>(null);
  const [flagged, setFlagged] = useState(false);
  const todays = useMemo(() => awaitingCheckin(sessions), [sessions]);
  const artistOf = (s: BoardSession) =>
    artists.find((a) => a.id === s.artistId);

  useEffect(() => {
    if (stage !== "done") return;
    const t = setTimeout(onExit, 7000);
    return () => clearTimeout(t);
  }, [stage, onExit]);

  if ((stage === "consent" || stage === "idcheck") && picked) {
    return (
      <>
        <ConsentScreen
          session={picked}
          artist={artistOf(picked)}
          onBack={() => setStage("pick")}
          onNext={(d) => {
            setDraft(d);
            setStage("idcheck");
          }}
        />
        {stage === "idcheck" && draft && (
          <IdCheckScreen
            session={picked}
            draft={draft}
            artists={artists}
            pinConfigured={pinConfigured}
            onVerifyPin={onVerifyPin}
            onBack={() => setStage("consent")}
            onSubmit={async (idCheckedByArtistId) => {
              const result = await onCheckin({
                ...draft,
                bookingId: picked.id,
                idCheckedByArtistId,
              });
              if (result.ok) {
                setFlagged(isFormFlagged(draft.answers, draft.dob));
                setStage("done");
              }
              return result;
            }}
          />
        )}
      </>
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
                    setDraft(null);
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
                    {/* Waiting-area screen: first name + initial only. */}
                    <b>{shortName(s.customerName)}</b>
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
