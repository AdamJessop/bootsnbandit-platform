/** Healing-tracker logic (unit-tested), used by the aftercare island. */

export interface StageRange {
  order: number;
  minDay: number;
  maxDay: number | null;
}

/**
 * Given the ordered stage day-ranges and a "days since" value, return the
 * `order` of the matching stage. Days <1 clamp to the first stage; days past
 * the last range fall into the open-ended final stage.
 */
export function stageForDay(stages: StageRange[], day: number): number {
  if (stages.length === 0) return 0;
  const d = Math.max(1, day);
  for (const s of stages) {
    if (d >= s.minDay && (s.maxDay == null || d <= s.maxDay)) {
      return s.order;
    }
  }
  // Past every bounded range → the last stage.
  return stages[stages.length - 1].order;
}

/**
 * Percentage width of the track's progress line: the fraction of the way
 * from the first node to the active one (0 for the first, 100 for the last).
 */
export function trackProgress(nodeCount: number, activeIndex: number): number {
  if (nodeCount <= 1) return 0;
  const i = Math.min(Math.max(activeIndex, 0), nodeCount - 1);
  return Math.round((i / (nodeCount - 1)) * 100);
}

export interface StageTitleParts {
  /** e.g. "Day 1–2" — shown under the track node. */
  day: string;
  /** e.g. "Fresh & wrapped" — the stage heading. */
  name: string;
}

/**
 * Seeded stage titles are "Day 1–2 · Fresh & wrapped". Split on the middle
 * dot; a title without one is used as both the node label and the heading.
 */
export function splitStageTitle(title: string): StageTitleParts {
  const idx = title.indexOf("·");
  if (idx === -1) {
    const t = title.trim();
    return { day: t, name: t };
  }
  const day = title.slice(0, idx).trim();
  const name = title.slice(idx + 1).trim();
  return { day: day || name, name: name || day };
}

export interface StageBodyParts {
  /** Care instructions, one per bullet. */
  care: string[];
  /** "How it feels" copy, or null when the body has no such section. */
  feel: string | null;
}

const CARE_RE = /^\s*care:\s*/i;
const FEEL_RE = /\bhow it feels:\s*/i;

/**
 * Seeded bodies read "Care: a; b; c. How it feels: d." — split them into the
 * care bullets and the feel copy the design lays out in two columns. Anything
 * that doesn't follow the pattern becomes a single care paragraph.
 */
export function parseStageBody(body: string): StageBodyParts {
  const feelIdx = body.search(FEEL_RE);
  let careText = feelIdx === -1 ? body : body.slice(0, feelIdx);
  let feel: string | null = null;
  if (feelIdx !== -1) {
    const f = body.slice(feelIdx).replace(FEEL_RE, "").trim();
    feel = f ? f.charAt(0).toUpperCase() + f.slice(1) : null;
  }
  careText = careText.replace(CARE_RE, "").trim();
  const care = careText
    .split(";")
    .map((c) => c.trim().replace(/\.$/, "").trim())
    .filter(Boolean)
    .map((c) => c.charAt(0).toUpperCase() + c.slice(1) + ".");
  return { care, feel };
}
