"use client";

import { Chip, Field } from "@/components/site";
import type { InklingArtist } from "../InklingTabs";
import { PLACEMENTS, SIZES, type BuilderState, type Set } from "./logic";
import type { SizeChoice } from "../../enquire/logic";
import styles from "../../enquire/enquire.module.css";

const BUDGETS = [80, 150, 300, 500];

export function DetailsStep({
  state,
  set,
  artists,
}: {
  state: BuilderState;
  set: Set;
  artists: InklingArtist[];
}) {
  return (
    <div>
      <h2 className={styles.panelTitle}>The details</h2>
      <p className={styles.panelSub}>
        Roughly where and how big — all optional, all helpful.
      </p>
      <Field label="Placement" htmlFor="mb-placement">
        <select
          id="mb-placement"
          className="select"
          value={state.placement}
          onChange={(e) => set({ placement: e.target.value })}
        >
          <option value="">Not sure yet</option>
          {PLACEMENTS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Rough size">
        <div className={styles.chipRow}>
          {SIZES.map((sz) => (
            <Chip
              key={sz}
              gold
              on={state.size === sz}
              onClick={() =>
                set({ size: state.size === sz ? "" : (sz as SizeChoice) })
              }
            >
              {sz}
            </Chip>
          ))}
        </div>
      </Field>
      <Field
        label="Rough budget (£, optional)"
        htmlFor="mb-budget"
        hint="A ballpark helps your artist size the piece — never a commitment."
      >
        <input
          id="mb-budget"
          className="input"
          inputMode="decimal"
          placeholder="e.g. 150"
          value={state.budget}
          onChange={(e) => set({ budget: e.target.value })}
        />
        <div className={styles.chipRow} style={{ marginTop: 8 }}>
          {BUDGETS.map((b) => (
            <Chip
              key={b}
              gold
              on={state.budget === String(b)}
              onClick={() => set({ budget: String(b) })}
            >
              £{b}
            </Chip>
          ))}
        </div>
      </Field>
      <Field label="Artist">
        <div className={styles.choiceGrid}>
          <button
            type="button"
            className={`${styles.choice} ${state.artistId === null ? styles.on : ""}`}
            onClick={() => set({ artistId: null })}
          >
            <span className={styles.choiceName}>No preference</span>
            <span className={styles.choiceMeta}>Let the studio decide</span>
          </button>
          {artists.map((a) => (
            <button
              key={a.id}
              type="button"
              className={`${styles.choice} ${state.artistId === a.id ? styles.on : ""}`}
              onClick={() => set({ artistId: a.id })}
            >
              <span className={styles.choiceName}>{a.name}</span>
              <span className={styles.choiceMeta}>
                {a.role} · books {a.booksStatus}
              </span>
            </button>
          ))}
        </div>
      </Field>
      <Field label="Anything else?" htmlFor="mb-notes">
        <textarea
          id="mb-notes"
          className="textarea"
          rows={3}
          maxLength={1000}
          value={state.notes}
          onChange={(e) => set({ notes: e.target.value })}
        />
      </Field>
    </div>
  );
}
