/**
 * Pounds ↔ pence helpers shared by the content CMS forms. Prisma stores money
 * as integer pence; the admin forms present and accept pounds ("90", "90.50")
 * so staff never type in pence. Pure (no server-only imports) → unit testable.
 */

/** £ string ("90", "90.50") → integer pence, or null for blank/invalid. */
export function poundsToPence(raw: string | null | undefined): number | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  if (t === "") return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

/** Integer pence → a £ string suitable for a number input (no symbol). */
export function penceToPounds(pence: number | null | undefined): string {
  if (pence == null) return "";
  return (pence / 100) % 1 === 0
    ? String(pence / 100)
    : (pence / 100).toFixed(2);
}

/** Integer pence → "£90" / "£90.50" for read-only display; "—" when unset. */
export function formatPounds(pence: number | null | undefined): string {
  return pence == null ? "—" : `£${penceToPounds(pence)}`;
}
