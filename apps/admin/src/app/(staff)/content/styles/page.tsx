import { requireRole } from "@bnb/core/auth";
import { prisma } from "@bnb/core/db";
import { CrudSection } from "../_components/CrudSection";
import { createRow, deleteRow, updateRow, type CrudConfig } from "../_lib/crud";
import { FIELDS, SPEC } from "./fields";

/** Styles CMS (J4) — the tattoo styles list. Owner-only. */
export const dynamic = "force-dynamic";

const CFG: CrudConfig = {
  model: "tattooStyle",
  spec: SPEC,
  revalidate: "/content/styles",
  noun: "style",
};

export default async function StylesContentPage() {
  await requireRole("OWNER");
  const rows = await prisma.tattooStyle.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return (
    <main className="mx-auto max-w-[1100px] px-7 py-10">
      <p className="kicker mb-2">Content</p>
      <h1 className="display text-[clamp(24px,4vw,36px)] text-text-primary">
        Styles
      </h1>
      <p className="mt-2 mb-6 text-text-muted">
        Manage the tattoo styles list. Order also controls the position of
        showcase tiles on the home page.
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
