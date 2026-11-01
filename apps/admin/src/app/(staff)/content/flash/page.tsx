import { requireRole } from "@bnb/core/auth";
import { prisma } from "@bnb/core/db";
import { CrudSection, type CrudField } from "../_components/CrudSection";
import { createRow, deleteRow, updateRow, type CrudConfig } from "../_lib/crud";
import type { FieldSpec } from "../_lib/coerce";
import { artistField, loadArtistOptions } from "../_lib/artist-options";
import { formatLondonDateTime } from "../_lib/london-date";

/** Flash CMS (J2) — flash designs + claim tracking. Owner-only. */
export const dynamic = "force-dynamic";

const SPEC: FieldSpec[] = [
  { name: "title", kind: "string" },
  { name: "artistId", kind: "string", nullable: true },
  { name: "image", kind: "string", nullable: true },
  { name: "hue", kind: "string", nullable: true },
  { name: "sizeCm", kind: "string", nullable: true },
  // The form posts pounds ("45.50"); stored as integer pence.
  { name: "pricePence", kind: "pounds", nullable: true },
  { name: "total", kind: "int" },
  { name: "claimed", kind: "int" },
  // Typed as UK time ("2026-11-14 18:00"; a bare date = end of that day).
  { name: "endsAt", kind: "date", nullable: true },
  { name: "status", kind: "string" },
  { name: "sortOrder", kind: "int" },
];
const CFG: CrudConfig = {
  model: "flash",
  spec: SPEC,
  revalidate: "/content/flash",
};

/** Field definitions; the artist select is built from the live artist list. */
function flashFields(artists: { id: string; name: string }[]): CrudField[] {
  return [
    { name: "title", label: "Title", type: "text", required: true },
    artistField(artists),
    { name: "pricePence", label: "Price (£)", type: "money" },
    {
      name: "status",
      label: "Status",
      type: "select",
      defaultValue: "available",
      options: [
        { value: "available", label: "Available" },
        { value: "claimed", label: "Claimed" },
        { value: "retired", label: "Retired" },
      ],
    },
    { name: "sizeCm", label: "Size (cm)", type: "text", hideInTable: true },
    { name: "image", label: "Image", type: "image", hideInTable: true },
    { name: "hue", label: "Hue", type: "text", hideInTable: true },
    { name: "total", label: "Total", type: "number", hideInTable: true },
    { name: "claimed", label: "Claimed", type: "number", hideInTable: true },
    {
      name: "endsAt",
      label: "Live until (UK time)",
      type: "text",
      placeholder: "YYYY-MM-DD or YYYY-MM-DD HH:MM — blank = no end",
      hideInTable: true,
    },
    { name: "sortOrder", label: "Order", type: "number", hideInTable: true },
  ];
}

export default async function FlashContentPage() {
  await requireRole("OWNER");
  const rows = await prisma.flash.findMany({
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
  });
  const fields = flashFields(
    await loadArtistOptions(rows.map((r) => r.artistId)),
  );
  // The form edits endsAt as the same UK-time text the coercer parses.
  const formRows = rows.map((r) => ({
    ...r,
    endsAt: formatLondonDateTime(r.endsAt) || null,
  }));
  return (
    <main className="mx-auto max-w-[1100px] px-7 py-10">
      <p className="kicker mb-2">Content</p>
      <h1 className="display text-[clamp(24px,4vw,36px)] text-text-primary">
        Flash
      </h1>
      <p className="mt-2 mb-6 text-text-muted">Manage flash designs.</p>
      <CrudSection
        fields={fields}
        rows={formRows}
        createAction={createRow.bind(null, CFG)}
        updateAction={updateRow.bind(null, CFG)}
        deleteAction={deleteRow.bind(null, CFG)}
      />
    </main>
  );
}
