import { afterAll, describe, expect, it } from "vitest";
import {
  createCustomerWithWelcome,
  resendSetPasswordLink,
} from "./customer-welcome";
import { closeTestDb, dbReachable, testDb, uid } from "./testdb";

const db = () => testDb();

/**
 * Orchestration: create a customer (with DOB) + mint a set-password token +
 * send (log) the welcome email. No RESEND_API_KEY in tests, so sends are
 * recorded as `logged` MessageLog rows — which is exactly what we assert.
 */
describe("createCustomerWithWelcome (DB)", () => {
  const cleanup = { customers: [] as string[] };

  afterAll(async () => {
    if (cleanup.customers.length) {
      await db().customer.deleteMany({
        where: { id: { in: cleanup.customers } },
      });
    }
    await closeTestDb();
  });

  it("creates the customer with dob, mints a token and logs a welcome email", async () => {
    if (!(await dbReachable())) return;
    const email = `${uid("wel")}@example.com`;

    const customer = await createCustomerWithWelcome({
      name: "New Collector",
      email,
      dob: new Date(Date.UTC(1990, 4, 17)),
      siteOrigin: "http://localhost:3000",
    });
    cleanup.customers.push(customer.id);

    expect(customer.email).toBe(email);
    expect(customer.dob?.toISOString()).toBe("1990-05-17T00:00:00.000Z");

    const tokens = await db().customerPasswordToken.findMany({
      where: { customerId: customer.id },
    });
    expect(tokens).toHaveLength(1);

    const logs = await db().messageLog.findMany({
      where: { customerId: customer.id, type: "welcome" },
    });
    expect(logs).toHaveLength(1);
    expect(logs[0].body).toContain(
      `/account/set-password?token=${tokens[0].token}`,
    );
  });

  it("resendSetPasswordLink mints a fresh token and logs another welcome email", async () => {
    if (!(await dbReachable())) return;
    const email = `${uid("re")}@example.com`;
    const customer = await createCustomerWithWelcome({
      name: "Expired Link",
      email,
      dob: null,
      siteOrigin: "http://localhost:3000",
    });
    cleanup.customers.push(customer.id);

    const token = await resendSetPasswordLink(
      customer.id,
      "http://localhost:3000",
    );
    expect(token).toBeTruthy();

    const logs = await db().messageLog.findMany({
      where: { customerId: customer.id, type: "welcome" },
    });
    expect(logs).toHaveLength(2);
  });
});
