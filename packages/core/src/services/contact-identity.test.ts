import { afterAll, describe, expect, it } from "vitest";
import {
  displayNameFor,
  findOrCreateCustomer,
  linkIdentity,
  normaliseEmail,
  normalisePhone,
} from "./contact-identity";
import { closeTestDb, dbReachable, testDb, uid } from "./testdb";

describe("normaliseEmail", () => {
  it("trims and lowercases a valid address", () => {
    expect(normaliseEmail("  Amy.Jones@Example.COM ")).toBe(
      "amy.jones@example.com",
    );
  });

  it("returns null for blank / missing / malformed values", () => {
    expect(normaliseEmail(null)).toBeNull();
    expect(normaliseEmail(undefined)).toBeNull();
    expect(normaliseEmail("   ")).toBeNull();
    expect(normaliseEmail("not-an-email")).toBeNull();
    expect(normaliseEmail("a@b")).toBeNull();
    expect(normaliseEmail("two words@example.com")).toBeNull();
  });

  it("keeps plus-addressing and dots (they are distinct mailboxes)", () => {
    expect(normaliseEmail("amy+ink@example.com")).toBe("amy+ink@example.com");
  });
});

describe("normalisePhone", () => {
  it("converts UK national formats to E.164", () => {
    expect(normalisePhone("07700 900123")).toBe("+447700900123");
    expect(normalisePhone("07700900123")).toBe("+447700900123");
    expect(normalisePhone("+44 7700 900123")).toBe("+447700900123");
    expect(normalisePhone("(020) 7946 0958")).toBe("+442079460958");
  });

  it("keeps an explicit international number in its own country", () => {
    expect(normalisePhone("+1 415 555 2671")).toBe("+14155552671");
  });

  it("returns null for blank / missing / unparseable values", () => {
    expect(normalisePhone(null)).toBeNull();
    expect(normalisePhone(undefined)).toBeNull();
    expect(normalisePhone("  ")).toBeNull();
    expect(normalisePhone("call me")).toBeNull();
    expect(normalisePhone("12345")).toBeNull();
  });
});

describe("displayNameFor", () => {
  it("prefers the given name, then the identity display name, then the email local part", () => {
    expect(displayNameFor({ name: " Amy Jones " })).toBe("Amy Jones");
    expect(
      displayNameFor({
        name: "  ",
        identity: { channel: "messenger", externalId: "p1", displayName: "Amy J" },
      }),
    ).toBe("Amy J");
    expect(displayNameFor({ email: "amy.jones@example.com" })).toBe(
      "amy.jones",
    );
    expect(displayNameFor({})).toBe("Customer");
  });
});

