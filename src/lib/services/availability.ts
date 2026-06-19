import type { AvailabilityRule } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * Availability — per-artist weekly working pattern (BACKOFHOUSE-IA H1).
 * Rules are `weekday` (0=Sun..6=Sat) + "HH:MM" start/end within studio hours.
 */

export interface AvailabilityRuleInput {
  weekday: number;
  startTime: string;
  endTime: string;
}

export async function listAvailabilityRules(
  artistId: string,
): Promise<AvailabilityRule[]> {
  return prisma.availabilityRule.findMany({
    where: { artistId },
    orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
  });
}

/**
 * Replace an artist's entire weekly pattern with `rules` (atomic). Editing the
 * pattern from the admin UI saves the whole set at once.
 */
export async function setAvailabilityRules(
  artistId: string,
  rules: AvailabilityRuleInput[],
): Promise<AvailabilityRule[]> {
  await prisma.$transaction([
    prisma.availabilityRule.deleteMany({ where: { artistId } }),
    prisma.availabilityRule.createMany({
      data: rules.map((r) => ({
        artistId,
        weekday: r.weekday,
        startTime: r.startTime,
        endTime: r.endTime,
      })),
    }),
  ]);
  return listAvailabilityRules(artistId);
}

/** True when `date`'s weekday/time falls inside any of the artist's rules. */
export function isWithinAvailability(
  rules: AvailabilityRule[],
  date: Date,
): boolean {
  const weekday = date.getUTCDay();
  const hhmm = `${String(date.getUTCHours()).padStart(2, "0")}:${String(
    date.getUTCMinutes(),
  ).padStart(2, "0")}`;
  return rules.some(
    (r) => r.weekday === weekday && hhmm >= r.startTime && hhmm < r.endTime,
  );
}
