/**
 * Pure, framework-free logic for the public Enquire wizard.
 *
 * The 5-step flow (Artist → Idea → Mood board → Consultation → Details) keeps
 * all of its branching/validation here so it can be unit-tested in the node
 * environment without rendering React. The client island
 * (`EnquireWizard.tsx`) is a thin shell over these functions.
 */

/** Placement options, ported from design-src/data.jsx PLACEMENTS. */
export const PLACEMENTS = [
  "Forearm",
  "Upper arm",
  "Shoulder",
  "Back",
  "Chest",
  "Ribs",
  "Thigh",
  "Calf",
  "Hand",
  "Neck",
] as const;

/** Rough size options collected on the Idea step. */
export const SIZES = ["Small", "Medium", "Large", "Not sure yet"] as const;
export type SizeChoice = (typeof SIZES)[number];

/** General availability buckets for the Consultation step. */
export const AVAILABILITY = [
  "Weekends only",
  "Weekday evenings",
  "Weekday daytimes",
  "Flexible",
] as const;
export type AvailabilityChoice = (typeof AVAILABILITY)[number];

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export type DayChoice = (typeof DAYS)[number];

/** Free 15-minute consult times offered on working days (Tue–Sat). */
export const CONSULT_TIMES = [
  "10:00",
  "10:45",
  "11:30",
  "13:15",
  "14:00",
  "15:30",
  "16:15",
] as const;

/** Max styles a visitor can pick on the Idea step. */
export const MAX_STYLES = 3;

export const STEPS = [
  "Artist",
  "Idea",
  "Mood board",
  "Consultation",
  "Details",
] as const;
export type StepName = (typeof STEPS)[number];

/** A working day is Tue–Sat (JS getDay: 0=Sun..6=Sat → 2..6). */
export function isWorkingDay(date: Date): boolean {
  const d = date.getDay();
  return d >= 2 && d <= 6;
}

export type DayStatus = "open" | "limited" | "full";

export interface ConsultDay {
  /** ISO yyyy-mm-dd. */
  iso: string;
  day: number;
  /** 0=Sun..6=Sat. */
  weekday: number;
  working: boolean;
  status: DayStatus;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function toIso(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Build a month's worth of consult days for the calendar. Past days and
 * non-working days are `full` (unbookable); working days get a deterministic
 * open/limited status seeded from the date so the UI is stable (real
 * availability comes from AvailabilityRule + Bookings in the admin app).
 */
export function buildConsultMonth(
  year: number,
  month: number,
  today: Date = new Date(),
): ConsultDay[] {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayMid = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  ).getTime();
  const out: ConsultDay[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const working = isWorkingDay(date);
    const isPast = date.getTime() < todayMid;
    let status: DayStatus;
    if (!working || isPast) {
      status = "full";
    } else {
      // Deterministic pseudo-status: every 4th working day is "limited".
      status = d % 4 === 0 ? "limited" : "open";
    }
    out.push({
      iso: toIso(date),
      day: d,
      weekday: date.getDay(),
      working,
      status,
    });
  }
  return out;
}

/** Toggle a style within the ≤3 limit. Returns the next selection. */
export function toggleStyle(current: string[], style: string): string[] {
  if (current.includes(style)) {
    return current.filter((s) => s !== style);
  }
  if (current.length >= MAX_STYLES) return current;
  return [...current, style];
}

export interface WizardState {
  /** Artist id, or null for "no preference — match me". */
  artistId: string | null;
  styles: string[];
  subject: string;
  placement: string;
  size: SizeChoice | "";
  moodboard: string[];
  availability: AvailabilityChoice | "";
  days: DayChoice[];
  consultDate: string | null;
  consultTime: string | null;
  name: string;
  phone: string;
  email: string;
  notes: string;
  /** Optional rough budget in pounds, as typed (e.g. "150" or "£99.50"). */
  budget: string;
}

export function emptyWizardState(): WizardState {
  return {
    artistId: null,
    styles: [],
    subject: "",
    placement: "",
    size: "",
    moodboard: [],
    availability: "",
    days: [],
    consultDate: null,
    consultTime: null,
    name: "",
    phone: "",
    email: "",
    notes: "",
    budget: "",
  };
}

/** Preset budget chips offered on the Details step (pounds). */
export const BUDGET_PRESETS = [80, 150, 250, 400] as const;

/**
 * Parse a "£ pounds" input to integer pence. Tolerates a leading £, thousands
 * commas and whitespace; empty/invalid/negative input maps to null (the field
 * is optional).
 */
export function parseBudgetPounds(raw: string): number | null {
  const cleaned = raw.trim().replace(/^£/, "").replace(/,/g, "");
  if (!cleaned) return null;
  const pounds = Number(cleaned);
  if (!Number.isFinite(pounds) || pounds < 0) return null;
  return Math.round(pounds * 100);
}

export interface SeedArtistLike {
  id: string;
  slug?: string | null;
}

/**
 * Resolve the `?artist=` query seed against the wizard's artist list by DB id
 * OR slug — artist-detail and gallery deep-links pass slugs, while internal
 * links may pass ids. Unknown/missing params resolve to null (match me).
 */
export function resolveSeedArtist<T extends SeedArtistLike>(
  artists: T[],
  param: string | null | undefined,
): T | null {
  if (!param) return null;
  return artists.find((a) => a.id === param || a.slug === param) ?? null;
}

/**
 * Small note shown in the wizard when the picked artist's books are closed:
 * the enquiry still goes through, it just joins the waitlist.
 */
export function waitlistNote(
  artist: { name: string; booksStatus: string } | null | undefined,
): string | null {
  if (!artist || artist.booksStatus !== "closed") return null;
  const first = artist.name.split(" ")[0];
  return `${first}'s books are closed right now — sending this enquiry adds you to the waitlist and we'll be in touch when a space opens.`;
}

/** Max pasted reference URLs on the mood board. */
export const MAX_MOODBOARD_REFS = 6;

export type MoodboardAddResult =
  | { ok: true; refs: string[] }
  | { ok: false; error: string };

/**
 * Validate + append a pasted reference URL: must parse as http(s), is trimmed
 * and normalised, deduped, and capped at MAX_MOODBOARD_REFS.
 */
export function addMoodboardRef(
  current: string[],
  raw: string,
): MoodboardAddResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, error: "Paste an image or page URL first." };
  }
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return {
      ok: false,
      error: "That doesn't look like a full URL — include https://",
    };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, error: "References must be http(s) links." };
  }
  const normalised = url.toString();
  if (current.includes(normalised)) {
    return { ok: false, error: "That reference is already on your board." };
  }
  if (current.length >= MAX_MOODBOARD_REFS) {
    return {
      ok: false,
      error: `You can add up to ${MAX_MOODBOARD_REFS} references.`,
    };
  }
  return { ok: true, refs: [...current, normalised] };
}

