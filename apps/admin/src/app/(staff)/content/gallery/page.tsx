import { requireRole } from "@bnb/core/auth";
import { prisma } from "@bnb/core/db";
import { CrudSection, type CrudField } from "../_components/CrudSection";
import { createRow, deleteRow, updateRow, type CrudConfig } from "../_lib/crud";
import type { FieldSpec } from "../_lib/coerce";
import { artistField, loadArtistOptions } from "../_lib/artist-options";

/**
 * Gallery CMS (J1) — portfolio pieces. Owner-only. `hue` is deliberately not
 * editable (nor in SPEC, so saves leave any seeded value alone): the public
 * gallery never reads it — empty image slots derive their placeholder tint
 * from the title — so the free-text field only confused owners.
 */
export const dynamic = "force-dynamic";

const SPEC: FieldSpec[] = [
  { name: "title", kind: "string" },
  { name: "style", kind: "string", nullable: true },
  { name: "placement", kind: "string", nullable: true },
  { name: "artistId", kind: "string", nullable: true },
  { name: "image", kind: "string", nullable: true },
  { name: "featured", kind: "bool" },
  { name: "sortOrder", kind: "int" },
];
const CFG: CrudConfig = {
  model: "galleryItem",
  spec: SPEC,
  revalidate: "/content/gallery",
  noun: "gallery item",
};
/** Field definitions; the artist select is built from the live artist list. */
function galleryFields(artists: { id: string; name: string }[]): CrudField[] {
  return [
    { name: "title", label: "Title", type: "text", required: true },
    artistField(artists),
    { name: "style", label: "Style", type: "text" },
    { name: "featured", label: "Featured", type: "checkbox" },
    { name: "placement", label: "Placement", type: "text", hideInTable: true },
    { name: "image", label: "Image", type: "image", hideInTable: true },
    { name: "sortOrder", label: "Order", type: "number", hideInTable: true },
  ];
}

export default async function GalleryContentPage() {
  await requireRole("OWNER");
  const rows = await prisma.galleryItem.findMany({
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
  });
  const fields = galleryFields(
    await loadArtistOptions(rows.map((r) => r.artistId)),
  );
  return (
    <main className="mx-auto max-w-[1100px] px-7 py-10">
      <p className="kicker mb-2">Content</p>
      <h1 className="display text-[clamp(24px,4vw,36px)] text-text-primary">
        Gallery
      </h1>
      <p className="mt-2 mb-6 text-text-muted">Manage portfolio pieces.</p>
      <CrudSection
        fields={fields}
        rows={rows}
        createAction={createRow.bind(null, CFG)}
        updateAction={updateRow.bind(null, CFG)}
        deleteAction={deleteRow.bind(null, CFG)}
      />
    </main>
  );
}