describe("findOrCreateCustomer + linkIdentity (DB)", () => {
  const db = () => testDb();
  const customers: string[] = [];

  afterAll(async () => {
    if ((await dbReachable()) && customers.length) {
      await db().customer.deleteMany({ where: { id: { in: customers } } });
    }
    await closeTestDb();
  });

  const track = (c: { id: string }) => {
    if (!customers.includes(c.id)) customers.push(c.id);
    return c;
  };

  it("stores normalised contact details on create", async () => {
    if (!(await dbReachable())) return;
    const local = uid("amy");
    const created = track(
      await findOrCreateCustomer({
        name: "Amy",
        email: `  ${local}@Example.COM `,
        phone: "07700 900123",
      }),
    );
    expect(created.email).toBe(`${local}@example.com`);
    expect(created.phone).toBe("+447700900123");
  });

  it("matches an existing customer on a differently-formatted email or phone", async () => {
    if (!(await dbReachable())) return;
    const local = uid("bee");
    const first = track(
      await findOrCreateCustomer({
        name: "Bee",
        email: `${local}@example.com`,
        phone: "07700 900124",
      }),
    );
    const byEmail = await findOrCreateCustomer({
      name: "Someone Else",
      email: `  ${local.toUpperCase()}@EXAMPLE.com`,
    });
    const byPhone = await findOrCreateCustomer({
      name: "Someone Else",
      phone: "+44 7700 900124",
    });
    expect(byEmail.id).toBe(first.id);
    expect(byPhone.id).toBe(first.id);
    // Contact-takeover guard: a match is returned UNMUTATED.
    expect(byEmail.name).toBe("Bee");
    expect(byPhone.email).toBe(`${local}@example.com`);
  });

  it("creates a fresh row when nothing matches, falling back for the name", async () => {
    if (!(await dbReachable())) return;
    const local = uid("cee");
    const created = track(
      await findOrCreateCustomer({ email: `${local}@example.com` }),
    );
    expect(created.name).toBe(local);
    expect(created.phone).toBeNull();
  });

  it("keeps an unparseable phone out of the contact column", async () => {
    if (!(await dbReachable())) return;
    const created = track(
      await findOrCreateCustomer({ name: `Dee ${uid()}`, phone: "call me" }),
    );
    expect(created.phone).toBeNull();
  });

  it("resolves a Meta handle to its customer and links new handles", async () => {
    if (!(await dbReachable())) return;
    const psid = uid("psid");
    const first = track(
      await findOrCreateCustomer({
        identity: { channel: "messenger", externalId: psid, displayName: "Zed M" },
      }),
    );
    expect(first.name).toBe("Zed M");

    const again = await findOrCreateCustomer({
      identity: { channel: "messenger", externalId: psid },
    });
    expect(again.id).toBe(first.id);
    expect(
      await db().customerIdentity.count({ where: { customerId: first.id } }),
    ).toBe(1);

    // Linking is idempotent and attaches extra handles to the same customer.
    const igsid = uid("igsid");
    await linkIdentity(first.id, "instagram", igsid, "zed.m");
    await linkIdentity(first.id, "instagram", igsid, "zed.m");
    expect(
      await db().customerIdentity.count({ where: { customerId: first.id } }),
    ).toBe(2);
  });

  it("links a handle onto an existing customer matched by email", async () => {
    if (!(await dbReachable())) return;
    const local = uid("eff");
    const first = track(
      await findOrCreateCustomer({ name: "Eff", email: `${local}@example.com` }),
    );
    const psid = uid("psid");
    const same = await findOrCreateCustomer({
      email: `${local}@example.com`,
      identity: { channel: "messenger", externalId: psid, displayName: "Eff" },
    });
    expect(same.id).toBe(first.id);
    expect(
      await db().customerIdentity.findUnique({
        where: { channel_externalId: { channel: "messenger", externalId: psid } },
      }),
    ).toMatchObject({ customerId: first.id });
  });

  it("the database refuses a second customer with the same email or phone", async () => {
    if (!(await dbReachable())) return;
    const local = uid("uniq");
    const first = track(
      await findOrCreateCustomer({
        name: "Uniq",
        email: `${local}@example.com`,
        phone: "07700 900126",
      }),
    );
    await expect(
      db().customer.create({
        data: { name: "Copy", email: `${local}@example.com` },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
    await expect(
      db().customer.create({ data: { name: "Copy", phone: "+447700900126" } }),
    ).rejects.toMatchObject({ code: "P2002" });
    // Many contact-less customers are fine — Postgres treats NULLs as distinct.
    const a = track(await db().customer.create({ data: { name: `Blank ${uid()}` } }));
    const b = track(await db().customer.create({ data: { name: `Blank ${uid()}` } }));
    expect(a.id).not.toBe(b.id);
    expect(first.email).toBe(`${local}@example.com`);
  });
});

describe("duplicate-contact guards (DB)", () => {
  const db = () => testDb();
  const made: string[] = [];

  afterAll(async () => {
    if ((await dbReachable()) && made.length) {
      await db().customer.deleteMany({ where: { id: { in: made } } });
    }
    await closeTestDb();
  });

  it("createCustomer normalises and reports a duplicate readably", async () => {
    if (!(await dbReachable())) return;
    const { createCustomer } = await import("./customers");
    const { DuplicateContactError } = await import("./contact-identity");
    const local = uid("guard");
    const c = await createCustomer({
      name: "Guard",
      email: `  ${local}@EXAMPLE.com `,
      phone: "07700 900127",
    });
    made.push(c.id);
    expect(c.email).toBe(`${local}@example.com`);
    expect(c.phone).toBe("+447700900127");
    await expect(
      createCustomer({ name: "Guard 2", email: `${local}@example.com` }),
    ).rejects.toBeInstanceOf(DuplicateContactError);
  });
});
