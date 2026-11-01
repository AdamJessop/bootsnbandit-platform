/** Pure flash expiry, grouping + stock helpers (unit-tested), used by the flash page and home band. */

export interface EndsAtItem {
  endsAt?: Date | null;
}

export interface FlashGroup<T> {
  /** "Live until Sat 14 Nov, 6pm"; null for designs with no closing date. */
  label: string | null;
  items: T[];
}

/** True while a drop is still claimable by time (no end, or one ahead). */
export function isLive(item: EndsAtItem, now: Date = new Date()): boolean {
  return item.endsAt == null || item.endsAt.getTime() > now.getTime();
}

/** Drop expired designs; display order is preserved. */
export function liveFlash<T extends EndsAtItem>(
  items: T[],
  now: Date = new Date(),
): T[] {
  return items.filter((i) => isLive(i, now));
}

/**
 * Studio-time label for a drop's end: "Sat 14 Nov" when it runs to the end of
 * the day (23:59, what a bare date in the CMS means), else with the time —
 * "Sat 14 Nov, 6pm" / "Sat 14 Nov, 6:30pm".
 */
export function formatEndsAt(at: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hourCycle: "h23",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(at);
  const v = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const date = `${v("weekday")} ${v("day")} ${v("month")}`;
  const hour = Number(v("hour"));
  const minute = Number(v("minute"));
  if (hour === 23 && minute === 59) return date;
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  const mm = minute === 0 ? "" : `:${String(minute).padStart(2, "0")}`;
  return `${date}, ${h12}${mm}${hour < 12 ? "am" : "pm"}`;
}

/**
 * Group live flash by closing time, soonest first, preserving display order
 * within a group. Open-ended designs (no endsAt) come last under a null label.
 */
export function groupByEndsAt<T extends EndsAtItem>(
  items: T[],
): FlashGroup<T>[] {
  const dated = new Map<number, T[]>();
  const open: T[] = [];
  for (const item of items) {
    if (!item.endsAt) {
      open.push(item);
      continue;
    }
    const key = item.endsAt.getTime();
    if (!dated.has(key)) dated.set(key, []);
    dated.get(key)!.push(item);
  }
  const groups: FlashGroup<T>[] = [...dated.entries()]
    .sort(([a], [b]) => a - b)
    .map(([key, groupItems]) => ({
      label: `Live until ${formatEndsAt(new Date(key))}`,
      items: groupItems,
    }));
  if (open.length) groups.push({ label: null, items: open });
  return groups;
}

/**
 * When the soonest still-open drop closes, or null when no live flash has an
 * end date — the banner hides rather than showing a stale date.
 */
export function nextDropEnds<T extends EndsAtItem>(
  items: T[],
  now: Date = new Date(),
): Date | null {
  let next: Date | null = null;
  for (const item of items) {
    if (!item.endsAt || !isLive(item, now)) continue;
    if (!next || item.endsAt < next) next = item.endsAt;
  }
  return next;
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
