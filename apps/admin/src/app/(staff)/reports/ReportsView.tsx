"use client";

/**
 * Reports view (BACKOFHOUSE-IA I1): a date-range + artist filter, KPI totals,
 * four charts (revenue line, bookings-by-status bar, capacity bar, style donut)
 * via ChartWrapper, and a per-artist CSV export. Changing the range navigates
 * (server re-query); useTransition drives the charts' loading state.
 */
import { Download } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import type { ChartDatum } from "@/components/admin/ChartWrapper";
import { ChartWrapper } from "@/components/admin/ChartWrapper";
import { formatPence } from "@/components/admin/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toReportCsv, type ReportCsvRow } from "./report-data";

export interface ReportsViewProps {
  from: string; // yyyy-mm-dd
  to: string; // yyyy-mm-dd
  artistId: string; // "" = all
  artists: { id: string; name: string }[];
  canChooseArtist: boolean;
  totals: { bookings: number; completed: number; revenuePence: number; utilisationPct: number };
  revenueTrend: ChartDatum[];
  bookingsByStatus: ChartDatum[];
  capacityByArtist: ChartDatum[];
  styleMix: ChartDatum[];
  csvRows: ReportCsvRow[];
}

const ALL = "all";

export function ReportsView(props: ReportsViewProps) {
  const router = useRouter();
  const params = useSearchParams();
  const [from, setFrom] = useState(props.from);
  const [to, setTo] = useState(props.to);
  const [artistId, setArtistId] = useState(props.artistId || ALL);
  const [pending, start] = useTransition();

  function apply() {
    const next = new URLSearchParams(params.toString());
    next.set("from", from);
    next.set("to", to);
    if (artistId && artistId !== ALL) next.set("artistId", artistId);
    else next.delete("artistId");
    start(() => router.push(`/reports?${next.toString()}`));
  }

  function exportCsv() {
    const blob = new Blob([toReportCsv(props.csvRows)], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report-${props.from}_${props.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-8">
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          apply();
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="from">From</Label>
          <Input
            id="from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="to">To</Label>
          <Input
            id="to"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        {props.canChooseArtist && (
          <div className="space-y-1.5">
            <Label>Artist</Label>
            <Select value={artistId} onValueChange={(v) => setArtistId(v ?? ALL)}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All artists</SelectItem>
                {props.artists.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <Button type="submit" disabled={pending}>
          {pending ? "Loading…" : "Apply"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={exportCsv}
          disabled={props.csvRows.length === 0}
        >
          <Download className="size-4" /> CSV
        </Button>
      </form>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Bookings" value={String(props.totals.bookings)} />
        <Kpi label="Completed" value={String(props.totals.completed)} />
        <Kpi label="Revenue" value={formatPence(props.totals.revenuePence)} />
        <Kpi label="Utilisation" value={`${props.totals.utilisationPct}%`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartWrapper
          title="Revenue trend"
          type="line"
          data={props.revenueTrend}
          loading={pending}
          seriesLabel="Revenue (£)"
          valueFormatter={(v) => `£${v.toFixed(2)}`}
          emptyMessage="No revenue in this range."
        />
        <ChartWrapper
          title="Bookings by status"
          type="bar"
          data={props.bookingsByStatus}
          loading={pending}
          seriesLabel="Bookings"
          emptyMessage="No bookings in this range."
        />
        <ChartWrapper
          title="Capacity by artist"
          type="bar"
          data={props.capacityByArtist}
          loading={pending}
          seriesLabel="Booked (min)"
          series2Label="Capacity (min)"
          emptyMessage="No capacity data."
        />
        <ChartWrapper
          title="Style mix"
          type="donut"
          data={props.styleMix}
          loading={pending}
          seriesLabel="Bookings"
          emptyMessage="No styles recorded."
        />
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border-default bg-bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-text-muted">{label}</p>
      <p className="mt-1 font-termina text-2xl tabular-nums text-text-primary">
        {value}
      </p>
    </div>
  );
}
