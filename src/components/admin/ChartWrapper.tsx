/**
 * STUB — Chart wrapper for Reports (BACKOFHOUSE-IA I1). Wave-4 phase P11 wires
 * recharts (line/bar/donut) with accessible colours, legends, tooltips and an
 * alt data table. Renders empty/loading states from props today.
 */

export type ChartType = "line" | "bar" | "donut";

export interface ChartDatum {
  label: string;
  value: number;
  /** Optional secondary series value (e.g. capacity vs booked). */
  value2?: number;
}

export interface ChartWrapperProps {
  title: string;
  type: ChartType;
  data: ChartDatum[];
  loading?: boolean;
  /** Override the default "No data yet" empty copy. */
  emptyMessage?: string;
}

export function ChartWrapper({
  title,
  type,
  data,
  loading = false,
  emptyMessage = "No data yet.",
}: ChartWrapperProps) {
  return (
    <div className="rounded-lg border border-border-default bg-bg-card p-6">
      <p className="font-termina text-sm uppercase tracking-wide text-text-primary">
        {title}
      </p>
      <div className="mt-3 grid h-40 place-items-center text-sm text-text-muted">
        {loading
          ? "Loading…"
          : data.length === 0
            ? emptyMessage
            : `${type} chart · ${data.length} point(s) — renders in Phase 11`}
      </div>
    </div>
  );
}
