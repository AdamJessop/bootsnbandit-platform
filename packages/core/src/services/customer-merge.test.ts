import { afterAll, describe, expect, it } from "vitest";
import { applyMergeGroup, mergeDuplicateCustomers } from "./customer-merge";
import { closeTestDb, dbReachable, testDb, uid } from "./testdb";

/**
 * Every run below is scoped with `onlyIds` to the fixtures the test just
 * created: the merge deletes rows, so an unscoped run against whatever
 * `DATABASE_URL` points at must never be possible from the test suite.
 */
describe("mergeDuplicateCustomers (DB)", () => {
  const db = () => testDb();
  const customers: string[] = [];
  const enquiries: string[] = [];

  const track = <T extends { id: string }>(row: T): T => {
    customers.push(row.id);
    return row;
  };

  afterAll(async () => {
    if (await dbReachable()) {
      if (enquiries.length)
        await db().enquiry.deleteMany({ where: { id: { in: enquiries } } });
      if (customers.length)
        await db().customer.deleteMany({ where: { id: { in: customers } } });
    }
    await closeTestDb();
  });

  it("dry run reports without writing; the real run merges and is idempotent", async () => {
    if (!(await dbReachable())) return;
    const local = uid("merge");
    const older = track(
      await db().customer.create({
        data: {
          name: "Older",
          email: `${local}@example.com`,
          loyaltyStamps: 2,
          tags: ["vip"],
          createdAt: new Date("2026-01-01T00:00:00Z"),
        },
      }),
    );
    const newer = track(
      await db().customer.create({
        data: {
          name: "Newer",
          email: `${local.toUpperCase()}@EXAMPLE.com`,
          loyaltyStamps: 3,
          marketingConsent: true,
          tags: ["walk-in"],
          createdAt: new Date("2026-02-01T00:00:00Z"),
        },
      }),
    );
    const onlyIds = [older.id, newer.id];
    const enquiry = await db().enquiry.create({
      data: { contactName: "Newer", customerId: newer.id },
    });
    enquiries.push(enquiry.id);

    const dry = await mergeDuplicateCustomers({
      dryRun: true,
      log: () => {},
      onlyIds,
    });
    expect(dry.dryRun).toBe(true);
    expect(dry.scanned).toBe(2);
    expect(dry.groups).toBe(1);
    expect(dry.failed).toBe(0);
    // The survivor's own email is already normalised, so the dry run must not
    // claim a re-normalise the real run will not perform.
    expect(dry.renormalised).toBe(0);
    expect(
      await db().customer.findUnique({ where: { id: newer.id } }),
    ).not.toBeNull();

    const run = await mergeDuplicateCustomers({ log: () => {}, onlyIds });
    expect(run.merged).toBe(1);
    expect(run.failed).toBe(0);
    expect(run.renormalised).toBe(0);
    expect(
      await db().customer.findUnique({ where: { id: newer.id } }),
    ).toBeNull();
    const survivor = await db().customer.findUniqueOrThrow({
      where: { id: older.id },
    });
    expect(survivor.email).toBe(`${local}@example.com`);
    expect(survivor.loyaltyStamps).toBe(5);
    expect(survivor.marketingConsent).toBe(true);
    expect(survivor.tags.sort()).toEqual(["vip", "walk-in"]);
    expect(survivor.notes).toContain("[merged Newer]");
    expect(
      (await db().enquiry.findUniqueOrThrow({ where: { id: enquiry.id } }))
        .customerId,
    ).toBe(older.id);

    // Idempotent: a second run finds nothing left to merge for this pair.
    const again = await mergeDuplicateCustomers({ log: () => {}, onlyIds });
    expect(again.groups).toBe(0);
    expect(again.renormalised).toBe(0);
    expect(
      await db().customer.findUnique({ where: { id: newer.id } }),
    ).toBeNull();
  });

  it("re-normalises contact details on rows that have no duplicate", async () => {
    if (!(await dbReachable())) return;
    const local = uid("solo");
    const solo = track(
      await db().customer.create({
        data: {
          name: "Solo",
          email: `${local}@EXAMPLE.com`,
          phone: "07700 900125",
        },
      }),
    );
    await mergeDuplicateCustomers({ log: () => {}, onlyIds: [solo.id] });
    const after = await db().customer.findUniqueOrThrow({
      where: { id: solo.id },
    });
    expect(after.email).toBe(`${local}@example.com`);
    expect(after.phone).toBe("+447700900125");
  });

  it("inherits the duplicate's email, password hash and dob onto the survivor", async () => {
    if (!(await dbReachable())) return;
    // Also the regression test for the transaction ordering: with
    // `Customer.email @unique` applied (Task 5), writing the duplicate's
    // address onto the survivor before the duplicate is deleted raises P2002.
    const local = uid("pw");
    const older = track(
      await db().customer.create({
        data: {
          name: "PW Older",
          phone: "07700 900131",
          createdAt: new Date("2026-01-01T00:00:00Z"),
        },
      }),
    );
    const newer = track(
      await db().customer.create({
        data: {
          name: "PW Newer",
          email: `${local}@example.com`,
          phone: "+447700900131",
          passwordHash: "argon2-fixture",
          dob: new Date("1991-03-02T00:00:00Z"),
          createdAt: new Date("2026-02-01T00:00:00Z"),
        },
      }),
    );

    const run = await mergeDuplicateCustomers({
      log: () => {},
      onlyIds: [older.id, newer.id],
    });
    expect(run.failed).toBe(0);
    expect(run.merged).toBe(1);

    expect(
      await db().customer.findUnique({ where: { id: newer.id } }),
    ).toBeNull();
    const survivor = await db().customer.findUniqueOrThrow({
      where: { id: older.id },
    });
    expect(survivor.passwordHash).toBe("argon2-fixture");
    expect(survivor.dob?.toISOString()).toBe("1991-03-02T00:00:00.000Z");
    expect(survivor.email).toBe(`${local}@example.com`);
    expect(survivor.phone).toBe("+447700900131");
  });

  it("parks unusable contact details in the notes instead of dropping them", async () => {
    if (!(await dbReachable())) return;
    const junk = `no email — ring ${uid("junk")}`;
    const bad = track(
      await db().customer.create({
        data: { name: "Junk Contact", email: junk, phone: "n/a" },
      }),
    );

    const first = await mergeDuplicateCustomers({
      log: () => {},
      onlyIds: [bad.id],
    });
    expect(first.renormalised).toBe(1);
    const after = await db().customer.findUniqueOrThrow({
      where: { id: bad.id },
    });
    expect(after.email).toBeNull();
    expect(after.phone).toBeNull();
    expect(after.notes).toContain(junk);
    expect(after.notes).toContain("[unmatched phone] n/a");

    // …and it stays put: the second pass has nothing to re-normalise here.
    const second = await mergeDuplicateCustomers({
      log: () => {},
      onlyIds: [bad.id],
    });
    expect(second.renormalised).toBe(0);
    const again = await db().customer.findUniqueOrThrow({
      where: { id: bad.id },
    });
    expect(again.notes).toBe(after.notes);
  });

  it("never merges two people who share a placeholder phone", async () => {
    if (!(await dbReachable())) return;
    const one = track(
      await db().customer.create({
        data: { name: "Placeholder One", phone: "n/a" },
      }),
    );
    const two = track(
      await db().customer.create({
        data: { name: "Placeholder Two", phone: "N/A" },
      }),
    );
    const run = await mergeDuplicateCustomers({
      log: () => {},
      onlyIds: [one.id, two.id],
    });
    expect(run.groups).toBe(0);
    expect(run.merged).toBe(0);
    expect(
      await db().customer.findUnique({ where: { id: one.id } }),
    ).not.toBeNull();
    expect(
      await db().customer.findUnique({ where: { id: two.id } }),
    ).not.toBeNull();
  });

  it("leaves rows outside the scope completely untouched", async () => {
    if (!(await dbReachable())) return;
    const outside = track(
      await db().customer.create({
        data: { name: "Out Of Scope", email: `${uid("outside")}@EXAMPLE.com` },
      }),
    );
    const inside = track(
      await db().customer.create({
        data: { name: "In Scope", email: `${uid("inside")}@EXAMPLE.com` },
      }),
    );
    const run = await mergeDuplicateCustomers({
      log: () => {},
      onlyIds: [inside.id],
    });
    expect(run.scanned).toBe(1);
    const untouched = await db().customer.findUniqueOrThrow({
      where: { id: outside.id },
    });
    expect(untouched.email).toBe(outside.email); // still mixed-case
    expect(untouched.updatedAt.getTime()).toBe(outside.updatedAt.getTime());
  });

  it("isolates a failing group: the others still merge and the run reports it", async () => {
    if (!(await dbReachable())) return;
    const goodLocal = uid("iso-good");
    const badLocal = uid("iso-bad");
    const goodKeep = track(
      await db().customer.create({
        data: {
          name: "Iso Good Older",
          email: `${goodLocal}@example.com`,
          createdAt: new Date("2026-01-01T00:00:00Z"),
        },
      }),
    );
    const goodDupe = track(
      await db().customer.create({
        data: {
          name: "Iso Good Newer",
          email: `${goodLocal.toUpperCase()}@EXAMPLE.com`,
          createdAt: new Date("2026-02-01T00:00:00Z"),
        },
      }),
    );
    const badKeep = track(
      await db().customer.create({
        data: {
          name: "Iso Bad Older",
          email: `${badLocal}@example.com`,
          createdAt: new Date("2026-01-01T00:00:00Z"),
        },
      }),
    );
    const badDupe = track(
      await db().customer.create({
        data: {
          name: "Iso Bad Newer",
          email: `${badLocal.toUpperCase()}@EXAMPLE.com`,
          createdAt: new Date("2026-02-01T00:00:00Z"),
        },
      }),
    );
    const solo = track(
      await db().customer.create({
        data: { name: "Iso Solo", email: `${uid("iso-solo")}@EXAMPLE.com` },
      }),
    );

    const lines: string[] = [];
    const run = await mergeDuplicateCustomers({
      log: (l) => lines.push(l),
      onlyIds: [goodKeep.id, goodDupe.id, badKeep.id, badDupe.id, solo.id],
      applyGroup: (plan) =>
        plan.keep.id === badKeep.id
          ? Promise.reject(new Error("simulated transaction failure"))
          : applyMergeGroup(plan),
    });

    expect(run.groups).toBe(2);
    expect(run.merged).toBe(1);
    expect(run.failed).toBe(1);
    expect(
      lines.some((l) => l.includes("FAILED") && l.includes(badKeep.id)),
    ).toBe(true);
    // The healthy group merged…
    expect(
      await db().customer.findUnique({ where: { id: goodDupe.id } }),
    ).toBeNull();
    // …the failed one is exactly as it was, ready for a re-run…
    const stillThere = await db().customer.findUniqueOrThrow({
      where: { id: badDupe.id },
    });
    expect(stillThere.email).toBe(`${badLocal.toUpperCase()}@EXAMPLE.com`);
    // …and the re-normalise pass still ran over the untouched rows.
    expect(run.renormalised).toBeGreaterThanOrEqual(1);
    const soloAfter = await db().customer.findUniqueOrThrow({
      where: { id: solo.id },
    });
    expect(soloAfter.email).toBe(solo.email?.toLowerCase());
  });
});
