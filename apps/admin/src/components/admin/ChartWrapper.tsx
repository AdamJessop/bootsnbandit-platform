"use client";

/**
 * Chart wrapper for Reports (BACKOFHOUSE-IA I1). Wires recharts (line / bar /
 * donut) with accessible heritage colours, a legend, tooltips, and an
 * accessible alt data table. Renders explicit loading + empty states. The
 * empty/total logic lives in the pure `chart-utils` module (unit-tested).
 */
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { CHART_COLORS, isChartEmpty } from "./chart-utils";

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
  /** Primary series label (legend / tooltip). */
  seriesLabel?: string;
  /** Secondary series label when value2 is present (bar only). */
  series2Label?: string;
  /** Format a value for the tooltip / alt table (e.g. £ or %). */
  valueFormatter?: (v: number) => string;
}

const AXIS = "var(--text-muted)";
const GRID = "var(--border-default)";

function Frame({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <figure className="rounded-lg border border-border-default bg-bg-card p-5">
      <figcaption className="font-termina text-xs uppercase tracking-wide text-text-muted">
        {title}
      </figcaption>
      <div className="mt-3">{children}</div>
    </figure>
  );
}

export function ChartWrapper({
  title,
  type,
  data,
  loading = false,
  emptyMessage = "No data yet.",
  seriesLabel = "Value",
  series2Label = "Capacity",
  valueFormatter = (v) => String(v),
}: ChartWrapperProps) {
  if (loading) {
    return (
      <Frame title={title}>
        <Skeleton className="h-48 w-full" />
      </Frame>
    );
  }

  if (isChartEmpty(data)) {
    return (
      <Frame title={title}>
        <div className="grid h-48 place-items-center text-sm text-text-muted">
          {emptyMessage}
        </div>
      </Frame>
    );
  }

  return (
    <Frame title={title}>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          {type === "line" ? (
            <LineChart data={data} margin={{ top: 5, right: 8, bottom: 0, left: -8 }}>
              <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
              <XAxis dataKey="label" stroke={AXIS} fontSize={11} tickLine={false} />
              <YAxis stroke={AXIS} fontSize={11} tickLine={false} width={44} />
              <Tooltip
                formatter={(v) => [valueFormatter(Number(v)), seriesLabel]}
                contentStyle={{
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border-strong)",
                  borderRadius: 8,
                  color: "var(--text-primary)",
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: AXIS }} />
              <Line
                type="monotone"
                dataKey="value"
                name={seriesLabel}
                stroke={CHART_COLORS[0]}
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          ) : type === "bar" ? (
            <BarChart data={data} margin={{ top: 5, right: 8, bottom: 0, left: -8 }}>
              <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
              <XAxis dataKey="label" stroke={AXIS} fontSize={11} tickLine={false} />
              <YAxis stroke={AXIS} fontSize={11} tickLine={false} width={44} />
              <Tooltip
                formatter={(v) => valueFormatter(Number(v))}
                contentStyle={{
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border-strong)",
                  borderRadius: 8,
                  color: "var(--text-primary)",
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: AXIS }} />
              <Bar dataKey="value" name={seriesLabel} fill={CHART_COLORS[0]} radius={[3, 3, 0, 0]} />
              {data.some((d) => d.value2 != null) && (
                <Bar
                  dataKey="value2"
                  name={series2Label}
                  fill={CHART_COLORS[2]}
                  radius={[3, 3, 0, 0]}
                />
              )}
            </BarChart>
          ) : (
            <PieChart>
              <Tooltip
                formatter={(v, n) => [valueFormatter(Number(v)), String(n)]}
                contentStyle={{
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border-strong)",
                  borderRadius: 8,
                  color: "var(--text-primary)",
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: AXIS }} />
              <Pie
                data={data}
                dataKey="value"
                nameKey="label"
                innerRadius="55%"
                outerRadius="85%"
                paddingAngle={2}
              >
                {data.map((d, i) => (
                  <Cell key={d.label} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Accessible alternative to the chart (BACKOFHOUSE-IA chart rules). */}
      <details className="mt-3">
        <summary className="cursor-pointer text-xs text-text-muted hover:text-text-primary">
          Data table
        </summary>
        <table className="mt-2 w-full text-xs">
          <thead>
            <tr className="text-text-muted">
              <th className="py-1 text-left font-normal">Label</th>
              <th className="py-1 text-right font-normal tabular-nums">
                {seriesLabel}
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.label} className="border-t border-border-default">
                <td className="py-1 text-text-secondary">{d.label}</td>
                <td className="py-1 text-right tabular-nums text-text-secondary">
                  {valueFormatter(d.value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </Frame>
  );
}
