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
});
