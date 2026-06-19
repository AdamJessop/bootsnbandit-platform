"use client";

/**
 * Generic sortable / filterable data table with CSV export (component kit,
 * BACKOFHOUSE-IA). Sorting, filtering and CSV building live in the pure
 * `data-table-utils` module (unit-tested); this component is the thin React
 * shell around them. The generic prop interface is the stable Wave-4 contract.
 */
import { ArrowDown, ArrowUp, ArrowUpDown, Download, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@bnb/core/utils";
import {
  filterRows,
  sortRows,
  toCsv,
  type CsvColumn,
  type SortDir,
} from "./data-table-utils";

export interface DataTableColumn<T> {
  /** Stable key; also the row accessor when `accessor` is omitted. */
  key: keyof T & string;
  header: string;
  sortable?: boolean;
  /** Custom cell renderer. */
  accessor?: (row: T) => React.ReactNode;
  /** Header alignment / cell alignment. */
  align?: "left" | "right" | "center";
  /** Raw value extractor for CSV/filter (defaults to row[key]). */
  csvValue?: (row: T) => unknown;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  /** Sort callback (column key + direction). */
  onSort?: (key: keyof T & string, dir: "asc" | "desc") => void;
  /** Enable CSV export of the current (filtered + sorted) rows. */
  csv?: boolean;
  /** CSV download filename (without extension). */
  csvName?: string;
  /** Show the search box and filter across these keys (defaults to all keys). */
  searchKeys?: (keyof T & string)[];
  /** Hide the search box entirely. */
  noSearch?: boolean;
  searchPlaceholder?: string;
  /** Stable row key (defaults to an `id` field when present, else the index). */
  rowKey?: (row: T, index: number) => string;
  /** Empty-state copy. */
  emptyMessage?: string;
  /** Optional row click handler (e.g. open a detail page). */
  onRowClick?: (row: T) => void;
}

const alignClass = {
  left: "text-left",
  right: "text-right tabular-nums",
  center: "text-center",
} as const;

export function DataTable<T>({
  columns,
  rows,
  onSort,
  csv = false,
  csvName = "export",
  searchKeys,
  noSearch = false,
  searchPlaceholder = "Search…",
  rowKey,
  emptyMessage = "Nothing here yet.",
  onRowClick,
}: DataTableProps<T>) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: keyof T & string; dir: SortDir } | null>(
    null,
  );

  const keys = searchKeys ?? columns.map((c) => c.key);

  const view = useMemo(() => {
    const filtered = filterRows(rows, query, keys);
    if (!sort) return filtered;
    return sortRows(filtered, sort.key, sort.dir);
  }, [rows, query, keys, sort]);

  function toggleSort(key: keyof T & string) {
    setSort((prev) => {
      const dir: SortDir =
        prev?.key === key && prev.dir === "asc" ? "desc" : "asc";
      onSort?.(key, dir);
      return { key, dir };
    });
  }

  function exportCsv() {
    const csvCols: CsvColumn<T>[] = columns.map((c) => ({
      key: c.key,
      header: c.header,
      value: c.csvValue,
    }));
    const blob = new Blob([toCsv(csvCols, view)], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${csvName}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {!noSearch && (
          <div className="relative max-w-xs flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              aria-label="Filter table"
              className="pl-9"
            />
          </div>
        )}
        {csv && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={exportCsv}
            disabled={view.length === 0}
          >
            <Download className="size-4" /> CSV
          </Button>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-border-default bg-bg-card">
        <Table>
          <TableHeader>
            <TableRow className="border-border-default hover:bg-transparent">
              {columns.map((col) => {
                const active = sort?.key === col.key;
                const Icon = !active
                  ? ArrowUpDown
                  : sort.dir === "asc"
                    ? ArrowUp
                    : ArrowDown;
                return (
                  <TableHead
                    key={col.key}
                    className={cn(
                      "text-text-muted",
                      alignClass[col.align ?? "left"],
                    )}
                  >
                    {col.sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(col.key)}
                        className="inline-flex items-center gap-1 hover:text-text-primary"
                        aria-label={`Sort by ${col.header}`}
                      >
                        {col.header}
                        <Icon className="size-3.5" />
                      </button>
                    ) : (
                      col.header
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {view.length === 0 ? (
              <TableRow className="border-border-default hover:bg-transparent">
                <TableCell
                  colSpan={columns.length}
                  className="py-10 text-center text-text-muted"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              view.map((row, i) => (
                <TableRow
                  key={rowKey ? rowKey(row, i) : i}
                  className={cn(
                    "border-border-default",
                    onRowClick && "cursor-pointer",
                  )}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {columns.map((col) => (
                    <TableCell
                      key={col.key}
                      className={cn(
                        "text-text-secondary",
                        alignClass[col.align ?? "left"],
                      )}
                    >
                      {col.accessor
                        ? col.accessor(row)
                        : ((row[col.key] ?? "") as React.ReactNode)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
