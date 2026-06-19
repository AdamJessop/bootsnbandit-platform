import { requireRole } from "@bnb/core/auth";
import { prisma } from "@bnb/core/db";
import {
  CrudSection,
  type CrudField,
} from "../../content/_components/CrudSection";
import {
  createRow,
  deleteRow,
  updateRow,
  type CrudConfig,
} from "../../content/_lib/crud";
import type { FieldSpec } from "../../content/_lib/coerce";

/** Studio › Resources (K2) — chairs / stations used for utilisation. Owner-only. */
export const dynamic = "force-dynamic";

const SPEC: FieldSpec[] = [
  { name: "name", kind: "string" },
  { name: "active", kind: "bool" },
  { name: "sortOrder", kind: "int" },
];
const CFG: CrudConfig = {
  model: "chair",
  spec: SPEC,
  revalidate: "/studio/resources",
};
const FIELDS: CrudField[] = [
  { name: "name", label: "Chair / station", type: "text", required: true },
  { name: "active", label: "Active", type: "checkbox", defaultValue: true },
  { name: "sortOrder", label: "Order", type: "number" },
];

export default async function ResourcesPage() {
  await requireRole("OWNER");
  const rows = await prisma.chair.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return (
    <main className="mx-auto max-w-[1100px] px-7 py-10">
      <p className="kicker mb-2">Studio</p>
      <h1 className="display text-[clamp(24px,4vw,36px)] text-text-primary">
        Resources
      </h1>
      <p className="mt-2 mb-6 text-text-muted">
        Chairs and stations drive capacity / utilisation in reports.
      </p>
      <CrudSection
        fields={FIELDS}
        rows={rows}
        createAction={createRow.bind(null, CFG)}
        updateAction={updateRow.bind(null, CFG)}
        deleteAction={deleteRow.bind(null, CFG)}
      />
    </main>
  );
}
