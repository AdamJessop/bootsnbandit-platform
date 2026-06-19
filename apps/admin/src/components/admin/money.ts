/**
 * Money helpers for back-of-house (P10). Amounts are stored as integer pence
 * (GBP); the UI renders them as pounds with tabular figures. No gateway —
 * receipts reference bank transfer.
 */

/** Format integer pence as a GBP string, e.g. 12500 → "£125.00". */
export function formatPence(pence: number | null | undefined): string {
  const value = (pence ?? 0) / 100;
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Parse a pounds string (what the user types, e.g. "125" or "125.50") into
 * integer pence. Returns null when the input is not a valid non-negative
 * amount. Strips a leading "£" and thousands separators.
 */
export function parsePoundsToPence(input: string): number | null {
  const cleaned = input.trim().replace(/^£/, "").replace(/,/g, "");
  if (cleaned === "") return null;
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const pounds = Number(cleaned);
  if (!Number.isFinite(pounds) || pounds < 0) return null;
  return Math.round(pounds * 100);
}
