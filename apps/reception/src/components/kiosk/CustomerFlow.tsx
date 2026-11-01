"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
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
  CONSENT_FIELD_MAX,
  CONSENT_QUESTIONS,
  CONSENT_STUDIO_NAME,
  consentDetailsErrors,
  CURRENT_CONSENT_FORM,
  flaggedQuestions,
  furtherDetailsRequired,
  hhmm,
  ID_TYPES,
  idProvidedText,
  isFormFlagged,
  isoDate,
  MEDICAL_NOTES_MAX,
  MIN_TATTOO_AGE,
  safeAction,
  shortName,
  type BoardArtist,
  type BoardSession,
  type ConsentDetails,
} from "./kiosk-logic";

/**
 * Everything the customer fills in themselves — the yellow fields on the
 * studio's paper Client Consent Form, the medical table, the agreement and
 * their signature.
 */
export interface ConsentDraft extends ConsentDetails {
  answers: Record<string, boolean>;
  /** The paper form's "further details" — required after any Yes. */
  medicalNotes: string;
  /** "I have read and agree to all of the above" was ticked. */
  agreed: boolean;
  signature: string;
}

/** The artist's half of the form, entered behind the staff gate. */
export interface ArtistDraft {
  idType: string;
  idOther: string;
  designPlacement: string;
  /** The signing artist (the booking's, unless changed at the desk). */
  artistId: string;
  artistSignature: string;
}

export interface CheckinPayload extends ConsentDraft, ArtistDraft {
  bookingId: string;
}

type CheckinResult = { ok: true } | { ok: false; error: string };
type PinResult = { ok: true } | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Customer steps (paper order)
// ---------------------------------------------------------------------------

export type ConsentStep = "details" | "medical" | "consent" | "sign";

export const CONSENT_STEPS: ReadonlyArray<{ id: ConsentStep; title: string }> =
  [
    { id: "details", title: "Your details" },
    { id: "medical", title: "Medical" },
    { id: "consent", title: "Your consent" },
    { id: "sign", title: "Sign" },
  ];

/** "+447700900123" → "07700900123": UK numbers read the way people write them. */
export function ukNational(phone: string | null): string {
  if (!phone) return "";
  return phone.startsWith("+44") ? `0${phone.slice(3)}` : phone;
}

/** A fresh form, prefilled from what the booking already knows. */
export function initialDraft(session: BoardSession): ConsentDraft {
  return {
    printedName: session.customerName,
    address: "",
    postcode: "",
    phone: ukNational(session.customerPhone),
    email: session.customerEmail ?? "",
    dob: session.customerDob ?? "",
    answers: {},
    medicalNotes: "",
    agreed: false,
    signature: "",
  };
}

/**
 * What still stops the customer leaving `step`, or null when it's done. The
 * finish button shows this text while it is disabled.
 */
export function stepProblem(
  step: ConsentStep,
  draft: Omit<ConsentDraft, "signature">,
  signed: boolean,
): string | null {
  const questions = CURRENT_CONSENT_FORM.questions;
  switch (step) {
    case "details": {
      const first = Object.values(consentDetailsErrors(draft))[0];
      return first ?? null;
    }
    case "medical":
      if (!allAnswered(draft.answers, questions)) {
        return "Answer every question to carry on";
      }
      if (
        furtherDetailsRequired(draft.answers, questions) &&
        !draft.medicalNotes.trim()
      ) {
        return "Add further details to carry on";
      }
      return null;
    case "consent":
      return draft.agreed ? null : "Tick the box to agree and carry on";
    case "sign":
      return signed ? null : "Sign above to finish";
  }
}

/** The finish button's label once a step is complete. */
export function stepNextLabel(step: ConsentStep): string {
  switch (step) {
    case "details":
      return "Next — medical";
    case "medical":
      return "Next — your consent";
    case "consent":
      return "Next — sign";
    case "sign":
      return "Done — hand to your artist";
  }
}

