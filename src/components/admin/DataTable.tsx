/**
 * STUB — Generic sortable/filterable data table with CSV export
 * (component kit, BACKOFHOUSE-IA). Wave-4 phases fill in rendering, sorting and
 * export. The generic prop interface below is the stable contract.
 */

export interface DataTableColumn<T> {
  /** Stable key; also the row accessor when `accessor` is omitted. */
  key: keyof T & string;
  header: string;
  sortable?: boolean;
  /** Custom cell renderer. */
  accessor?: (row: T) => React.ReactNode;
  /** Header alignment / cell alignment. */
  align?: "left" | "right" | "center";
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  /** Sort callback (column key + direction). */
  onSort?: (key: keyof T & string, dir: "asc" | "desc") => void;
  /** Enable CSV export of the current rows. */
  csv?: boolean;
}

export function DataTable<T>({ columns, rows }: DataTableProps<T>) {
  return (
    <div className="rounded-lg border border-border-default bg-bg-card p-6 text-text-muted">
      <p className="font-termina text-sm uppercase tracking-wide text-text-primary">
        Data table
      </p>
      <p className="mt-1 text-sm">
        {columns.length} column(s) × {rows.length} row(s). Implementation lands
        in Wave 4.
      </p>
    </div>
  );
}
