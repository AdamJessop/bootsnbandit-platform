/** Pure flash grouping + stock helpers (unit-tested), used by the flash page. */

export interface DeadlineItem {
  deadline?: string | null;
}

export interface FlashGroup<T> {
  deadline: string;
  items: T[];
}

/**
 * Group flash items by their `deadline` label, preserving first-seen order of
 * both groups and items within them. Null deadlines bucket under "Coming soon".
 */
export function groupByDeadline<T extends DeadlineItem>(
  items: T[],
): FlashGroup<T>[] {
  const order: string[] = [];
  const byKey = new Map<string, T[]>();
  for (const item of items) {
    const key = item.deadline ?? "Coming soon";
    if (!byKey.has(key)) {
      byKey.set(key, []);
      order.push(key);
    }
    byKey.get(key)!.push(item);
  }
  return order.map((deadline) => ({ deadline, items: byKey.get(deadline)! }));
}

/** Stock state for a flash design: remaining count + gone/low flags. */
export function flashStock(
  total: number,
  claimed: number,
): { left: number; gone: boolean; low: boolean } {
  const left = Math.max(0, total - claimed);
  const gone = left <= 0;
  return { left, gone, low: gone || left <= 1 };
}
