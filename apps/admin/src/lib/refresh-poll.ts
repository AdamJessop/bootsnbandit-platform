/**
 * The staff shell keeps its unread badge honest without a socket: the same
 * `router.refresh()` polling the kiosk board uses. This module is the part
 * worth testing — the effect itself is three lines of wiring in AppShell.
 */

/** One minute, matching the kiosk board's live-refresh cadence. */
export const UNREAD_POLL_MS = 60_000;

/**
 * Whether a scheduled refresh should actually run. A hidden tab (backgrounded
 * PWA, another window) re-renders the entire staff tree for counts nobody can
 * see — and on a phone that is a minute-by-minute battery cost for nothing.
 * Anything other than an explicit "hidden" polls: an unknown state must not
 * silently freeze the badge.
 */
export function shouldRefreshNow(visibilityState: string | undefined): boolean {
  return visibilityState !== "hidden";
}

/** Smallest sensible gap between two refreshes triggered by coming back. */
export const RETURN_REFRESH_MIN_GAP_MS = 15_000;

/**
 * Whether returning to the tab should refresh, given when we last did.
 *
 * `visibilitychange` fires on every alt-tab, every notification shade, every
 * app switch. Each refresh is a full server re-render of the staff tree, so
 * flicking between two windows turns into a stutter and, on a phone, a
 * battery cost — for a badge that cannot meaningfully have moved in three
 * seconds. Below the gap the 60 s poll has it covered.
 *
 * A backwards jump (a device clock correction) refreshes rather than freezing
 * the badge until the clock catches up.
 */
export function shouldRefreshOnReturn(
  lastRefreshAt: number | null,
  now: number,
  minGapMs: number = RETURN_REFRESH_MIN_GAP_MS,
): boolean {
  if (lastRefreshAt === null) return true;
  if (now < lastRefreshAt) return true;
  return now - lastRefreshAt >= minGapMs;
}
