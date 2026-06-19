"use client";

import { useState } from "react";
import { stageForDay, type StageRange } from "./logic";
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
 * Client island: a healing tracker. Enter "days since" → the matching stage is
 * highlighted. Stage→day mapping is unit-tested in `./logic`.
 */
export function HealingTracker({ stages }: { stages: AftercareStageProp[] }) {
  const [day, setDay] = useState<number>(2);
  const activeOrder = stageForDay(RANGES, day);

  return (
    <div className={styles.tracker}>
      <div>
        <div className={styles.trackerInput}>
          <label className="field" style={{ marginBottom: 0 }}>
            <span>Days since your tattoo</span>
            <input
              type="number"
              min={0}
              max={365}
              value={day}
              onChange={(e) => setDay(Number(e.target.value) || 0)}
              className={`input ${styles.dayInput}`}
            />
          </label>
        </div>
        <p className="muted" style={{ fontSize: 14 }}>
          Tell us how long it&rsquo;s been and we&rsquo;ll show you what to
          expect — and how to look after it right now.
        </p>
      </div>
      <div className={styles.stageList}>
        {stages.map((s) => (
          <div
            key={s.order}
            className={`${styles.stage}${s.order === activeOrder ? ` ${styles.active}` : ""}`}
          >
            <div className={styles.stageHead}>
              <span
                className={styles.stageDot}
                style={{ background: HUE_VAR[s.hue ?? ""] ?? "var(--bb-gold)" }}
                aria-hidden
              />
              <span className={styles.stageTitle}>{s.title}</span>
            </div>
            <p className={styles.stageBody}>{s.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
