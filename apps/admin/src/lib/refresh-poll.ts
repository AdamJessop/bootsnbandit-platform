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
