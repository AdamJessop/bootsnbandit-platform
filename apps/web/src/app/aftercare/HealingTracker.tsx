"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import {
  parseStageBody,
  splitStageTitle,
  stageForDay,
  trackProgress,
  type StageRange,
} from "./logic";
import styles from "./aftercare.module.css";

export interface AftercareStageProp {
  order: number;
  title: string;
  body: string;
  hue: string | null;
}

/** Day-range per seeded stage order (matches COMPOSITION-NOTES healing stages). */
const RANGES: StageRange[] = [
  { order: 0, minDay: 1, maxDay: 2 },
  { order: 1, minDay: 3, maxDay: 6 },
  { order: 2, minDay: 7, maxDay: 14 },
  { order: 3, minDay: 15, maxDay: 30 },
  { order: 4, minDay: 31, maxDay: null },
];

const HUE_VAR: Record<string, string> = {
  crimson: "var(--bb-crimson)",
  gold: "var(--bb-gold)",
  teal: "var(--bb-teal)",
  moss: "#6f8f4a",
};

/**
 * Client island: the healing tracker from the design. A "days since" input
 * drives a node track (past nodes gold, the current one crimson, a gradient
 * progress line between them); each node is also a button that jumps the
 * tracker to that stage. Below, the active stage's care steps and "how it
 * feels" copy sit side by side. Stage→day mapping and body parsing are
 * unit-tested in `./logic`.
 */
export function HealingTracker({ stages }: { stages: AftercareStageProp[] }) {
  const [day, setDay] = useState<number>(2);
  const ordered = [...stages].sort((a, b) => a.order - b.order);
  const activeOrder = stageForDay(RANGES, day);
  const activeIndex = Math.max(
    0,
    ordered.findIndex((s) => s.order === activeOrder),
  );
  const active = ordered[activeIndex];
  const progress = trackProgress(ordered.length, activeIndex);

  const jumpTo = (order: number) => {
    const range = RANGES.find((r) => r.order === order);
    setDay(range ? range.minDay : 1);
  };

  return (
    <div className={`card ${styles.heal}`}>
      <div className={styles.healHead}>
        <p className="muted" style={{ margin: 0, maxWidth: 520 }}>
          Tell us how long it&rsquo;s been and we&rsquo;ll show you what to
          expect &mdash; and how to look after it right now.
        </p>
        <div className={styles.healDays}>
          <label htmlFor="heal-days">Days since your tattoo</label>
          <input
            id="heal-days"
            type="number"
            min={0}
            max={365}
            value={day}
            onChange={(e) => setDay(Number(e.target.value) || 0)}
            className={`input ${styles.dayInput}`}
          />
        </div>
      </div>

      <div className={styles.healTrack} role="group" aria-label="Healing stages">
        <div className={styles.healLine} aria-hidden>
          <div style={{ width: `${progress}%` }} />
        </div>
        {ordered.map((s, i) => {
          const { day: dayLabel, name } = splitStageTitle(s.title);
          const state =
            i < activeIndex ? styles.past : i === activeIndex ? styles.on : "";
          return (
            <button
              key={s.order}
              type="button"
              className={`${styles.healNode}${state ? ` ${state}` : ""}`}
              aria-pressed={i === activeIndex}
              aria-label={`${dayLabel}: ${name}`}
              onClick={() => jumpTo(s.order)}
            >
              <span className={styles.healDot} aria-hidden />
              <span className={styles.healDay}>{dayLabel}</span>
            </button>
          );
        })}
      </div>

      {active && <StageDetail stage={active} />}
    </div>
  );
}

function StageDetail({ stage }: { stage: AftercareStageProp }) {
  const { day, name } = splitStageTitle(stage.title);
  const { care, feel } = parseStageBody(stage.body);
  const hue = HUE_VAR[stage.hue ?? ""] ?? "var(--bb-gold)";

  return (
    <div className={styles.healDetail}>
      <div>
        <span className={styles.healKicker} style={{ color: hue }}>
          {day}
        </span>
        <h3 className={styles.healTitle}>{name}</h3>
        <ul className={styles.healCare}>
          {care.map((c) => (
            <li key={c}>
              <Check className="ic" aria-hidden /> {c}
            </li>
          ))}
        </ul>
      </div>
      {feel && (
        <div className={styles.healFeel}>
          <span className={styles.healKicker}>How it feels</span>
          <p>{feel}</p>
        </div>
      )}
    </div>
  );
}
