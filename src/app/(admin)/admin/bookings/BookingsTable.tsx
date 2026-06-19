"use client";

/**
 * Bookings list/search (BACKOFHOUSE-IA E5/Bookings). All appointments in a
 * DataTable with status + type filter selects and CSV export. Row shaping +
 * scoping happen server-side; the pure filter predicate is unit-tested.
 */
import { useMemo, useState } from "react";
import type { BookingStatus, BookingType } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable, type DataTableColumn } from "@/components/admin/DataTable";
import { formatPence } from "@/components/admin/money";
import {
  bookingStatusLabel,
  bookingStatusVariant,
  formatDateTime,
} from "../_shared/labels";

export interface BookingRow {
  id: string;
  customerName: string;
  artistName: string;
  type: BookingType;
  status: BookingStatus;
  startISO: string;
  priceEstimatePence: number | null;
}

export interface BookingFilter {
  status?: BookingStatus;
  type?: BookingType;
}

/** Pure filter predicate (unit-tested). */
export function filterBookingRows(
  rows: BookingRow[],
  filter: BookingFilter,
): BookingRow[] {
  return rows.filter(
    (r) =>
      (!filter.status || r.status === filter.status) &&
      (!filter.type || r.type === filter.type),
  );
}

const STATUSES: BookingStatus[] = [
  "enquiry",
  "pending",
  "confirmed",
  "completed",
  "cancelled",
  "no_show",
];
const TYPES: BookingType[] = ["consult", "session", "flash"];
const ALL = "all";

export function BookingsTable({ rows }: { rows: BookingRow[] }) {
  const [status, setStatus] = useState<string>(ALL);
  const [type, setType] = useState<string>(ALL);

  const filtered = useMemo(
    () =>
      filterBookingRows(rows, {
        status: status === ALL ? undefined : (status as BookingStatus),
        type: type === ALL ? undefined : (type as BookingType),
      }),
    [rows, status, type],
  );

  const columns: DataTableColumn<BookingRow>[] = [
    { key: "customerName", header: "Customer", sortable: true },
    { key: "artistName", header: "Artist", sortable: true },
    {
      key: "type",
      header: "Type",
      accessor: (r) => <span className="capitalize">{r.type}</span>,
    },
    {
      key: "startISO",
      header: "When",
      sortable: true,
      accessor: (r) => formatDateTime(r.startISO),
      csvValue: (r) => formatDateTime(r.startISO),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      accessor: (r) => (
        <Badge variant={bookingStatusVariant(r.status)}>
          {bookingStatusLabel(r.status)}
        </Badge>
      ),
      csvValue: (r) => bookingStatusLabel(r.status),
    },
    {
      key: "priceEstimatePence",
      header: "Estimate",
      sortable: true,
      align: "right",
      accessor: (r) =>
        r.priceEstimatePence != null ? formatPence(r.priceEstimatePence) : "—",
      csvValue: (r) =>
        r.priceEstimatePence != null ? r.priceEstimatePence / 100 : "",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={status} onValueChange={(v) => setStatus(v ?? ALL)}>
          <SelectTrigger className="w-44" aria-label="Filter by status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {bookingStatusLabel(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={type} onValueChange={(v) => setType(v ?? ALL)}>
          <SelectTrigger className="w-40" aria-label="Filter by type">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All types</SelectItem>
            {TYPES.map((t) => (
              <SelectItem key={t} value={t} className="capitalize">
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        rows={filtered}
        csv
        csvName="bookings"
        searchKeys={["customerName", "artistName"]}
        searchPlaceholder="Search customer or artist…"
        rowKey={(r) => r.id}
        emptyMessage="No bookings match these filters."
      />
    </div>
  );
}
