import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CrudSection, type CrudField } from "../_components/CrudSection";
import { createRow, deleteRow, updateRow, type CrudConfig } from "../_lib/crud";
import type { FieldSpec } from "../_lib/coerce";

/** Aftercare stages CMS (J5) — ordered advice emailed post-session. Owner-only. */
export const dynamic = "force-dynamic";

const SPEC: FieldSpec[] = [
  { name: "order", kind: "int" },
  { name: "title", kind: "string" },
  { name: "body", kind: "string" },
  { name: "hue", kind: "string", nullable: true },
];
const CFG: CrudConfig = {
  model: "aftercareStage",
  spec: SPEC,
  revalidate: "/admin/content/aftercare",
};
const FIELDS: CrudField[] = [
  { name: "order", label: "Order", type: "number" },
  { name: "title", label: "Title", type: "text", required: true },
  { name: "body", label: "Body", type: "textarea", required: true },
  { name: "hue", label: "Hue", type: "text", hideInTable: true },
];

export default async function AftercareContentPage() {
  await requireRole("OWNER");
  const rows = await prisma.aftercareStage.findMany({
    orderBy: { order: "asc" },
  });
  return (
    <main className="mx-auto max-w-[1100px] px-7 py-10">
      <p className="kicker mb-2">Content</p>
      <h1 className="display text-[clamp(24px,4vw,36px)] text-text-primary">
        Aftercare
      </h1>
      <p className="mt-2 mb-6 text-text-muted">Manage aftercare stages.</p>
      <CrudSection
        fields={FIELDS}
        rows={rows}
        titleField="title"
        createAction={createRow.bind(null, CFG)}
        updateAction={updateRow.bind(null, CFG)}
        deleteAction={deleteRow.bind(null, CFG)}
      />
    </main>
  );
}
