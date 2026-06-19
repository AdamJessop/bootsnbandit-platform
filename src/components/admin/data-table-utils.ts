/**
 * Pure, framework-free helpers powering DataTable (sort / global filter / CSV
 * export). Kept separate from the React component so they can be unit-tested in
 * the node test environment without a DOM.
 */

export type SortDir = "asc" | "desc";

/** Coerce an unknown cell value to a primitive comparable for sorting. */
function comparable(v: unknown): string | number {
  if (v == null) return "";
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (v instanceof Date) return v.getTime();
  const n = Number(v);
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(n)) return n;
  return String(v).toLowerCase();
}

/**
 * Stable sort of `rows` by `key`. Numbers/dates compare numerically; everything
 * else compares case-insensitively. Returns a new array.
 */
export function sortRows<T>(rows: T[], key: keyof T, dir: SortDir): T[] {
  const factor = dir === "asc" ? 1 : -1;
  return rows
    .map((row, i) => ({ row, i }))
    .sort((a, b) => {
      const av = comparable(a.row[key]);
      const bv = comparable(b.row[key]);
      if (av < bv) return -1 * factor;
      if (av > bv) return 1 * factor;
      return a.i - b.i; // stable
    })
    .map(({ row }) => row);
}

/**
 * Case-insensitive substring filter across the given accessor keys. An empty
 * query returns all rows.
 */
export function filterRows<T>(
  rows: T[],
  query: string,
  keys: (keyof T)[],
): T[] {
  const q = query.trim().toLowerCase();
  if (q === "") return rows;
  return rows.filter((row) =>
    keys.some((k) => {
      const v = row[k];
      return v != null && String(v).toLowerCase().includes(q);
    }),
  );
}

/** Escape a single CSV field per RFC 4180 (quote when it contains , " or newline). */
export function csvField(value: unknown): string {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export interface CsvColumn<T> {
  key: keyof T & string;
  header: string;
  /** Optional value extractor for the CSV (defaults to row[key]). */
  value?: (row: T) => unknown;
}

/** Build an RFC-4180 CSV string (header row + data rows) from columns + rows. */
export function toCsv<T>(columns: CsvColumn<T>[], rows: T[]): string {
  const header = columns.map((c) => csvField(c.header)).join(",");
  const body = rows.map((row) =>
    columns.map((c) => csvField(c.value ? c.value(row) : row[c.key])).join(","),
  );
  return [header, ...body].join("\r\n");
}
