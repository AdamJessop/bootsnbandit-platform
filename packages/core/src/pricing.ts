/**
 * Session price suggestion.
 *
 * Given an artist's numeric rates and a session duration, suggest a price in
 * integer pence. Used to pre-fill (editable) the booking/session drawer.
 *
 * Rule: a session of 6 hours or more (360 min) with a day rate set uses the day
 * rate; otherwise charge ceil(hours) × the hourly rate. If neither applies the
 * suggestion is `undefined` (the operator types a price manually).
 */

const DAY_RATE_THRESHOLD_MIN = 360;

export interface ArtistRates {
  hourlyRatePence?: number | null;
  dayRatePence?: number | null;
}

export function suggestSessionPricePence(
  a: ArtistRates,
  durationMin: number,
): number | undefined {
  if (durationMin >= DAY_RATE_THRESHOLD_MIN && a.dayRatePence != null) {
    return a.dayRatePence;
  }
  if (a.hourlyRatePence != null) {
    return Math.ceil(durationMin / 60) * a.hourlyRatePence;
  }
  return undefined;
}
