import { prisma } from "@bnb/core/db";
import type { CrudField } from "../_components/CrudSection";

/**
 * Artist dropdown for content sections that link rows to an artist (flash,
 * gallery). Lists active artists in roster order; any artist that existing rows
 * still reference but who has since been deactivated is kept (marked inactive)
 * so editing such a row doesn't silently drop the link.
 */
export async function loadArtistOptions(
  referencedIds: (string | null | undefined)[],
): Promise<{ id: string; name: string }[]> {
  const active = await prisma.artist.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true },
  });
  const known = new Set(active.map((a) => a.id));
  const missing = [
    ...new Set(
      referencedIds.filter((id): id is string => !!id && !known.has(id)),
    ),
  ];
  if (missing.length === 0) return active;
  const extra = await prisma.artist.findMany({
    where: { id: { in: missing } },
    select: { id: true, name: true },
  });
  return [
    ...active,
    ...extra.map((a) => ({ id: a.id, name: `${a.name} (inactive)` })),
  ];
}

/** The `artistId` CRUD field as a select over the given artists. */
export function artistField(
  artists: { id: string; name: string }[],
  opts: { hideInTable?: boolean } = {},
): CrudField {
  return {
    name: "artistId",
    label: "Artist",
    type: "select",
    defaultValue: "",
    options: [
      { value: "", label: "No artist" },
      ...artists.map((a) => ({ value: a.id, label: a.name })),
    ],
    ...opts,
  };
}
