/**
 * Pure aggregation for the CRM directory (BACKOFHOUSE-IA F1): lifetime value
 * per customer from completed-session amounts. The page fetches all completed
 * sessions for the listed customers in ONE query and reduces here — no
 * per-customer N+1.
 */

export interface SessionAmountRow {
  customerId: string;
  amountPence: number;
}

/** Sum completed-session amounts per customer (pence). */
export function computeLifetimeValue(
  rows: SessionAmountRow[],
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const r of rows) {
    totals.set(r.customerId, (totals.get(r.customerId) ?? 0) + r.amountPence);
  }
  return totals;
}
