/**
 * Studio wall-clock dates for CMS text inputs. The studio runs on UK time, so
 * a typed "2026-11-14 18:00" means 6pm in Worksop whether it is GMT or BST.
 * A date with no time means the END of that day (23:59) — "live until Sat 14
 * Nov" should still be claimable on the Saturday. Pure + no server-only
 * imports so it is unit testable.
 */

const ZONE = "Europe/London";
const INPUT_RE = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?$/;

/** London's UTC offset (ms) at a given instant. */
function londonOffsetMs(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const n = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(
    n("year"),
    n("month") - 1,
    n("day"),
    n("hour"),
    n("minute"),
    n("second"),
  );
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/**
 * Parse "YYYY-MM-DD" or "YYYY-MM-DD HH:MM" (London time) to a Date. Returns
 * null for blank or unparseable input.
 */
export function parseLondonDateTime(input: string): Date | null {
  const m = INPUT_RE.exec(input.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  const year = Number(y);
  const month = Number(mo);
  const day = Number(d);
  const hour = h === undefined ? 23 : Number(h);
  const minute = mi === undefined ? 59 : Number(mi);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (hour > 23 || minute > 59) return null;
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  // Reject roll-overs like 2026-02-31.
  if (new Date(wall).getUTCDate() !== day) return null;
  // Two passes settle the offset across a GMT/BST change.
  let at = wall - londonOffsetMs(new Date(wall));
  at = wall - londonOffsetMs(new Date(at));
  return new Date(at);
}

/** Format a Date back to the "YYYY-MM-DD HH:MM" London form the input takes. */
export function formatLondonDateTime(at: Date | null | undefined): string {
  if (!at) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(at);
  const v = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${v("year")}-${v("month")}-${v("day")} ${v("hour")}:${v("minute")}`;
}
