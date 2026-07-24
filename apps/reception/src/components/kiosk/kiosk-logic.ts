import type { BoardArtist, BoardSession } from "@bnb/core/services/reception";

/**
 * Client-safe kiosk board logic — pure helpers shared by the kiosk screens.
 * Types come from the core reception service (type-only import, erased at
 * build time so no prisma reaches the browser bundle).
 */

export type { BoardArtist, BoardSession };

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
 * The session an artist is mid-way through. A session only counts as "in
 * progress" once the customer has checked in; otherwise it stays in the
 * "next" slot until they arrive.
 */
export function currentSession(
  sessions: BoardSession[],
  artistId: string,
  now: Date,
): BoardSession | null {
  const t = now.getTime();
  return (
    artistSessions(sessions, artistId).find(
      (s) =>
        s.checkedInAt != null &&
        new Date(s.start).getTime() <= t &&
        t < new Date(s.end).getTime(),
    ) ?? null
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

export interface ConsentQuestion {
  id: string;
  q: string;
  /** "yes" = a No answer needs a word with the front desk (flag). */
  needs: "yes" | null;
}

export const CONSENT_QUESTIONS: ReadonlyArray<ConsentQuestion> = [
  {
    id: "age",
    q: "I am 18 or over and have photo ID with me today.",
    needs: "yes",
  },
  { id: "eaten", q: "I have eaten within the last 4 hours.", needs: null },
  {
    id: "sober",
    q: "I am not under the influence of alcohol or drugs.",
    needs: "yes",
  },
  {
    id: "skin",
    q: "The skin at the tattoo area is free of cuts, rashes and sunburn.",
    needs: null,
  },
  { id: "preg", q: "I am not pregnant or breastfeeding.", needs: null },
  {
    id: "medical",
    q: "I have no medical condition affecting healing (or I have already discussed it with my artist).",
    needs: null,
  },
  {
    id: "consent",
    q: "I understand a tattoo is permanent and I consent to the procedure.",
    needs: "yes",
  },
  {
    id: "aftercare",
    q: "I agree to follow the aftercare guidance I am given.",
    needs: "yes",
  },
];

/** Questions whose answer needs reviewing (needs-yes answered No). */
export function flaggedQuestions(
  answers: Record<string, boolean>,
): ConsentQuestion[] {
  return CONSENT_QUESTIONS.filter(
    (q) => q.needs === "yes" && answers[q.id] === false,
  );
}

export function allAnswered(answers: Record<string, boolean>): boolean {
  return CONSENT_QUESTIONS.every((q) => answers[q.id] !== undefined);
}
