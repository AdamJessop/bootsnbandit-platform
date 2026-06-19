import { afterAll, describe, expect, it } from "vitest";
import postgres from "postgres";

/**
 * Asserts the seeded row counts match the canonical content from
 * design-src/data.jsx + COMPOSITION-NOTES.md.
 *
 * Requires a running, migrated and seeded Postgres (see docker-compose.yml):
 *   docker compose up -d
 *   npm run db:migrate && npm run db:seed
 *
 * Skips itself gracefully when DATABASE_URL is unset or the DB is unreachable,
 * so it never breaks `npm test` in environments without a database.
 */
const rawUrl = process.env.DATABASE_URL?.replace(/\?.*$/, "");

const EXPECTED: Record<string, number> = {
  Artist: 7,
  GalleryItem: 26,
  Flash: 9,
  TattooStyle: 9,
  Faq: 7,
  AftercareStage: 5,
  SiteSettings: 1,
};

const sql = rawUrl ? postgres(rawUrl, { onnotice: () => {} }) : null;

async function dbReachable(): Promise<boolean> {
  if (!sql) return false;
  try {
    await sql`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

describe("seed counts", () => {
  afterAll(async () => {
    if (sql) await sql.end();
  });

  it("loads the canonical content counts", async () => {
    if (!(await dbReachable())) {
      // No DB available in this environment — nothing to assert.
      return;
    }
    for (const [table, expected] of Object.entries(EXPECTED)) {
      const rows = await sql!.unsafe<{ n: number }[]>(
        `SELECT count(*)::int AS n FROM "${table}"`,
      );
      expect(rows[0].n, `${table} count`).toBe(expected);
    }
  });

  it("has at least one loyalty config", async () => {
    if (!(await dbReachable())) return;
    const rows = await sql!`SELECT count(*)::int AS n FROM "LoyaltyConfig"`;
    expect(rows[0].n).toBeGreaterThanOrEqual(1);
  });

  it("has a demo OWNER user (adamjjessop@gmail.com)", async () => {
    if (!(await dbReachable())) return;
    const rows = await sql!`
      SELECT count(*)::int AS n FROM "User"
      WHERE "email" = 'adamjjessop@gmail.com' AND "role" = 'OWNER'
    `;
    expect(rows[0].n).toBe(1);
  });

  it("creates one User per artist, each linked 1:1 (7 users, all linked)", async () => {
    if (!(await dbReachable())) return;
    const users = await sql!`SELECT count(*)::int AS n FROM "User"`;
    expect(users[0].n, "User count").toBe(7);
    // Every artist has a (required) userId, so every user is linked to an artist.
    const linked = await sql!`
      SELECT count(*)::int AS n FROM "User" u
      WHERE EXISTS (SELECT 1 FROM "Artist" a WHERE a."userId" = u."id")
    `;
    expect(linked[0].n, "linked users").toBe(7);
  });

  it("has exactly 2 OWNER users (the co-owners)", async () => {
    if (!(await dbReachable())) return;
    const rows = await sql!`
      SELECT count(*)::int AS n FROM "User" WHERE "role" = 'OWNER'
    `;
    expect(rows[0].n).toBe(2);
  });

  it("gives every artist ≥1 connected style and non-null numeric rates", async () => {
    if (!(await dbReachable())) return;
    // No artist may have zero connected styles.
    const noStyles = await sql!`
      SELECT count(*)::int AS n FROM "Artist" a
      WHERE NOT EXISTS (
        SELECT 1 FROM "_ArtistToTattooStyle" j WHERE j."A" = a."id"
      )
    `;
    expect(noStyles[0].n, "artists with no styles").toBe(0);

    // hourlyRatePence + dayRatePence must be set on every artist.
    const missingRates = await sql!`
      SELECT count(*)::int AS n FROM "Artist"
      WHERE "hourlyRatePence" IS NULL OR "dayRatePence" IS NULL
    `;
    expect(missingRates[0].n, "artists with a null rate").toBe(0);
  });
});
