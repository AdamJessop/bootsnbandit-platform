/**
 * Pure helpers for the weekly working-hours editor (BACKOFHOUSE-IA H1). The
 * AvailabilityRule shape is { weekday 0-6, startTime/endTime "HH:MM" }; the UI
 * works on a 7-slot week state. Unit-tested in node.
 */

export interface WeekdayMeta {
  weekday: number;
  label: string;
}

export const WEEKDAYS: WeekdayMeta[] = [
  { weekday: 0, label: "Sun" },
  { weekday: 1, label: "Mon" },
  { weekday: 2, label: "Tue" },
  { weekday: 3, label: "Wed" },
  { weekday: 4, label: "Thu" },
  { weekday: 5, label: "Fri" },
  { weekday: 6, label: "Sat" },
];

export interface DayState {
  enabled: boolean;
  start: string;
  end: string;
}

export type WeekState = DayState[]; // length 7, indexed by weekday

export interface AvailabilityRule {
  weekday: number;
  startTime: string;
  endTime: string;
}

const DEFAULT_DAY: DayState = { enabled: false, start: "10:00", end: "18:00" };

/** Build a 7-day week state from saved rules (defaults disabled). */
export function rulesToWeekState(rules: AvailabilityRule[]): WeekState {
  const state: WeekState = WEEKDAYS.map(() => ({ ...DEFAULT_DAY }));
  for (const r of rules) {
    if (r.weekday < 0 || r.weekday > 6) continue;
    state[r.weekday] = {
      enabled: true,
      start: r.startTime,
      end: r.endTime,
    };
  }
  return state;
}

/** Emit AvailabilityRule[] for the enabled days only. */
export function weekStateToRules(state: WeekState): AvailabilityRule[] {
  const rules: AvailabilityRule[] = [];
  state.forEach((day, weekday) => {
    if (day.enabled) {
      rules.push({ weekday, startTime: day.start, endTime: day.end });
    }
  });
  return rules;
}

/** A day is valid when disabled, or when end is strictly after start. */
export function validateDay(day: DayState): boolean {
  if (!day.enabled) return true;
  return day.end > day.start;
}

/**
 * Toast copy after POST /api/leave succeeds. Artist-declared leave is created
 * `pending` and only blocks the calendar once an owner approves it — say so,
 * instead of claiming the calendar is already marked unavailable.
 */
export function leaveDeclaredMessage(status: string | undefined): string {
  return status === "pending"
    ? "Leave requested — an owner must approve it before it blocks the calendar."
    : "Leave declared — calendar marked unavailable.";
}
