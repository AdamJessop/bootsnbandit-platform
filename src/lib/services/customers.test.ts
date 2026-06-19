import { afterAll, describe, expect, it } from "vitest";
import {
  createCustomer,
  getCustomer,
  listCustomers,
  upsertCustomerByContact,
} from "./customers";
import { closeTestDb, dbReachable, testDb, uid } from "./testdb";

describe("customers service (DB)", () => {
  const db = () => testDb();
  const created: string[] = [];

  afterAll(async () => {
    if (created.length) {
      await db().customer.deleteMany({ where: { id: { in: created } } });
    }
    await closeTestDb();
  });

  it("createCustomer stores name + contact + consent", async () => {
    if (!(await dbReachable())) return;
    const email = `${uid("c")}@example.com`;
    const c = await createCustomer({
      name: "Ada Collector",
      email,
      marketingConsent: true,
    });
    created.push(c.id);
    expect(c.name).toBe("Ada Collector");
    expect(c.email).toBe(email);
    expect(c.marketingConsent).toBe(true);
  });

  it("upsertCustomerByContact reuses an existing email match", async () => {
    if (!(await dbReachable())) return;
    const email = `${uid("c")}@example.com`;
    const first = await upsertCustomerByContact({ name: "Dee", email });
    created.push(first.id);
    const second = await upsertCustomerByContact({
      name: "Dee R",
      email,
      phone: "0700",
    });
    expect(second.id).toBe(first.id);
  });

  it("upsertCustomerByContact does NOT overwrite contact/consent on match", async () => {
    if (!(await dbReachable())) return;
    // An existing customer with known phone + consent.
    const email = `${uid("c")}@example.com`;
    const phone = `+44${Date.now()}`;
    const original = await createCustomer({
      name: "Existing",
      email,
      phone,
      marketingConsent: true,
    });
    created.push(original.id);

    // A stranger on the public path matches by email and tries to
    // change the phone and revoke consent. The match must be returned
    // unmutated so they cannot take over the contact record.
    const result = await upsertCustomerByContact({
      name: "Stranger",
      email,
      phone: "0000-attacker",
      marketingConsent: false,
    });

    expect(result.id).toBe(original.id);
    expect(result.phone).toBe(phone);
    expect(result.email).toBe(email);
    expect(result.marketingConsent).toBe(true);
  });

  it("upsertCustomerByContact creates anew when no contact match", async () => {
    if (!(await dbReachable())) return;
    const c = await upsertCustomerByContact({ name: `NoMatch ${uid()}` });
    created.push(c.id);
    expect(c.id).toBeTruthy();
  });

  it("getCustomer + listCustomers return rows", async () => {
    if (!(await dbReachable())) return;
    const c = await createCustomer({ name: `List ${uid()}` });
    created.push(c.id);
    const got = await getCustomer(c.id);
    expect(got?.id).toBe(c.id);
    const list = await listCustomers({ take: 5 });
    expect(Array.isArray(list)).toBe(true);
  });
});
