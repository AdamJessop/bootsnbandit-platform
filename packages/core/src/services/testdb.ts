import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Shared test database harness for service integration tests.
 *
 * Provides a real PrismaClient against the dockerised Postgres plus a
 * reachability probe so suites skip gracefully when no DB is available
 * (matching the project's existing seed-counts test pattern).
 */

let client: PrismaClient | null = null;

export function testDb(): PrismaClient {
  if (client) return client;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  client = new PrismaClient({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    adapter: new PrismaPg({ connectionString }) as any,
    log: ["error"],
  });
  return client;
}

let reachable: boolean | null = null;

/** True when the configured Postgres answers a trivial query. Memoised. */
export async function dbReachable(): Promise<boolean> {
  if (reachable !== null) return reachable;
  if (!process.env.DATABASE_URL) {
    reachable = false;
    return reachable;
  }
  try {
    await testDb().$queryRaw`SELECT 1`;
    reachable = true;
  } catch {
    reachable = false;
  }
  return reachable;
}

/** Disconnect the shared client (call in afterAll). */
export async function closeTestDb(): Promise<void> {
  if (client) {
    await client.$disconnect();
    client = null;
  }
}

/** Unique suffix for fixture rows so parallel/repeat runs never collide. */
export function uid(prefix = "t"): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}
