/**
 * Pure helpers for ChartWrapper (empty detection, totals, palette). Kept apart
 * from the recharts component so they unit-test without a DOM.
 */
import type { ChartDatum } from "./ChartWrapper";

/** Accessible heritage palette (resolves to CSS custom properties, ≥5 hues). */
export const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;

/** A chart is empty when there are no data points, or all values are zero. */
export function isChartEmpty(data: ChartDatum[]): boolean {
  if (data.length === 0) return true;
  return data.every((d) => (d.value ?? 0) === 0 && (d.value2 ?? 0) === 0);
}

/** Sum of the primary value series. */
export function chartTotal(data: ChartDatum[]): number {
  return data.reduce((sum, d) => sum + (d.value ?? 0), 0);
}
