/** Healing-tracker stage selection (unit-tested), used by the aftercare island. */

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
