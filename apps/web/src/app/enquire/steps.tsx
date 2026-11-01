"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Chip, Field } from "@/components/site";
import {
  AVAILABILITY,
  BUDGET_PRESETS,
  buildConsultMonth,
  CONSULT_TIMES,
  DAYS,
  PLACEMENTS,
  SIZES,
  toggleStyle,
  type DayChoice,
  type SizeChoice,
  type WizardFlash,
  type WizardState,
} from "./logic";
import { formatPence } from "../_format";
import { MoodboardRefs } from "./MoodboardRefs";
import styles from "./enquire.module.css";

export interface WizardArtist {
  id: string;
  name: string;
  role: string;
  booksStatus: "open" | "limited" | "closed";
}

type Set = (patch: Partial<WizardState>) => void;

export function ArtistStep({
  artists,
  value,
  onPick,
  lockedTo,
}: {
  artists: WizardArtist[];
  value: string | null;
  onPick: (id: string | null) => void;
  /** Flash claims lock the step to the design's artist. */
  lockedTo?: WizardArtist | null;
}) {
  if (lockedTo) {
    return (
      <div>
        <h2 className={styles.panelTitle}>Your artist</h2>
        <p className={styles.panelSub}>
          Flash designs are tattooed by the artist who drew them, so this one is
          with {lockedTo.name.split(" ")[0]}.
        </p>
        <div className={styles.choiceGrid}>
          <div className={`${styles.choice} ${styles.on}`} aria-current="true">
            <span className={styles.choiceName}>{lockedTo.name}</span>
            <span className={styles.choiceMeta}>
              {lockedTo.role} · books {lockedTo.booksStatus}
            </span>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div>
      <h2 className={styles.panelTitle}>Pick your artist</h2>
      <p className={styles.panelSub}>
        Choose a resident artist, or let Inkling match you.
      </p>
      <div className={styles.choiceGrid}>
        <button
          type="button"
          className={`${styles.choice} ${value === null ? styles.on : ""}`}
          onClick={() => onPick(null)}
        >
          <span className={styles.choiceName}>No preference</span>
          <span className={styles.choiceMeta}>Match me to an artist</span>
        </button>
        {artists.map((a) => (
          <button
            key={a.id}
            type="button"
            className={`${styles.choice} ${value === a.id ? styles.on : ""}`}
            onClick={() => onPick(a.id)}
          >
            <span className={styles.choiceName}>{a.name}</span>
            <span className={styles.choiceMeta}>
              {a.role} · books {a.booksStatus}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function IdeaStep({
  styleOptions,
  state,
  set,
  flash,
}: {
  styleOptions: string[];
  state: WizardState;
  set: Set;
  /** On a flash claim the design is drawn: only placement (+ notes) is asked. */
  flash?: WizardFlash;
}) {
  if (flash) {
    return (
      <div>
        <h2 className={styles.panelTitle}>Where&rsquo;s it going?</h2>
        <p className={styles.panelSub}>
          {flash.title} is already drawn
          {flash.size ? ` at ${flash.size}` : ""} — just tell us where you want
          it and anything we should know. Both optional.
        </p>
        <Field label="Placement" htmlFor="placement">
          <select
            id="placement"
            className="select"
            value={state.placement}
            onChange={(e) => set({ placement: e.target.value })}
          >
            <option value="">Choose a placement</option>
            {PLACEMENTS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Notes (optional)" htmlFor="subject">
          <textarea
            id="subject"
            className="textarea"
            rows={3}
            placeholder="Any tweaks, colour preferences or questions…"
            value={state.subject}
            onChange={(e) => set({ subject: e.target.value })}
          />
        </Field>
      </div>
    );
  }
  return (
    <div>
      <h2 className={styles.panelTitle}>Your idea</h2>
      <p className={styles.panelSub}>
        Pick up to 3 styles and tell us a little about the piece.
      </p>
      <Field label="Styles (up to 3)">
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
      <Field label="Subject" htmlFor="subject">
        <textarea
          id="subject"
          className="textarea"
          rows={3}
          placeholder="A fine-line peony wrapping the forearm…"
          value={state.subject}
          onChange={(e) => set({ subject: e.target.value })}
        />
      </Field>
      <Field label="Placement" htmlFor="placement">
        <select
          id="placement"
          className="select"
          value={state.placement}
          onChange={(e) => set({ placement: e.target.value })}
        >
          <option value="">Choose a placement</option>
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
              onClick={() => set({ size: sz as SizeChoice })}
            >
              {sz}
            </Chip>
          ))}
        </div>
      </Field>
    </div>
  );
}

export function MoodStep({
  refs,
  onChange,
}: {
  refs: string[];
  onChange: (refs: string[]) => void;
}) {
  return (
    <div>
      <h2 className={styles.panelTitle}>Mood board</h2>
      <p className={styles.panelSub}>
        Paste links to references so your artist knows the look you&rsquo;re
        after. We never copy another person&rsquo;s tattoo.
      </p>
      <MoodboardRefs refs={refs} onChange={onChange} idPrefix="enq-moodref" />
    </div>
  );
}

export function ConsultStep({
  state,
  set,
  month,
  monthLabel,
  onShiftMonth,
}: {
  state: WizardState;
  set: Set;
  month: ReturnType<typeof buildConsultMonth>;
  monthLabel: string;
  onShiftMonth: (d: number) => void;
}) {
  function toggleDay(d: DayChoice) {
    set({
      days: state.days.includes(d)
        ? state.days.filter((x) => x !== d)
        : [...state.days, d],
    });
  }
  return (
    <div>
      <h2 className={styles.panelTitle}>Free consultation</h2>
      <p className={styles.panelSub}>
        Tell us when suits, then pick a free 15-minute slot (Tue&ndash;Sat).
      </p>
      <Field label="General availability">
        <div className={styles.chipRow}>
          {AVAILABILITY.map((a) => (
            <Chip
              key={a}
              on={state.availability === a}
              onClick={() => set({ availability: a })}
            >
              {a}
            </Chip>
          ))}
        </div>
      </Field>
      <Field label="Preferred days (optional)">
        <div className={styles.chipRow}>
          {DAYS.map((d) => (
            <Chip
              key={d}
              gold
              on={state.days.includes(d)}
              onClick={() => toggleDay(d)}
            >
              {d}
            </Chip>
          ))}
        </div>
      </Field>

      <div className={styles.calHead}>
        <button
          type="button"
          className="icon-btn"
          aria-label="Previous month"
          onClick={() => onShiftMonth(-1)}
        >
          <ChevronLeft className="ic" />
        </button>
        <strong>{monthLabel}</strong>
        <button
          type="button"
          className="icon-btn"
          aria-label="Next month"
          onClick={() => onShiftMonth(1)}
        >
          <ChevronRight className="ic" />
        </button>
      </div>
      <div className={styles.calGrid}>
        {month.map((d) => {
          const bookable = d.status !== "full";
          return (
            <button
              key={d.iso}
              type="button"
              className={`${styles.calDay} ${
                state.consultDate === d.iso ? styles.on : ""
              }`}
              disabled={!bookable}
              onClick={() => set({ consultDate: d.iso, consultTime: null })}
              title={d.iso}
            >
              {d.day}
              {bookable && (
                <span
                  className={`${styles.dot} ${
                    d.status === "limited" ? styles.dotLimited : styles.dotOpen
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>
      {state.consultDate && (
        <div className={styles.slotRow}>
          {CONSULT_TIMES.map((t) => (
            <Chip
              key={t}
              on={state.consultTime === t}
              onClick={() => set({ consultTime: t })}
            >
              {t}
            </Chip>
          ))}
        </div>
      )}
    </div>
  );
}

export function DetailsStep({ state, set }: { state: WizardState; set: Set }) {
  return (
    <div>
      <h2 className={styles.panelTitle}>Your details</h2>
      <p className={styles.panelSub}>
        So we can get back to you. No deposit, no payment.
      </p>
      <Field label="Name" htmlFor="name">
        <input
          id="name"
          className="input"
          value={state.name}
          onChange={(e) => set({ name: e.target.value })}
        />
      </Field>
      <Field label="Phone" htmlFor="phone">
        <input
          id="phone"
          className="input"
          inputMode="tel"
          value={state.phone}
          onChange={(e) => set({ phone: e.target.value })}
        />
      </Field>
      <Field
        label="Email"
        htmlFor="email"
        hint="We'll send a confirmation here."
      >
        <input
          id="email"
          className="input"
          type="email"
          value={state.email}
          onChange={(e) => set({ email: e.target.value })}
        />
      </Field>
      <Field
        label="Rough budget (£, optional)"
        htmlFor="budget"
        hint="A ballpark helps your artist size the piece — never a commitment."
      >
        <input
          id="budget"
          className="input"
          inputMode="decimal"
          placeholder="e.g. 150"
          value={state.budget}
          onChange={(e) => set({ budget: e.target.value })}
        />
        <div className={styles.chipRow} style={{ marginTop: 8 }}>
          {BUDGET_PRESETS.map((b) => (
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
      <Field label="Anything else?" htmlFor="notes">
        <textarea
          id="notes"
          className="textarea"
          rows={3}
          value={state.notes}
          onChange={(e) => set({ notes: e.target.value })}
        />
      </Field>
    </div>
  );
}

export function Summary({
  state,
  artists,
  flash,
}: {
  state: WizardState;
  artists: WizardArtist[];
  flash?: WizardFlash;
}) {
  const artist = artists.find((a) => a.id === state.artistId);
  return (
    <aside className={styles.aside}>
      <strong>{flash ? "Your flash claim" : "Your enquiry"}</strong>
      <dl>
        {flash && (
          <>
            <dt>Flash</dt>
            <dd>
              {flash.title}
              {flash.pricePence != null &&
                ` · ${formatPence(flash.pricePence)}`}
              {flash.size && ` · ${flash.size}`}
            </dd>
          </>
        )}
        <dt>Artist</dt>
        <dd>{artist ? artist.name : "Match me"}</dd>
        {state.styles.length > 0 && (
          <>
            <dt>Styles</dt>
            <dd>{state.styles.join(", ")}</dd>
          </>
        )}
        {state.placement && (
          <>
            <dt>Placement</dt>
            <dd>{state.placement}</dd>
          </>
        )}
        {state.size && (
          <>
            <dt>Size</dt>
            <dd>{state.size}</dd>
          </>
        )}
        {state.consultDate && (
          <>
            <dt>Consult</dt>
            <dd>
              {state.consultDate}
              {state.consultTime ? ` · ${state.consultTime}` : ""}
            </dd>
          </>
        )}
        {state.moodboard.length > 0 && (
          <>
            <dt>References</dt>
            <dd>{state.moodboard.length} attached</dd>
          </>
        )}
      </dl>
    </aside>
  );
}
