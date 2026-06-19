import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CrudSection, type CrudField } from "../_components/CrudSection";
import { createRow, deleteRow, updateRow, type CrudConfig } from "../_lib/crud";
import type { FieldSpec } from "../_lib/coerce";

/** Gallery CMS (J1) — portfolio pieces. Owner-only. */
export const dynamic = "force-dynamic";

const SPEC: FieldSpec[] = [
  { name: "title", kind: "string" },
  { name: "style", kind: "string", nullable: true },
  { name: "placement", kind: "string", nullable: true },
  { name: "artistId", kind: "string", nullable: true },
  { name: "image", kind: "string", nullable: true },
  { name: "hue", kind: "string", nullable: true },
  { name: "featured", kind: "bool" },
  { name: "sortOrder", kind: "int" },
];
const CFG: CrudConfig = {
  model: "galleryItem",
  spec: SPEC,
  revalidate: "/admin/content/gallery",
};
const FIELDS: CrudField[] = [
  { name: "title", label: "Title", type: "text", required: true },
  { name: "style", label: "Style", type: "text" },
  { name: "placement", label: "Placement", type: "text" },
  { name: "artistId", label: "Artist ID", type: "text", hideInTable: true },
  { name: "image", label: "Image", type: "image", hideInTable: true },
  { name: "hue", label: "Hue", type: "text", hideInTable: true },
  { name: "featured", label: "Featured", type: "checkbox" },
  { name: "sortOrder", label: "Order", type: "number" },
];

export default async function GalleryContentPage() {
  await requireRole("OWNER");
  const rows = await prisma.galleryItem.findMany({
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
  });
  return (
    <main className="mx-auto max-w-[1100px] px-7 py-10">
      <p className="kicker mb-2">Content</p>
      <h1 className="display text-[clamp(24px,4vw,36px)] text-text-primary">
        Gallery
      </h1>
      <p className="mt-2 mb-6 text-text-muted">Manage portfolio pieces.</p>
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
