/**
 * Pure, framework-free formatting helpers shared by the public site pages.
 * Kept separate from `_data.ts` (which is `server-only`) so the logic is unit
 * testable without a DB or the server bundle.
 */

/** Format integer pence to a "£NN" / "£NN.NN" GBP string. */
export function formatPence(pence: number | null | undefined): string {
  if (pence == null) return "—";
  const pounds = pence / 100;
  return Number.isInteger(pounds) ? `£${pounds}` : `£${pounds.toFixed(2)}`;
}

/** First whitespace-delimited token of a name (for "Enquire with {first}"). */
export function firstName(name: string): string {
  return name.split(" ")[0] ?? name;
}
