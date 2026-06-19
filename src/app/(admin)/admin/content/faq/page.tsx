import { requireRole } from "@bnb/core/auth";
import { prisma } from "@bnb/core/db";
import { CrudSection, type CrudField } from "../_components/CrudSection";
import { createRow, deleteRow, updateRow, type CrudConfig } from "../_lib/crud";
import type { FieldSpec } from "../_lib/coerce";

/** FAQ CMS (J6) — public Q&A. Owner-only. */
export const dynamic = "force-dynamic";

const SPEC: FieldSpec[] = [
  { name: "question", kind: "string" },
  { name: "answer", kind: "string" },
  { name: "sortOrder", kind: "int" },
];
const CFG: CrudConfig = {
  model: "faq",
  spec: SPEC,
  revalidate: "/admin/content/faq",
};
const FIELDS: CrudField[] = [
  { name: "question", label: "Question", type: "text", required: true },
  { name: "answer", label: "Answer", type: "textarea", required: true },
  { name: "sortOrder", label: "Order", type: "number" },
];

export default async function FaqContentPage() {
  await requireRole("OWNER");
  const rows = await prisma.faq.findMany({
    orderBy: [{ sortOrder: "asc" }, { question: "asc" }],
  });
  return (
    <main className="mx-auto max-w-[1100px] px-7 py-10">
      <p className="kicker mb-2">Content</p>
      <h1 className="display text-[clamp(24px,4vw,36px)] text-text-primary">
        FAQ
      </h1>
      <p className="mt-2 mb-6 text-text-muted">Manage questions and answers.</p>
      <CrudSection
        fields={FIELDS}
        rows={rows}
        titleField="question"
        createAction={createRow.bind(null, CFG)}
        updateAction={updateRow.bind(null, CFG)}
        deleteAction={deleteRow.bind(null, CFG)}
      />
    </main>
  );
}
