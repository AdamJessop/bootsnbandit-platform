import type { BoardArtist, BoardSession } from "@bnb/core/services/reception";
import { CURRENT_CONSENT_FORM } from "@bnb/core/consent";

/**
 * Client-safe kiosk board logic — pure helpers shared by the kiosk screens.
 * Types come from the core reception service (type-only import, erased at
 * build time so no prisma reaches the browser bundle).
 */

export type { BoardArtist, BoardSession };
export type {
  ArtistShowcase,
  ShowcaseArtist,
  ShowcaseGalleryItem,
} from "@bnb/core/services/artist-showcase";

// ---------------------------------------------------------------------------
// Time
// ---------------------------------------------------------------------------

/** "HH:MM" (24h, local) for an ISO datetime string or Date. */
export function hhmm(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return (
    String(d.getHours()).padStart(2, "0") +
    ":" +
    String(d.getMinutes()).padStart(2, "0")
  );
}

/** Long header date, e.g. "Tuesday 7 Jul". */
export function headerDate(now: Date): string {
  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${days[now.getDay()]} ${now.getDate()} ${months[now.getMonth()]}`;
}

/**
 * Next `count` half-hour start slots from `now` (rounded up), normally capped
 * at 20:00. A late walk-in must still be bookable, so when the cap would leave
 * nothing the immediate next slot is offered anyway (same-day only).
 */
export function startSlots(now: Date, count = 8): Date[] {
  const rounded = new Date(now);
  rounded.setSeconds(0, 0);
  const m = rounded.getMinutes();
  rounded.setMinutes(m % 30 === 0 ? m : m + (30 - (m % 30)));
  const slots: Date[] = [];
  for (let i = 0; i < count; i++) {
    const s = new Date(rounded.getTime() + i * 30 * 60_000);
    if (s.getDate() === now.getDate() && s.getHours() < 20) slots.push(s);
  }
  if (slots.length === 0 && rounded.getDate() === now.getDate()) {
    slots.push(rounded);
  }
  return slots;
}

// ---------------------------------------------------------------------------
// Board derivations
// ---------------------------------------------------------------------------

/** Sessions for one artist, upcoming-first, completed excluded. */
export function artistSessions(
  sessions: BoardSession[],
  artistId: string,
): BoardSession[] {
  return sessions
    .filter((s) => s.artistId === artistId && !s.completed)
    .sort((a, b) => a.start.localeCompare(b.start));
}

/**
 * The session an artist has a customer here for. A session counts as
 * "current" from the moment the customer checks in until they are checked
 * out (completed) — early arrivals and overruns must stay on the artist's
 * card so the front desk can always check them out from there. When more
 * than one checked-in session exists, the one overlapping `now` wins.
 */
export function currentSession(
  sessions: BoardSession[],
  artistId: string,
  now: Date,
): BoardSession | null {
  const t = now.getTime();
  const arrived = artistSessions(sessions, artistId).filter(
    (s) => s.checkedInAt != null,
  );
  return (
    arrived.find(
      (s) => new Date(s.start).getTime() <= t && t < new Date(s.end).getTime(),
    ) ??
    arrived[0] ??
    null
  );
}

/** The artist's next session (not the current one, not already over). */
export function nextSession(
  sessions: BoardSession[],
  artistId: string,
  now: Date,
): BoardSession | null {
  const cur = currentSession(sessions, artistId, now);
  const t = now.getTime();
  return (
    artistSessions(sessions, artistId).find(
      (s) => s.id !== cur?.id && t < new Date(s.end).getTime(),
    ) ?? null
  );
}

/** 0–100 progress through a session, clamped to [3, 100] for the bar. */
export function progressPct(sess: BoardSession, now: Date): number {
  const start = new Date(sess.start).getTime();
  const end = new Date(sess.end).getTime();
  if (end <= start) return 100;
  const pct = Math.round(((now.getTime() - start) / (end - start)) * 100);
  return Math.min(100, Math.max(3, pct));
}

/** Sessions awaiting arrival — the customer check-in picker list. */
export function awaitingCheckin(sessions: BoardSession[]): BoardSession[] {
  return sessions
    .filter((s) => !s.checkedInAt && !s.completed)
    .sort((a, b) => a.start.localeCompare(b.start));
}

/** Completed takings so far today, in pence. */
export function takingsPence(sessions: BoardSession[]): number {
  return sessions.reduce((sum, s) => sum + (s.amountChargedPence ?? 0), 0);
}

// ---------------------------------------------------------------------------
// Money / estimates
// ---------------------------------------------------------------------------

/** "£123" (whole pounds — studio prices are round). */
export function pounds(pence: number): string {
  return `£${Math.round(pence / 100)}`;
}

/**
 * Pre-filled checkout estimate in pence: artist hourly rate × duration.
 * Consults are free; unknown rate falls back to £80/hr (studio baseline).
 */
export const FALLBACK_HOURLY_PENCE = 8000;

export function estimatePence(
  sess: BoardSession,
  artist: BoardArtist | undefined,
): number {
  if (sess.type === "consult") return 0;
  const hourly = artist?.hourlyRatePence ?? FALLBACK_HOURLY_PENCE;
  return Math.round((hourly * sess.durationMin) / 60);
}

// ---------------------------------------------------------------------------
// Booking labels + durations
// ---------------------------------------------------------------------------

export function typeLabel(type: BoardSession["type"]): string {
  return type === "consult" ? "Consultation" : "Tattoo session";
}

export const DURATIONS: ReadonlyArray<{
  label: string;
  minutes: number;
  type: "consult" | "session";
}> = [
  { label: "15 min consult", minutes: 15, type: "consult" },
  { label: "1 hour", minutes: 60, type: "session" },
  { label: "2 hours", minutes: 120, type: "session" },
  { label: "3 hours", minutes: 180, type: "session" },
  { label: "Full day", minutes: 360, type: "session" },
];

// ---------------------------------------------------------------------------
// Consent questionnaire
// ---------------------------------------------------------------------------

// The versioned question set lives in core (client-safe) so the server action
// and the admin consent viewer read exactly what the kiosk shows.
export {
  CONSENT_SECTIONS,
  CURRENT_CONSENT_FORM,
  MEDICAL_NOTES_MAX,
  MIN_TATTOO_AGE,
  ageOn,
  allAnswered,
  flaggedQuestions,
  isFlaggedAnswer,
  isFormFlagged,
  type ConsentQuestion,
} from "@bnb/core/consent";

/** The questions on the current form, in display order. */
export const CONSENT_QUESTIONS = CURRENT_CONSENT_FORM.questions;

/** "YYYY-MM-DD" for a local date — the value/max of a date input. */
export function isoDate(d: Date): string {
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

// ---------------------------------------------------------------------------
// Privacy on a customer-facing screen
// ---------------------------------------------------------------------------

/**
 * "Megan W." — first name + last initial. The kiosk faces the waiting area,
 * so anything a customer can see shows no more of another customer's name
 * than they need to recognise their own booking.
 */
export function shortName(full: string): string {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

/** "••• 789" — only the last three digits of a phone number. */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length <= 3) return "•••";
  return `••• ${digits.slice(-3)}`;
}

// ---------------------------------------------------------------------------
// Checkout consent acknowledgement
// ---------------------------------------------------------------------------

/**
 * Why checkout needs a staff acknowledgement first, or null when it doesn't:
 * there is no consent form on file, or the one on file has flagged answers.
 * Mirrors `consentNeedsAck` in the core reception service, which the server
 * action enforces.
 */
export function consentAckReason(
  sess: Pick<BoardSession, "consentFlagged">,
): "missing" | "flagged" | null {
  if (sess.consentFlagged == null) return "missing";
  if (sess.consentFlagged) return "flagged";
  return null;
}

// ---------------------------------------------------------------------------
// Network failures
// ---------------------------------------------------------------------------

export const OFFLINE_MSG = "No connection — try again";

type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Run a server action and turn a thrown failure (the tablet lost wifi, the
 * server is redeploying) into a normal error result, so every button that
 * awaits one is re-enabled with a message instead of hanging on "…ing".
 */
export async function safeAction<R extends ActionResult>(
  run: () => Promise<R>,
): Promise<R | { ok: false; error: string }> {
  try {
    return await run();
  } catch {
    return { ok: false, error: OFFLINE_MSG };
  }
}

// ---------------------------------------------------------------------------
// Idle reset
// ---------------------------------------------------------------------------

/** Inactivity before the "Still there?" prompt on a customer/staff screen. */
export const IDLE_TIMEOUT_MS = 90_000;
/** How long "Still there?" counts down before the kiosk resets. */
export const IDLE_COUNTDOWN_MS = 10_000;

/**
 * Where an inactive kiosk is in its reset cycle after `idleMs` without a
 * touch: still active, showing the countdown (with whole seconds left), or
 * due to reset to the home board.
 */
export function idleStage(
  idleMs: number,
):
  | { stage: "active" }
  | { stage: "warning"; secondsLeft: number }
  | { stage: "reset" } {
  if (idleMs < IDLE_TIMEOUT_MS) return { stage: "active" };
  const left = IDLE_TIMEOUT_MS + IDLE_COUNTDOWN_MS - idleMs;
  if (left <= 0) return { stage: "reset" };
  return { stage: "warning", secondsLeft: Math.ceil(left / 1000) };
}

// ---------------------------------------------------------------------------
// Staff gate
// ---------------------------------------------------------------------------

/** Mirrors core `KIOSK_PIN_PATTERN` (that module is server-only). */
export const KIOSK_PIN_LENGTH = { min: 4, max: 6 } as const;

export function isPinShaped(pin: string): boolean {
  return /^\d{4,6}$/.test(pin);
}

/** Press-and-hold duration for the no-PIN fallback staff gate. */
export const HOLD_TO_UNLOCK_MS = 2000;
