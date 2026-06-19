import { PrismaClient } from "@prisma/client";

/**
 * Prisma client singleton (Next.js pattern).
 *
 * Prisma 7 uses the query-compiler engine, which REQUIRES a driver adapter to
 * connect at runtime. The intended adapter is `@prisma/adapter-pg` (node-postgres)
 * pointed at `DATABASE_URL`.
 *
 * NOTE (Phase 2): `@prisma/adapter-pg` + `pg` are not yet in package.json
 * (package.json is owned by another phase this wave). To keep `next build`
 * green we resolve the adapter lazily — importing this module never throws,
 * but the first real query will surface a clear error if the adapter is
 * missing. Once `npm i @prisma/adapter-pg pg` lands, runtime works unchanged.
 *
 * In dev we cache the client on `globalThis` so Next.js hot-reload does not
 * exhaust the connection pool.
 */

function resolvePgAdapter(connectionString: string): {
  // Loosely typed: the package may not be installed at build time.
  adapter: unknown;
} {
  try {
    // Lazy require so a missing optional dep does not break the build.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaPg } = require("@prisma/adapter-pg") as {
      PrismaPg: new (config: { connectionString: string }) => unknown;
    };
    return { adapter: new PrismaPg({ connectionString }) };
  } catch {
    throw new Error(
      "Prisma 7 requires a driver adapter. Install it with: npm i @prisma/adapter-pg pg",
    );
  }
}

export function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  const { adapter } = resolvePgAdapter(connectionString);
  return new PrismaClient({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    adapter: adapter as any,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Lazily-constructed singleton. The client is only built on first property
 * access, so importing `prisma` is side-effect-free (keeps build green even
 * before the adapter dependency is installed).
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = (globalForPrisma.prisma ??= createPrismaClient());
    if (process.env.NODE_ENV !== "production") {
      globalForPrisma.prisma = client;
    }
    return Reflect.get(client, prop, receiver);
  },
});

export default prisma;
