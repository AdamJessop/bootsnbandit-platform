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
    expect(second.phone).toBe("0700");
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
