"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import {
  buildConsultMonth,
  buildEnquiryPayload,
  canAdvance,
  emptyWizardState,
  STEPS,
  waitlistNote,
  type WizardState,
} from "./logic";
import {
  ArtistStep,
  ConsultStep,
  DetailsStep,
  IdeaStep,
  MoodStep,
  Summary,
  type WizardArtist,
} from "./steps";
import styles from "./enquire.module.css";

export type { WizardArtist };

interface Props {
  artists: WizardArtist[];
  styleOptions: string[];
  /** Query seeds. */
  seedArtistId?: string;
  seedStyles?: string[];
  flashId?: string;
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function EnquireWizard({
  artists,
  styleOptions,
  seedArtistId,
  seedStyles,
  flashId,
}: Props) {
  const [stepIdx, setStepIdx] = useState(0);
  const [state, setState] = useState<WizardState>(() => ({
    ...emptyWizardState(),
    artistId: seedArtistId ?? null,
    styles: seedStyles ?? [],
  }));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const today = useMemo(() => new Date(), []);
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const month = useMemo(
    () => buildConsultMonth(calYear, calMonth, today),
    [calYear, calMonth, today],
  );

  const step = STEPS[stepIdx];
  const set = (patch: Partial<WizardState>) =>
    setState((s) => ({ ...s, ...patch }));

  function next() {
    if (!canAdvance(step, state)) return;
    if (stepIdx < STEPS.length - 1) setStepIdx(stepIdx + 1);
  }
  function back() {
    if (stepIdx > 0) setStepIdx(stepIdx - 1);
  }

  function shiftMonth(delta: number) {
    let m = calMonth + delta;
    let y = calYear;
    if (m < 0) {
      m = 11;
      y -= 1;
    } else if (m > 11) {
      m = 0;
      y += 1;
    }
    setCalMonth(m);
    setCalYear(y);
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const payload = buildEnquiryPayload(state);
      // If this enquiry came from a flash claim, route through /api/flash so
      // availability is decremented + the enquiry is tagged source=flash.
      const url = flashId ? "/api/flash" : "/api/enquiries";
      const body = flashId
        ? {
            flashId,
            contactName: payload.contactName,
            contactEmail: payload.contactEmail,
            contactPhone: payload.contactPhone,
            placement: payload.placement,
          }
        : payload;
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Something went wrong. Please try again.");
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // Waitlist note for closed-books artists (e.g. seeded via ?artist=…&wait=1):
  // the enquiry still sends, it just joins the waitlist.
  const selectedArtist = artists.find((a) => a.id === state.artistId) ?? null;
  const waitNote = waitlistNote(selectedArtist);

  if (done) {
    const consultLabel =
      state.consultDate && state.consultTime
        ? `${state.consultDate} at ${state.consultTime} (to be confirmed)`
        : "We'll be in touch to arrange your free 15-minute consult.";
    return (
      <div className={styles.successWrap}>
        <div className={styles.orb}>
          <Check />
        </div>
        <h1 className="display">Enquiry sent</h1>
        <p className="lead">
          Thanks {state.name.split(" ")[0] || "—"}. {consultLabel}
        </p>
        {state.moodboard.length > 0 && (
          <p className="meta">
            {state.moodboard.length} reference
            {state.moodboard.length === 1 ? "" : "s"} attached.
          </p>
        )}
      </div>
    );
  }

  return (
    <div>
      <ol className={styles.stepper}>
        {STEPS.map((s, i) => (
          <li
            key={s}
            className={`${styles.step} ${
              i === stepIdx ? styles.active : i < stepIdx ? styles.done : ""
            }`}
          >
            <span className={styles.stepNum}>
              {i < stepIdx ? <Check size={12} /> : i + 1}
            </span>
            {s}
          </li>
        ))}
      </ol>

      <div className={styles.cols}>
        <div className={styles.panel}>
          {step === "Artist" && (
            <>
              <ArtistStep
                artists={artists}
                value={state.artistId}
                onPick={(id) => set({ artistId: id })}
              />
              {waitNote && (
                <p className="meta" role="status" style={{ marginTop: 12 }}>
                  {waitNote}
                </p>
              )}
            </>
          )}
          {step === "Idea" && (
            <IdeaStep styleOptions={styleOptions} state={state} set={set} />
          )}
          {step === "Mood board" && (
            <MoodStep
              refs={state.moodboard}
              onChange={(moodboard) => set({ moodboard })}
            />
          )}
          {step === "Consultation" && (
            <ConsultStep
              state={state}
              set={set}
              month={month}
              monthLabel={`${MONTHS[calMonth]} ${calYear}`}
              onShiftMonth={shiftMonth}
            />
          )}
          {step === "Details" && <DetailsStep state={state} set={set} />}

          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.nav}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={back}
              disabled={stepIdx === 0}
            >
              <ArrowLeft className="ic" /> Back
            </button>
            {step === "Details" ? (
              <button
                type="button"
                className="btn"
                onClick={submit}
                disabled={submitting || !canAdvance(step, state)}
              >
                {submitting ? "Sending…" : "Send enquiry"}
              </button>
            ) : (
              <button
                type="button"
                className="btn"
                onClick={next}
                disabled={!canAdvance(step, state)}
              >
                Continue <ArrowRight className="ic" />
              </button>
            )}
          </div>
        </div>

        <Summary state={state} artists={artists} flashId={flashId} />
      </div>
    </div>
  );
}
