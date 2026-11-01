/**
 * Turns the Prisma errors an owner can actually cause from the content CMS
 * (duplicate title, stale row, linked record) into a sentence the form shows
 * next to Save — instead of throwing a 500 at a non-technical user on a phone.
 * Pure + no Prisma runtime import (errors are duck-typed on `code`) so it is
 * unit testable and safe to share between the generic CRUD and artist actions.
 */

/** What a content server action hands back to its form. */
export type ActionResult = { ok: true } | { ok: false; error: string };

export const OK: ActionResult = { ok: true };

export function fail(error: string): ActionResult {
  return { ok: false, error };
}

function prismaCode(err: unknown): string | null {
  if (typeof err !== "object" || err === null) return null;
  const code = (err as { code?: unknown }).code;
  return typeof code === "string" && /^P\d{4}$/.test(code) ? code : null;
}

/**
 * The column names a P2002 tripped on, or [] when Prisma didn't say. Prisma 7
 * with the pg driver adapter reports them under
 * `meta.driverAdapterError.cause.constraint` (`fields` or an index name);
 * older engines used `meta.target`. Both shapes are read.
 */
export function uniqueViolationFields(err: unknown): string[] | null {
  if (prismaCode(err) !== "P2002") return null;
  const meta = (err as { meta?: Record<string, unknown> }).meta ?? {};
  const raw: unknown[] = [];
  const target = meta.target;
  if (Array.isArray(target)) raw.push(...target);
  else if (typeof target === "string") raw.push(target);
  const constraint = (
    meta.driverAdapterError as
      | { cause?: { constraint?: { fields?: unknown; index?: unknown } } }
      | undefined
  )?.cause?.constraint;
  if (Array.isArray(constraint?.fields)) raw.push(...constraint.fields);
  if (typeof constraint?.index === "string") raw.push(constraint.index);
  return raw
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.replace(/"/g, ""));
}

/** True when `field` is among the P2002 columns (plain name or `Model_field_key`). */
export function violates(fields: string[], field: string): boolean {
  return fields.some((f) => f === field || f.endsWith(`_${field}_key`));
}

/** Messages for the non-unique Prisma failures a CMS form can hit. */
export function knownDbError(err: unknown): string | null {
  switch (prismaCode(err)) {
    case "P2025":
      return "That entry no longer exists — it may have been deleted in another tab. Refresh the page.";
    case "P2003":
      return "That entry is linked to other records, so it can't be changed that way.";
    case "P2000":
      return "One of the values is too long.";
    default:
      return null;
  }
}

/** "gallery item" → "A gallery item", "entry" → "An entry". */
export function withArticle(noun: string): string {
  return `${/^[aeiou]/i.test(noun) ? "An" : "A"} ${noun}`;
}

/** "sortOrder" → "sort order". */
export function humanise(name: string): string {
  return name.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
}
