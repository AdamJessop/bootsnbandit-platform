import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("db singleton", () => {
  const originalUrl = process.env.DATABASE_URL;

  beforeEach(() => {
    // Reset module + global cache between tests.
    (globalThis as Record<string, unknown>).prisma = undefined;
  });

  afterEach(() => {
    process.env.DATABASE_URL = originalUrl;
    (globalThis as Record<string, unknown>).prisma = undefined;
  });

  it("importing the module does not construct a client (side-effect free)", async () => {
    // No DATABASE_URL set and no adapter installed; import must still succeed.
    delete process.env.DATABASE_URL;
    const mod = await import("./db");
    expect(mod.prisma).toBeDefined();
    expect(typeof mod.createPrismaClient).toBe("function");
  });

  it("createPrismaClient throws a clear error when DATABASE_URL is missing", async () => {
    delete process.env.DATABASE_URL;
    const { createPrismaClient } = await import("./db");
    expect(() => createPrismaClient()).toThrow(/DATABASE_URL is not set/);
  });

  it("createPrismaClient surfaces a clear error when the pg adapter is absent", async () => {
    process.env.DATABASE_URL = "postgresql://u:p@localhost:5435/db";
    const { createPrismaClient } = await import("./db");
    // @prisma/adapter-pg is not installed in Phase 2; expect the guidance error.
    expect(() => createPrismaClient()).toThrow(/@prisma\/adapter-pg/);
  });
});