/** Short display label for a reference chip: host + path, truncated. */
export function moodboardRefLabel(ref: string): string {
  let label = ref;
  try {
    const u = new URL(ref);
    label = `${u.hostname}${u.pathname.length > 1 ? u.pathname : ""}`;
  } catch {
    // Fall back to the raw string.
  }
  return label.length > 40 ? `${label.slice(0, 39)}…` : label;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Whether the visitor can advance from the given step. The Artist step always
 * allows progress ("match me" is a valid choice = null artist). The final
 * Details step requires a name and at least one contact method.
 */
export function canAdvance(step: StepName, state: WizardState): boolean {
  switch (step) {
    case "Artist":
      return true;
    case "Idea":
      return state.styles.length > 0 || state.subject.trim().length > 0;
    case "Mood board":
      return true; // optional
    case "Consultation":
      return state.availability !== "";
    case "Details":
      return isContactValid(state);
    default:
      return false;
  }
}

export function isContactValid(state: WizardState): boolean {
  if (state.name.trim().length === 0) return false;
  const hasEmail = EMAIL_RE.test(state.email.trim());
  const hasPhone = state.phone.trim().length >= 6;
  return hasEmail || hasPhone;
}

export interface EnquiryPayload {
  contactName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  preferredArtistId: string | null;
  style: string | null;
  placement: string | null;
  size: string | null;
  budgetPence: number | null;
  description: string | null;
  moodboard: string[];
  source: "web";
}

/**
 * Map the wizard state to the `POST /api/enquiries` body. Styles join into the
 * `style` field; the consult preference + chosen slot are folded into the
 * description so the studio sees them on the enquiry (a Booking type=consult is
 * created admin-side when confirmed).
 */
export function buildEnquiryPayload(state: WizardState): EnquiryPayload {
  const descParts: string[] = [];
  if (state.subject.trim()) descParts.push(state.subject.trim());
  if (state.availability) {
    descParts.push(`Availability: ${state.availability}.`);
  }
  if (state.days.length) {
    descParts.push(`Preferred days: ${state.days.join(", ")}.`);
  }
  if (state.consultDate && state.consultTime) {
    descParts.push(
      `Requested consult: ${state.consultDate} at ${state.consultTime}.`,
    );
  }
  if (state.notes.trim()) descParts.push(state.notes.trim());

  return {
    contactName: state.name.trim(),
    contactEmail: state.email.trim() ? state.email.trim() : null,
    contactPhone: state.phone.trim() ? state.phone.trim() : null,
    preferredArtistId: state.artistId,
    style: state.styles.length ? state.styles.join(", ") : null,
    placement: state.placement || null,
    size: state.size || null,
    budgetPence: parseBudgetPounds(state.budget),
    description: descParts.length ? descParts.join(" ") : null,
    moodboard: state.moodboard,
    source: "web",
  };
}
