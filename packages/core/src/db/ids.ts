import { randomBytes } from "node:crypto";

/**
 * Generate a cuid-like, collision-resistant id for rows inserted via raw SQL.
 *
 * The seed writes through the `postgres` (porsager) driver, so Prisma's
 * `@default(cuid())` — applied by the Prisma client, not the database — does
 * not fire and we must supply ids ourselves. Format: `c` + base36 timestamp +
 * random hex, lower-case alphanumeric (~25 chars). Uniqueness, not strict cuid
 * spec-compliance, is the requirement for primary keys here.
 */
export function createId(): string {
  const time = Date.now().toString(36);
  const rand = randomBytes(12).toString("hex").slice(0, 16);
  return `c${time}${rand}`.toLowerCase();
}
