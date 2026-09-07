"use client";

import { Chip, Field } from "@/components/site";
import {
  COLOUR_OPTIONS,
  MAX_BOARD_STYLES,
  toggleStyle,
  type BuilderState,
  type Set,
} from "./logic";
import styles from "../../enquire/enquire.module.css";

export function BriefStep({
  state,
  set,
  styleOptions,
}: {
  state: BuilderState;
  set: Set;
  styleOptions: string[];
}) {
  return (
    <div>
      <h2 className={styles.panelTitle}>Your brief</h2>
      <p className={styles.panelSub}>
        Pick the styles you&rsquo;re drawn to and describe the piece.
        We&rsquo;ll use it to find inspiration.
      </p>
      <Field label={`Styles (up to ${MAX_BOARD_STYLES})`}>
        <div className={styles.chipRow}>
          {styleOptions.map((s) => (
            <Chip
              key={s}
              on={state.styles.includes(s)}
              onClick={() => set({ styles: toggleStyle(state.styles, s) })}
            >
              {s}
            </Chip>
          ))}
        </div>
      </Field>
      <Field label="Colour">
        <div className={styles.chipRow}>
          {COLOUR_OPTIONS.map((c) => (
            <Chip
              key={c.value}
              gold
              on={state.colour === c.value}
              onClick={() =>
                set({ colour: state.colour === c.value ? null : c.value })
              }
            >
              {c.label}
            </Chip>
          ))}
        </div>
      </Field>
      <Field
        label="Describe the idea"
        htmlFor="mb-description"
        hint="Subject, mood, anything you already know — a sentence is plenty."
      >
        <textarea
          id="mb-description"
          className="textarea"
          rows={3}
          maxLength={300}
          placeholder="A peony wrapping around the forearm, soft shading…"
          value={state.description}
          onChange={(e) => set({ description: e.target.value })}
        />
      </Field>
    </div>
  );
}
