import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CrudSection, type CrudField } from "../_components/CrudSection";
import { createRow, deleteRow, updateRow, type CrudConfig } from "../_lib/crud";
import type { FieldSpec } from "../_lib/coerce";

/** Artists CMS (J3) — public artist profiles. Owner-only. */
export const dynamic = "force-dynamic";

const SPEC: FieldSpec[] = [
  { name: "slug", kind: "string" },
  { name: "name", kind: "string" },
  { name: "role", kind: "string" },
  { name: "tag", kind: "string", nullable: true },
  { name: "bio", kind: "string", nullable: true },
  { name: "styles", kind: "stringArray" },
  { name: "specials", kind: "stringArray" },
  { name: "rateText", kind: "string", nullable: true },
  { name: "insta", kind: "string", nullable: true },
  { name: "headshot", kind: "string", nullable: true },
  { name: "hue", kind: "string", nullable: true },
  { name: "booksStatus", kind: "string" },
  { name: "sortOrder", kind: "int" },
  { name: "active", kind: "bool" },
];
const CFG: CrudConfig = {
  model: "artist",
  spec: SPEC,
  revalidate: "/admin/content/artists",
};
const FIELDS: CrudField[] = [
  { name: "name", label: "Name", type: "text", required: true },
  { name: "role", label: "Role", type: "text" },
  {
    name: "booksStatus",
    label: "Books",
    type: "select",
    defaultValue: "open",
    options: [
      { value: "open", label: "Open" },
      { value: "limited", label: "Limited" },
      { value: "closed", label: "Closed" },
    ],
  },
  { name: "slug", label: "Slug", type: "text", hideInTable: true },
  { name: "tag", label: "Tag", type: "text", hideInTable: true },
  { name: "bio", label: "Bio", type: "textarea", hideInTable: true },
  {
    name: "styles",
    label: "Styles (comma separated)",
    type: "text",
    hideInTable: true,
  },
  {
    name: "specials",
    label: "Specials (comma separated)",
    type: "text",
    hideInTable: true,
  },
  { name: "rateText", label: "Rate text", type: "text", hideInTable: true },
  { name: "insta", label: "Instagram", type: "text", hideInTable: true },
  { name: "headshot", label: "Headshot", type: "image", hideInTable: true },
  { name: "hue", label: "Hue", type: "text", hideInTable: true },
  { name: "sortOrder", label: "Order", type: "number", hideInTable: true },
  { name: "active", label: "Active", type: "checkbox", defaultValue: true, hideInTable: true },
];

export default async function ArtistsContentPage() {
  await requireRole("OWNER");
  const rows = await prisma.artist.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return (
    <main className="mx-auto max-w-[1100px] px-7 py-10">
      <p className="kicker mb-2">Content</p>
      <h1 className="display text-[clamp(24px,4vw,36px)] text-text-primary">
        Artists
      </h1>
      <p className="mt-2 mb-6 text-text-muted">Manage artist profiles.</p>
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