/** "1 November 2026" — the date written next to a signature. */
export function signedDate(on: Date = new Date()): string {
  return on.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
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

function StepDots({ step }: { step: ConsentStep }) {
  const at = CONSENT_STEPS.findIndex((s) => s.id === step);
  return (
    <ol className="rk-steps" aria-label={`Step ${at + 1} of 4`}>
      {CONSENT_STEPS.map((s, i) => (
        <li
          key={s.id}
          className={i < at ? "done" : i === at ? "on" : ""}
          aria-current={i === at ? "step" : undefined}
        >
          <span className="rk-step-n">{i < at ? "✓" : i + 1}</span>
          <span className="rk-step-t">{s.title}</span>
        </li>
      ))}
    </ol>
  );
}

function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="field rk-field">
      <label htmlFor={id}>
        {label}
        {hint && <span className="meta"> {hint}</span>}
      </label>
      {children}
      {error && (
        <span className="rk-field-error" id={`${id}-error`} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

/** Step 1 — the client's half of the paper form's header table. */
function DetailsStep({
  draft,
  set,
}: {
  draft: ConsentDraft;
  set: (patch: Partial<ConsentDraft>) => void;
}) {
  // Only nag about a field once something has been typed into it; the
  // finish button already names the first thing still missing.
  const errors = consentDetailsErrors(draft);
  const shown = (k: keyof ConsentDetails) =>
    draft[k].trim() ? errors[k] : undefined;
  const age = draft.dob ? ageOn(draft.dob) : null;
  const max = CONSENT_FIELD_MAX;
  const input = (
    k: Exclude<keyof ConsentDetails, "dob">,
    extra: React.InputHTMLAttributes<HTMLInputElement> = {},
  ) => (
    <input
      id={`rk-${k}`}
      className="input rk-input"
      value={draft[k]}
      maxLength={max[k]}
      autoComplete="off"
      aria-invalid={shown(k) ? true : undefined}
      onChange={(e) => set({ [k]: e.target.value })}
      {...extra}
    />
  );
  return (
    <div className="rk-consent-section">
      <h3 className="rk-consent-h">Your details</h3>
      <Field
        id="rk-printedName"
        label="Client name"
        error={shown("printedName")}
      >
        {input("printedName", { autoCapitalize: "words" })}
      </Field>
      <Field id="rk-address" label="Address" error={shown("address")}>
        <textarea
          id="rk-address"
          className="input rk-input"
          rows={2}
          value={draft.address}
          maxLength={max.address}
          autoComplete="off"
          onChange={(e) => set({ address: e.target.value })}
        />
      </Field>
      <div className="gen-two">
        <Field id="rk-postcode" label="Postcode" error={shown("postcode")}>
          {input("postcode", { autoCapitalize: "characters" })}
        </Field>
        <Field id="rk-phone" label="Telephone" error={shown("phone")}>
          {input("phone", { type: "tel", inputMode: "tel" })}
        </Field>
      </div>
      <div className="gen-two">
        <Field
          id="rk-email"
          label="Email"
          hint="(optional)"
          error={shown("email")}
        >
          {input("email", {
            type: "email",
            inputMode: "email",
            autoCapitalize: "none",
          })}
        </Field>
        <Field id="rk-dob" label="Date of birth" error={shown("dob")}>
          <input
            id="rk-dob"
            className="input rk-input"
            type="date"
            value={draft.dob}
            max={isoDate(new Date())}
            onChange={(e) => set({ dob: e.target.value })}
          />
        </Field>
      </div>
      {age != null && age < MIN_TATTOO_AGE && (
        <div className="rk-flag">
          <AlertTriangle className="ic" />
          <span>
            You need to be {MIN_TATTOO_AGE} or over to be tattooed in the UK —
            have a word with the front desk.
          </span>
        </div>
      )}
    </div>
  );
}

/** Step 2 — the medical table: condition, why it matters, Yes / No. */
function MedicalStep({
  draft,
  set,
}: {
  draft: ConsentDraft;
  set: (patch: Partial<ConsentDraft>) => void;
}) {
  const answer = (id: string, v: boolean) =>
    set({ answers: { ...draft.answers, [id]: v } });
  const needsDetails = furtherDetailsRequired(draft.answers);
  return (
    <div className="rk-consent-section">
      <h3 className="rk-consent-h">Medical condition</h3>
      <p className="rk-consent-note">
        Do any of these apply to you? A &ldquo;Yes&rdquo; doesn&rsquo;t mean we
        can&rsquo;t tattoo you — it just means your artist may want a quick chat
        first.
      </p>
      {CONSENT_QUESTIONS.map((q) => (
        <div key={q.id} className="rk-q rk-q-med">
          <p>
            <b>{q.q}</b>
            {q.explanation && (
              <span className="rk-q-explain">{q.explanation}</span>
            )}
          </p>
          <div className="rk-yn" role="group" aria-label={q.q}>
            <button
              className={"yes " + (draft.answers[q.id] === true ? "on" : "")}
              aria-pressed={draft.answers[q.id] === true}
              onClick={() => answer(q.id, true)}
            >
              Yes
            </button>
            <button
              className={"no " + (draft.answers[q.id] === false ? "on" : "")}
              aria-pressed={draft.answers[q.id] === false}
              onClick={() => answer(q.id, false)}
            >
              No
            </button>
          </div>
        </div>
      ))}
      <div className="rk-q rk-q-text">
        <label htmlFor="rk-medical">
          {CURRENT_CONSENT_FORM.furtherDetailsPrompt}{" "}
          <span className="meta">
            {needsDetails ? "(required)" : "(only if you answered Yes)"}
          </span>
        </label>
        <textarea
          id="rk-medical"
          className="input"
          rows={3}
          maxLength={MEDICAL_NOTES_MAX}
          value={draft.medicalNotes}
          aria-required={needsDetails}
          onChange={(e) => set({ medicalNotes: e.target.value })}
        />
      </div>
    </div>
  );
}

/** Step 3 — client information and the individual consent statements. */
function AgreementStep({
  draft,
  set,
}: {
  draft: ConsentDraft;
  set: (patch: Partial<ConsentDraft>) => void;
}) {
  const form = CURRENT_CONSENT_FORM;
  const info = form.clientInformation;
  return (
    <>
      {info && (
        <div className="rk-consent-section">
          <h3 className="rk-consent-h">Client information</h3>
          <div className="rk-legal">
            <p>{info.intro}</p>
            <ul className="rk-risks">
              {info.risks.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
      <div className="rk-consent-section">
        <h3 className="rk-consent-h">Individual consent</h3>
        <div className="rk-legal">
          <ul className="rk-statements">
            {(form.statements ?? []).map((s) => (
              <li key={s.id}>{s.text}</li>
            ))}
          </ul>
        </div>
        <button
          type="button"
          role="checkbox"
          aria-checked={draft.agreed}
          className={"rk-agree" + (draft.agreed ? " on" : "")}
          onClick={() => set({ agreed: !draft.agreed })}
        >
          <span className="rk-agree-box" aria-hidden="true">
            {draft.agreed && <Check className="ic" />}
          </span>
          {form.agreeLabel}
        </button>
      </div>
    </>
  );
}

/**
 * The customer's side of the paper form, one step at a time in paper order:
 * details → medical → client information + consent → signature. `initialStep`
 * and `initialDraft` let the flow (and tests) open it part-way.
 */
export function ConsentScreen({
  session,
  artist,
  onNext,
  onBack,
  initialStep = "details",
  initialDraft: start,
}: {
  session: BoardSession;
  artist: BoardArtist | undefined;
  onNext: (draft: ConsentDraft) => void;
  onBack: () => void;
  initialStep?: ConsentStep;
  initialDraft?: ConsentDraft;
}) {
  const [step, setStep] = useState<ConsentStep>(initialStep);
  const [draft, setDraft] = useState<ConsentDraft>(
    () => start ?? initialDraft(session),
  );
  const [signed, setSigned] = useState(false);
  const padApi = useRef<SignaturePadApi>({ getDataUrl: () => null }).current;
  const bodyRef = useRef<HTMLDivElement>(null);

  const set = (patch: Partial<ConsentDraft>) =>
    setDraft((d) => ({ ...d, ...patch }));
  const at = CONSENT_STEPS.findIndex((s) => s.id === step);
  const problem = stepProblem(step, draft, signed);
  const flags = flaggedQuestions(draft.answers);

  const go = (to: ConsentStep) => {
    if (to !== "sign") setSigned(false);
    setStep(to);
    bodyRef.current?.scrollTo?.({ top: 0 });
  };
  const back = () => (at === 0 ? onBack() : go(CONSENT_STEPS[at - 1].id));
  const next = () => {
    if (problem) return;
    if (step !== "sign") return go(CONSENT_STEPS[at + 1].id);
    const signature = padApi.getDataUrl();
    if (!signature) return;
    onNext({
      ...draft,
      printedName: draft.printedName.trim(),
      address: draft.address.trim(),
      postcode: draft.postcode.trim(),
      phone: draft.phone.trim(),
      email: draft.email.trim(),
      medicalNotes: draft.medicalNotes.trim(),
      signature,
    });
  };

  return (
    <div className="rk-screen">
      <div className="rk-screen-head">
        <button className="rk-back" onClick={back}>
          <ArrowLeft className="ic" />
          Back
        </button>
        <div>
          <div className="rk-screen-title">
            Client consent form, {session.customerName.split(" ")[0]}
          </div>
          <div className="rk-screen-sub">
            {session.type === "consult" ? "Consultation" : "Tattoo session"}
            {artist ? ` with ${artist.name}` : ""} · {hhmm(session.start)}–
            {hhmm(session.end)}
          </div>
        </div>
      </div>
      <StepDots step={step} />
      <div className="rk-screen-body" ref={bodyRef}>
        <div className="rk-consent">
          {step === "details" && (
            <>
              <div className="rk-consent-intro">
                <ShieldCheck className="ic" />
                <p style={{ margin: 0, fontSize: 16 }}>
                  This is your consent form — it keeps you safe and it&rsquo;s
                  required before any needle comes out. Answer honestly; nothing
                  here is a problem, it just helps your artist look after you.
                </p>
              </div>
              <DetailsStep draft={draft} set={set} />
            </>
          )}
          {step === "medical" && <MedicalStep draft={draft} set={set} />}
          {step === "medical" && flags.length > 0 && (
            <div className="rk-flag">
              <AlertTriangle className="ic" />
              <span>
                No problem — just have a quick word with your artist about{" "}
                {flags.length === 1 ? "that answer" : "those answers"} before
                your session starts.
              </span>
            </div>
          )}
          {step === "consent" && <AgreementStep draft={draft} set={set} />}
          {step === "sign" && (
            <div className="rk-sign">
              <span className="rk-sign-label">
                Client signature — {draft.printedName.trim()}
              </span>
              <SignaturePad onChange={setSigned} api={padApi} />
              <p className="rk-sign-date">
                Date: <b>{signedDate()}</b>
              </p>
            </div>
          )}

          <div className="rk-consent-foot">
            <button
              className="btn btn-lg"
              disabled={problem != null}
              onClick={next}
            >
              {step === "sign" ? (
                <Check className="ic" />
              ) : (
                <ArrowRight className="ic" />
              )}
              {problem ?? stepNextLabel(step)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Artist step
// ---------------------------------------------------------------------------

/** Booking style + placement as the design/placement prefill. */
export function designPlacementFor(
  session: Pick<BoardSession, "style" | "placement">,
): string {
  return [session.style, session.placement]
    .map((v) => v?.trim())
    .filter(Boolean)
    .join(" · ");
}

/** What still stops the artist completing check-in, or null. */
export function artistProblem(
  d: Omit<ArtistDraft, "artistSignature">,
  signed: boolean,
): string | null {
  if (!d.artistId) return "Pick the artist";
  if (!d.idType) return "ID must be checked before the session";
  if (!idProvidedText(d.idType, d.idOther)) return "Say what ID was provided";
  if (!signed) return "Artist signature needed";
  return null;
}

/**
 * The artist's half of the paper form, shown once the staff gate is passed:
 * studio (fixed), artist, ID provided, design/placement, then the artist's
 * signature. Check-in completes when they sign.
 */
export function ArtistForm({
  session,
  draft,
  artists,
  onSubmit,
}: {
  session: BoardSession;
  draft: ConsentDraft;
  artists: BoardArtist[];
  onSubmit: (artist: ArtistDraft) => Promise<CheckinResult>;
}) {
  const [artistId, setArtistId] = useState(session.artistId);
  const [idType, setIdType] = useState("");
  const [idOther, setIdOther] = useState("");
  const [designPlacement, setDesignPlacement] = useState(() =>
    designPlacementFor(session),
  );
  const [signed, setSigned] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const padApi = useRef<SignaturePadApi>({ getDataUrl: () => null }).current;

  const age = ageOn(draft.dob);
  const flags = flaggedQuestions(draft.answers);
  const problem = artistProblem(
    { artistId, idType, idOther, designPlacement },
    signed,
  );
  // The booking's artist first, then whoever is on the floor.
  const staff = [...artists].sort(
    (a, b) =>
      Number(b.id === session.artistId) - Number(a.id === session.artistId) ||
      Number(b.checkedIn) - Number(a.checkedIn),
  );
  const signer = artists.find((a) => a.id === artistId);

  const submit = async () => {
    const artistSignature = padApi.getDataUrl();
    if (problem || !artistSignature) return;
    setBusy(true);
    setError(null);
    const res = await safeAction(() =>
      onSubmit({
        artistId,
        idType,
        idOther: idType === "other" ? idOther.trim() : "",
        designPlacement: designPlacement.trim(),
        artistSignature,
      }),
    );
    if (!res.ok) {
      setError(res.error);
      setBusy(false);
    }
  };

  return (
    <div className="rk-consent">
      <div className="rk-consent-intro">
        <IdCard className="ic" />
        <p style={{ margin: 0, fontSize: 16 }}>
          <b>{draft.printedName}</b> · born {longDate(draft.dob)}
          {age != null ? ` (${age})` : ""}. Check their photo ID matches, then
          complete the artist&rsquo;s half of the form.
        </p>
      </div>
      {age != null && age < MIN_TATTOO_AGE && (
        <div className="rk-flag" role="alert">
          <AlertTriangle className="ic" />
          <span>
            Under {MIN_TATTOO_AGE} — no tattoo today. A consultation is fine.
          </span>
        </div>
      )}
      {flags.length > 0 && (
        <div className="rk-flag">
          <AlertTriangle className="ic" />
          <span>
            {flags.length} answer{flags.length === 1 ? "" : "s"} to talk
            through: {flags.map((f) => f.q).join(" · ")}
            {draft.medicalNotes ? ` — “${draft.medicalNotes}”` : ""}
          </span>
        </div>
      )}

      <dl className="rk-facts">
        <div>
          <dt>Tattoo studio</dt>
          <dd>{CONSENT_STUDIO_NAME}</dd>
        </div>
      </dl>

      <div className="rk-consent-section">
        <h3 className="rk-consent-h">Artist</h3>
        <div className="rk-artist-row">
          {staff.map((a) => (
            <button
              key={a.id}
              className={"rk-artist-pick " + (artistId === a.id ? "on" : "")}
              aria-pressed={artistId === a.id}
              disabled={busy}
              onClick={() => setArtistId(a.id)}
            >
              <ArtistAvatar artist={a} size={32} />
              {a.name}
            </button>
          ))}
        </div>
      </div>

      <div className="rk-consent-section">
        <h3 className="rk-consent-h">ID provided</h3>
        <p className="rk-consent-note">
          ID must be checked before the session.
        </p>
        <div className="rk-choice-row" role="group" aria-label="ID provided">
          {ID_TYPES.map((t) => (
            <button
              key={t.id}
              className={"rk-choice " + (idType === t.id ? "on" : "")}
              aria-pressed={idType === t.id}
              disabled={busy}
              onClick={() => setIdType(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        {idType === "other" && (
          <Field id="rk-id-other" label="What ID was provided?">
            <input
              id="rk-id-other"
              className="input rk-input"
              value={idOther}
              maxLength={CONSENT_FIELD_MAX.idOther}
              autoComplete="off"
              onChange={(e) => setIdOther(e.target.value)}
            />
          </Field>
        )}
      </div>

      <div className="rk-consent-section">
        <Field id="rk-design" label="Design/placement">
          <input
            id="rk-design"
            className="input rk-input"
            value={designPlacement}
            maxLength={CONSENT_FIELD_MAX.designPlacement}
            autoComplete="off"
            onChange={(e) => setDesignPlacement(e.target.value)}
          />
        </Field>
      </div>

      <div className="rk-sign">
        <span className="rk-sign-label">
          Artist signature{signer ? ` — ${signer.name}` : ""}
        </span>
        <SignaturePad onChange={setSigned} api={padApi} />
        <p className="rk-sign-date">
          Date: <b>{signedDate()}</b>
        </p>
      </div>

      {error && (
        <div className="rk-flag" role="alert">
          <AlertTriangle className="ic" />
          <span>{error}</span>
        </div>
      )}

      <div className="rk-consent-foot">
        <button
          className="btn btn-lg"
          disabled={problem != null || busy}
          onClick={submit}
        >
          <Check className="ic" />
          {busy ? "Checking in…" : (problem ?? "Sign & check in")}
        </button>
      </div>
    </div>
  );
}

/**
 * Staff/artist step after the customer signs: the tablet goes to the artist,
 * the staff unlock (PIN, or hold when no PIN is set) opens their half of the
 * form, and signing it submits the check-in. The customer's form stays
 * mounted underneath, so Back returns to it untouched.
 */
export function ArtistScreen({
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
  onSubmit: (artist: ArtistDraft) => Promise<CheckinResult>;
  onBack: () => void;
}) {
  const [unlocked, setUnlocked] = useState(false);
  return (
    <div className="rk-screen">
      <div className="rk-screen-head">
        <button className="rk-back" onClick={onBack}>
          <ArrowLeft className="ic" />
          Back
        </button>
        <div>
          <div className="rk-screen-title">Over to your artist</div>
          <div className="rk-screen-sub">
            Thanks {session.customerName.split(" ")[0]} — pass the tablet to
            your artist to check your ID and sign their part of the form.
          </div>
        </div>
      </div>
      <div className="rk-screen-body">
        {unlocked ? (
          <ArtistForm
            session={session}
            draft={draft}
            artists={artists}
            onSubmit={onSubmit}
          />
        ) : (
          <div className="rk-consent">
            <div className="rk-consent-intro">
              <IdCard className="ic" />
              <p style={{ margin: 0, fontSize: 16 }}>
                Staff only — ID must be checked before the session.
              </p>
            </div>
            <div className="rk-idcheck-unlock">
              <StaffUnlock
                pinConfigured={pinConfigured}
                onVerifyPin={onVerifyPin}
                holdLabel="Hold to open the artist's part"
                onUnlocked={() => setUnlocked(true)}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Customer arrival flow: pick your session → consent form (details, medical,
 * consent, signature) → artist's half behind the staff gate → done.
 * Auto-exits from the done screen so the kiosk returns to the board for the
 * next person.
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
  const [stage, setStage] = useState<"pick" | "consent" | "artist" | "done">(
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

  if ((stage === "consent" || stage === "artist") && picked) {
    return (
      <>
        <ConsentScreen
          session={picked}
          artist={artistOf(picked)}
          onBack={() => setStage("pick")}
          onNext={(d) => {
            setDraft(d);
            setStage("artist");
          }}
        />
        {stage === "artist" && draft && (
          <ArtistScreen
            session={picked}
            draft={draft}
            artists={artists}
            pinConfigured={pinConfigured}
            onVerifyPin={onVerifyPin}
            onBack={() => setStage("consent")}
            onSubmit={async (artist) => {
              const result = await onCheckin({
                ...draft,
                ...artist,
                bookingId: picked.id,
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
              ? ", and your artist will have a quick word before you start"
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
