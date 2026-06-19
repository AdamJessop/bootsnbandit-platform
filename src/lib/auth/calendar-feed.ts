import "server-only";
import { prisma } from "@/lib/db";
import { generateToken } from "./tokens";

/**
 * Ensure an artist has a CalendarFeed row (unique per artist) with a random
 * token. Called on artist enrolment / login so the per-artist iCal feed P12
 * consumes always exists. Idempotent: returns the existing feed if present.
 */
export async function ensureCalendarFeed(
  artistId: string,
): Promise<{ id: string; token: string }> {
  const existing = await prisma.calendarFeed.findUnique({
    where: { artistId },
  });
  if (existing) {
    return { id: existing.id, token: existing.token };
  }

  // upsert guards against a race where two requests bootstrap simultaneously.
  const feed = await prisma.calendarFeed.upsert({
    where: { artistId },
    create: { artistId, token: generateToken() },
    update: {},
  });
  return { id: feed.id, token: feed.token };
}
