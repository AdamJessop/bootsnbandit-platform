import { afterAll, describe, expect, it } from "vitest";
import {
  hashPassword,
  verifyPassword,
  mintSetPasswordToken,
  redeemSetPasswordToken,
  signInCustomer,
  SET_PASSWORD_TOKEN_TTL_DAYS,
} from "./customer-auth";
import { closeTestDb, dbReachable, testDb, uid } from "./testdb";

const db = () => testDb();

describe("password hashing (scrypt)", () => {
  it("hashes and verifies a password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("correct horse battery staple", hash)).toBe(
      true,
    );
    expect(await verifyPassword("wrong password", hash)).toBe(false);
  });

  it("produces unique salts per hash", async () => {
    const a = await hashPassword("same-input");
    const b = await hashPassword("same-input");
    expect(a).not.toBe(b);
  });

  it("rejects malformed stored hashes without throwing", async () => {
    expect(await verifyPassword("x", "not-a-hash")).toBe(false);
    expect(await verifyPassword("x", "scrypt$bad")).toBe(false);
  });
});

describe("set-password token lifecycle (DB)", () => {
  const cleanup = { customers: [] as string[] };

  afterAll(async () => {
    if (cleanup.customers.length) {
      await db().customer.deleteMany({
        where: { id: { in: cleanup.customers } },
      });
    }
    await closeTestDb();
  });

  async function makeCustomer(email?: string) {
    const c = await db().customer.create({
      data: { name: `Test ${uid()}`, email: email ?? `${uid()}@example.com` },
    });
    cleanup.customers.push(c.id);
    return c;
  }

  it("mints a ~30-day token and redeems it, setting the password", async () => {
    if (!(await dbReachable())) return;
    const customer = await makeCustomer();

    const token = await mintSetPasswordToken(customer.id);
    const row = await db().customerPasswordToken.findUnique({
      where: { token },
    });
    expect(row).not.toBeNull();
    const days = (row!.expiresAt.getTime() - Date.now()) / (24 * 3600 * 1000);
    expect(days).toBeGreaterThan(SET_PASSWORD_TOKEN_TTL_DAYS - 1);
    expect(days).toBeLessThanOrEqual(SET_PASSWORD_TOKEN_TTL_DAYS);

    const result = await redeemSetPasswordToken(token, "new-password-123");
    expect(result).toEqual({ ok: true, customerId: customer.id });

    const updated = await db().customer.findUnique({
      where: { id: customer.id },
    });
    expect(updated?.passwordHash).toBeTruthy();
    expect(
      await verifyPassword("new-password-123", updated!.passwordHash!),
    ).toBe(true);
  });

  it("cannot redeem the same token twice", async () => {
    if (!(await dbReachable())) return;
    const customer = await makeCustomer();
    const token = await mintSetPasswordToken(customer.id);
    await redeemSetPasswordToken(token, "first-password");
    const second = await redeemSetPasswordToken(token, "second-password");
    expect(second).toEqual({ ok: false, reason: "invalid" });
  });

  it("returns expired + customerId for an expired token (reissue path)", async () => {
    if (!(await dbReachable())) return;
    const customer = await makeCustomer();
    const token = await mintSetPasswordToken(customer.id);
    await db().customerPasswordToken.update({
      where: { token },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const result = await redeemSetPasswordToken(token, "whatever");
    expect(result).toEqual({
      ok: false,
      reason: "expired",
      customerId: customer.id,
    });
    const fresh = await db().customer.findUnique({
      where: { id: customer.id },
    });
    expect(fresh?.passwordHash).toBeNull();
  });

  it("returns invalid for an unknown token", async () => {
    if (!(await dbReachable())) return;
    expect(await redeemSetPasswordToken("nope", "pw")).toEqual({
      ok: false,
      reason: "invalid",
    });
  });

  it("invalidates other outstanding tokens on redeem", async () => {
    if (!(await dbReachable())) return;
    const customer = await makeCustomer();
    const t1 = await mintSetPasswordToken(customer.id);
    const t2 = await mintSetPasswordToken(customer.id);
    await redeemSetPasswordToken(t2, "chosen-password");
    expect(await redeemSetPasswordToken(t1, "other")).toEqual({
      ok: false,
      reason: "invalid",
    });
  });

  it("signs in the newest credentialed customer for an email", async () => {
    if (!(await dbReachable())) return;
    const email = `${uid("dup")}@example.com`;
    const older = await makeCustomer(email);
    const newer = await makeCustomer(email);
    const token = await mintSetPasswordToken(newer.id);
    await redeemSetPasswordToken(token, "letmein-42");

    const hit = await signInCustomer(email, "letmein-42");
    expect(hit?.id).toBe(newer.id);
    expect(await signInCustomer(email, "wrong")).toBeNull();
    expect(await signInCustomer("nobody@example.com", "x")).toBeNull();
    // The older, credential-less record never matches.
    expect(older.passwordHash).toBeNull();
  });
});

describe("email normalization (DB)", () => {
  it("signs in regardless of email casing/whitespace", async () => {
    if (!(await dbReachable())) return;
    const base = `${uid("case")}@example.com`;
    const c = await testDb().customer.create({
      data: { name: "Cased", email: base },
    });
    const token = await mintSetPasswordToken(c.id);
    await redeemSetPasswordToken(token, "pw-case-123");

    const upper = base.toUpperCase();
    const hit = await signInCustomer(`  ${upper}  `, "pw-case-123");
    expect(hit?.id).toBe(c.id);
    await testDb().customer.delete({ where: { id: c.id } });
  });
});
