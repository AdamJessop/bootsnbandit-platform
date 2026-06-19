import { afterAll, describe, expect, it } from "vitest";
import { closeTestDb, dbReachable, testDb, uid } from "./testdb";

describe("testdb harness", () => {
  afterAll(async () => {
    await closeTestDb();
  });

  it("uid() produces unique, prefixed ids", () => {
    const a = uid("x");
    const b = uid("x");
    expect(a.startsWith("x-")).toBe(true);
    expect(a).not.toBe(b);
  });

  it("dbReachable() returns a boolean (memoised)", async () => {
    const r = await dbReachable();
    expect(typeof r).toBe("boolean");
    // Second call must agree (memoisation).
    expect(await dbReachable()).toBe(r);
  });

  it("testDb() returns a client when DATABASE_URL is set", async () => {
    if (!process.env.DATABASE_URL) return;
    expect(testDb()).toBeDefined();
  });
});
