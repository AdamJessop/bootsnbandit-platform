/**
 * Pure transforms turning raw booking rows + the report overview into
 * ChartDatum series for the Reports charts (BACKOFHOUSE-IA I1): revenue trend
 * (line, by month), bookings by status (bar), capacity by artist (bar) and
 * style mix (donut, ≤5). Plus the per-artist CSV. Unit-tested in node.
 */
import type { BookingStatus } from "@prisma/client";
import type { ChartDatum } from "@/components/admin/ChartWrapper";
import { csvField } from "@/components/admin/data-table-utils";
import { bookingStatusLabel } from "../_shared/labels";

export interface RawBooking {
  artistName: string;
  status: BookingStatus;
  style: string | null;
  startISO: string;
  /** Completed-session revenue in pence (0 when not completed). */
  revenuePence: number;
}

const STATUS_ORDER: BookingStatus[] = [
  "enquiry",
  "pending",
  "confirmed",
  "completed",
  "cancelled",
  "no_show",
];

/** YYYY-MM bucket of revenue (in pounds), ordered chronologically. */
export function revenueTrendData(bookings: RawBooking[]): ChartDatum[] {
  const buckets = new Map<string, number>();
  for (const b of bookings) {
    const month = b.startISO.slice(0, 7);
    buckets.set(month, (buckets.get(month) ?? 0) + b.revenuePence);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, pence]) => ({ label, value: pence / 100 }));
}

/** Count of bookings per status (only statuses that occur). */
export function bookingsByStatusData(bookings: RawBooking[]): ChartDatum[] {
  const counts = new Map<BookingStatus, number>();
  for (const b of bookings)
    counts.set(b.status, (counts.get(b.status) ?? 0) + 1);
  return STATUS_ORDER.filter((s) => counts.has(s)).map((s) => ({
    label: bookingStatusLabel(s),
    value: counts.get(s) ?? 0,
  }));
}

export interface CapacityRow {
  artistName: string;
  bookedMinutes: number;
  capacityMinutes: number;
}

/** Booked vs capacity (minutes) per artist. */
export function capacityByArtistData(rows: CapacityRow[]): ChartDatum[] {
  return rows.map((r) => ({
    label: r.artistName,
    value: r.bookedMinutes,
    value2: r.capacityMinutes,
  }));
}

/** Top-5 style mix (ignores null/unspecified styles). */
export function styleMixData(bookings: RawBooking[]): ChartDatum[] {
  const counts = new Map<string, number>();
  for (const b of bookings) {
    if (!b.style) continue;
    counts.set(b.style, (counts.get(b.style) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([label, value]) => ({ label, value }));
}

export interface ReportCsvRow {
  artistName: string;
  bookings: number;
  completed: number;
  revenuePence: number;
  utilisationPct: number;
}

export function toReportCsv(rows: ReportCsvRow[]): string {
  const header = [
    "Artist",
    "Bookings",
    "Completed",
    "Revenue (£)",
    "Utilisation %",
  ]
    .map(csvField)
    .join(",");
  const body = rows.map((r) =>
    [
      csvField(r.artistName),
      r.bookings,
      r.completed,
      (r.revenuePence / 100).toFixed(2),
      r.utilisationPct,
    ].join(","),
  );
  return [header, ...body].join("\r\n");
}
