"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import {
  buildConsultMonth,
  buildEnquiryPayload,
  canAdvance,
  emptyWizardState,
  resolveSeedArtist,
  STEPS,
  successCopy,
  waitlistNote,
  type WizardFlash,
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
  /** Set when claiming a flash design: locks the artist + posts /api/flash. */
  flash?: WizardFlash;
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
  flash,
}: Props) {
  // A flash design is tattooed by whoever drew it, so the artist step is
  // locked to that artist (when they're still on the roster).
  const lockedArtist = flash
    ? resolveSeedArtist(artists, flash.artistId)
    : null;
  const [stepIdx, setStepIdx] = useState(0);
  const [state, setState] = useState<WizardState>(() => ({
    ...emptyWizardState(),
    artistId: lockedArtist?.id ?? seedArtistId ?? null,
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
  const advanceOk = canAdvance(step, state, { flash: !!flash });

  function next() {
    if (!advanceOk) return;
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
      const url = flash ? "/api/flash" : "/api/enquiries";
      const body = flash
        ? {
            flashId: flash.id,
            contactName: payload.contactName,
            contactEmail: payload.contactEmail,
            contactPhone: payload.contactPhone,
            placement: payload.placement,
            // Only honoured server-side when the design has no artist.
            preferredArtistId: payload.preferredArtistId,
          }
        : payload;
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(
          data.error ?? "Something went wrong. Please try again.",
        );
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
    const copy = successCopy(state, flash);
    return (
      <div className={styles.successWrap} role="status">
        <div className={styles.orb}>
          <Check />
        </div>
        <h1 className="display page-title">{copy.heading}</h1>
        <p className="lead">{copy.lead}</p>
        <p className="meta">{copy.next}</p>
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
                lockedTo={lockedArtist}
              />
              {waitNote && (
                <p className="meta" role="status" style={{ marginTop: 12 }}>
                  {waitNote}
                </p>
              )}
            </>
          )}
          {step === "Idea" && (
            <IdeaStep
              styleOptions={styleOptions}
              state={state}
              set={set}
              flash={flash}
            />
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
                disabled={submitting || !advanceOk}
              >
                {submitting ? "Sending…" : "Send enquiry"}
              </button>
            ) : (
              <button
                type="button"
                className="btn"
                onClick={next}
                disabled={!advanceOk}
              >
                Continue <ArrowRight className="ic" />
              </button>
            )}
          </div>
        </div>

        <Summary state={state} artists={artists} flash={flash} />
      </div>
    </div>
  );
}
