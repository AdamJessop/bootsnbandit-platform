"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import type { InklingArtist } from "../InklingTabs";
import { BOARD_STEPS, buildBoardEnquiryPayload, canAdvance, emptyBuilder, type BuilderState, type Set } from "./logic";
import { BriefStep } from "./BriefStep";
import { InspirationStep } from "./InspirationStep";
import { DetailsStep } from "./DetailsStep";
import { SendStep } from "./SendStep";
import { BoardSummary } from "./BoardSummary";
import { useImageSearch } from "./useImageSearch";
import styles from "../../enquire/enquire.module.css";

/**
 * Inkling mood-board builder: Brief → Inspiration → Details → Send. Mirrors
 * the Enquire wizard's stepper/panel/aside layout; all state lives here and
 * the steps are controlled. Submits to POST /api/enquiries (source=inkling).
 */
export function MoodBoardBuilder({ artists, styleOptions }: { artists: InklingArtist[]; styleOptions: string[] }) {
  const [stepIdx, setStepIdx] = useState(0);
  const [state, setState] = useState<BuilderState>(emptyBuilder);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const search = useImageSearch();

  const step = BOARD_STEPS[stepIdx];
  const set: Set = (patch) => setState((s) => ({ ...s, ...(typeof patch === "function" ? patch(s) : patch) }));

  function next() {
    if (!canAdvance(step, state)) return;
    if (stepIdx < BOARD_STEPS.length - 1) setStepIdx(stepIdx + 1);
  }
  function back() {
    if (stepIdx > 0) setStepIdx(stepIdx - 1);
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/enquiries", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(buildBoardEnquiryPayload(state)),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Couldn't send your board. Please try again.");
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    const n = state.items.length;
    return (
      <div className={styles.successWrap}>
        <div className={styles.orb}><Check /></div>
        <h2 className="display">Board sent</h2>
        <p className="lead">
          Thanks {state.name.split(" ")[0] || "—"}. {n} image{n === 1 ? "" : "s"} on their way to the studio — we&rsquo;ll review it and be in touch.
        </p>
      </div>
    );
  }

  return (
    <div>
      <ol className={styles.stepper}>
        {BOARD_STEPS.map((s, i) => (
          <li key={s} className={`${styles.step} ${i === stepIdx ? styles.active : i < stepIdx ? styles.done : ""}`}>
            <span className={styles.stepNum}>{i < stepIdx ? <Check size={12} /> : i + 1}</span>
            {s}
          </li>
        ))}
      </ol>

      <div className={styles.cols}>
        <div className={styles.panel}>
          {step === "Brief" && <BriefStep state={state} set={set} styleOptions={styleOptions} />}
          {step === "Inspiration" && <InspirationStep state={state} set={set} search={search} />}
          {step === "Details" && <DetailsStep state={state} set={set} artists={artists} />}
          {step === "Send" && <SendStep state={state} set={set} />}

          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.nav}>
            <button type="button" className="btn btn-ghost" onClick={back} disabled={stepIdx === 0}>
              <ArrowLeft className="ic" /> Back
            </button>
            {step === "Send" ? (
              <button type="button" className="btn" onClick={submit} disabled={submitting || !canAdvance(step, state)}>
                {submitting ? "Sending…" : "Send board"}
              </button>
            ) : (
              <button type="button" className="btn" onClick={next} disabled={!canAdvance(step, state)}>
                {step === "Brief" ? "Find inspiration" : "Continue"} <ArrowRight className="ic" />
              </button>
            )}
          </div>
        </div>
        <BoardSummary state={state} artists={artists} />
      </div>
    </div>
  );
}
