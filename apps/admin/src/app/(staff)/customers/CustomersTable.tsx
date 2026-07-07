"use client";

/**
 * Client island: the customer directory DataTable (search, tags, loyalty tier,
 * lifetime value, last/next visit). Rows are precomputed server-side; this only
 * wires the generic DataTable + navigation to the per-customer timeline.
 */
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { DataTable, type DataTableColumn } from "@/components/admin/DataTable";
import { formatPence } from "@/components/admin/money";
import { formatDay, loyaltyTierLabel } from "../_shared/labels";

export interface CustomerRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  loyaltyStamps: number;
  loyaltyTier: number;
  tags: string[];
  /** Sum of completed session amounts (pence), precomputed server-side. */
  lifetimeValuePence: number;
  lastVisit: string | null;
  nextVisit: string | null;
}

export function CustomersTable({ rows }: { rows: CustomerRow[] }) {
  const router = useRouter();

  const columns: DataTableColumn<CustomerRow>[] = [
    { key: "name", header: "Name", sortable: true },
    {
      key: "email",
      header: "Contact",
      accessor: (r) => (
        <span className="text-text-secondary">{r.email || r.phone || "—"}</span>
      ),
    },
    {
      key: "tags",
      header: "Tags",
      accessor: (r) =>
        r.tags.length === 0 ? (
          <span className="text-text-muted">—</span>
        ) : (
          <span className="flex flex-wrap gap-1">
            {r.tags.map((t) => (
              <Badge key={t} variant="secondary">
                {t}
              </Badge>
            ))}
          </span>
        ),
      csvValue: (r) => r.tags.join("; "),
    },
    {
      key: "loyaltyTier",
      header: "Loyalty",
      sortable: true,
      accessor: (r) => (
        <span className="inline-flex items-center gap-2">
          <Badge variant={r.loyaltyTier > 0 ? "default" : "outline"}>
            {loyaltyTierLabel(r.loyaltyTier)}
          </Badge>
          <span className="tabular-nums text-text-muted">{r.loyaltyStamps}★</span>
        </span>
      ),
      csvValue: (r) => `${loyaltyTierLabel(r.loyaltyTier)} (${r.loyaltyStamps})`,
    },
    {
      key: "lifetimeValuePence",
      header: "Lifetime value",
      sortable: true,
      align: "right",
      accessor: (r) => formatPence(r.lifetimeValuePence),
      csvValue: (r) => formatPence(r.lifetimeValuePence),
    },
    {
      key: "lastVisit",
      header: "Last visit",
      sortable: true,
      align: "right",
      accessor: (r) => formatDay(r.lastVisit),
      csvValue: (r) => formatDay(r.lastVisit),
    },
    {
      key: "nextVisit",
      header: "Next visit",
      sortable: true,
      align: "right",
      accessor: (r) => formatDay(r.nextVisit),
      csvValue: (r) => formatDay(r.nextVisit),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      csv
      csvName="customers"
      searchKeys={["name", "email", "phone"]}
      searchPlaceholder="Search name, email or phone…"
      rowKey={(r) => r.id}
      emptyMessage="No customers yet."
      onRowClick={(r) => router.push(`/customers/${r.id}`)}
    />
  );
}
