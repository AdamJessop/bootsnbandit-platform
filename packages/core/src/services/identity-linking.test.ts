import { afterAll, describe, expect, it } from "vitest";
import type { Prisma } from "@prisma/client";
import {
  applyIdentityMove,
  linkIdentityToCustomer,
  listLinkableIdentities,
  StubChangedError,
} from "./identity-linking";
import { closeTestDb, dbReachable, testDb, uid } from "./testdb";

const db = () => testDb();

describe("identity linking (DB)", () => {
  const customers: string[] = [];
  const enquiries: string[] = [];
  const artists: string[] = [];
  const users: string[] = [];

  afterAll(async () => {
    if (await dbReachable()) {
      // Enquiry.customerId is SetNull, so deleting customers would leave the
      // enquiries (and, cascading from them, their messages) behind. Delete
      // enquiries first; bookings DO cascade from the customer.
      if (enquiries.length)
        await db().enquiry.deleteMany({ where: { id: { in: enquiries } } });
      if (customers.length)
        await db().customer.deleteMany({ where: { id: { in: customers } } });
      if (artists.length)
        await db().artist.deleteMany({ where: { id: { in: artists } } });
      if (users.length)
        await db().user.deleteMany({ where: { id: { in: users } } });
    }
    await closeTestDb();
  });

  /** A real record: has an email, so it is never a merge victim. */
  async function realCustomer(tag: string) {
    const c = await db().customer.create({
      data: { name: `Amy ${tag}`, email: `amy-${tag}@example.test` },
    });
    customers.push(c.id);
    return c;
  }

  /** The record a first DM creates: a name, a handle, and nothing else. */
  async function stubWithIdentity(tag: string, over: object = {}) {
    const c = await db().customer.create({
      data: { name: `amy.ink ${tag}`, ...over },
    });
    customers.push(c.id);
    const identity = await db().customerIdentity.create({
      data: {
        customerId: c.id,
        channel: "instagram",
        externalId: `1784140${tag}`,
        displayName: "amy.ink",
      },
    });
    const enquiry = await db().enquiry.create({
      data: {
        contactName: c.name,
        customerId: c.id,
        channel: "instagram",
        status: "new",
      },
    });
    enquiries.push(enquiry.id);
    const message = await db().enquiryMessage.create({
      data: {
        enquiryId: enquiry.id,
        customerId: c.id,
        direction: "inbound",
        channel: "instagram",
        bodyText: "Hey, do you do fine line?",
      },
    });
    return { customer: c, identity, enquiry, message };
  }

  it("lists handles that sit on stub customers", async () => {
    if (!(await dbReachable())) return;
    const tag = uid("s1");
    const stub = await stubWithIdentity(tag);
    const real = await realCustomer(tag);
    await db().customerIdentity.create({
      data: {
        customerId: real.id,
        channel: "messenger",
        externalId: `7213456${tag}`,
        displayName: "Amy Rowe",
      },
    });

    const ids = (await listLinkableIdentities()).map((i) => i.id);
    expect(ids).toContain(stub.identity.id);
    // The one already on a real record is not on offer: linking it elsewhere
    // would be stealing a handle, not repairing a duplicate.
    const onReal = await db().customerIdentity.findFirst({
      where: { customerId: real.id },
    });
    expect(ids).not.toContain(onReal!.id);
  });

  it("does not offer a customer the handles they already own", async () => {
    if (!(await dbReachable())) return;
    const tag = uid("s8");
    const stub = await stubWithIdentity(tag);

    // Offering someone their own handle is an invitation to a no-op.
    const mine = await listLinkableIdentities({
      excludeCustomerId: stub.customer.id,
    });
    expect(mine.map((i) => i.id)).not.toContain(stub.identity.id);
    // …but it is still linkable from anyone else's page.
    const all = await listLinkableIdentities();
    expect(all.map((i) => i.id)).toContain(stub.identity.id);
  });

  it("moves the handle, its enquiries and its messages, then deletes the stub", async () => {
    if (!(await dbReachable())) return;
    const tag = uid("s2");
    const {
      customer: stub,
      identity,
      enquiry,
      message,
    } = await stubWithIdentity(tag);
    const real = await realCustomer(tag);

    const res = await linkIdentityToCustomer({
      identityId: identity.id,
      customerId: real.id,
    });

    expect(res).toEqual({
      ok: true,
      merged: true,
      movedEnquiries: 1,
      movedMessages: 1,
    });
    expect(
      (
        await db().customerIdentity.findUniqueOrThrow({
          where: { id: identity.id },
        })
      ).customerId,
    ).toBe(real.id);
    expect(
      (await db().enquiry.findUniqueOrThrow({ where: { id: enquiry.id } }))
        .customerId,
    ).toBe(real.id);
    expect(
      (
        await db().enquiryMessage.findUniqueOrThrow({
          where: { id: message.id },
        })
      ).customerId,
    ).toBe(real.id);
    expect(await db().customer.findUnique({ where: { id: stub.id } })).toBeNull();
  });

  it("is a no-op when the handle is already on this customer", async () => {
    if (!(await dbReachable())) return;
    const tag = uid("s3");
    const { customer, identity } = await stubWithIdentity(tag);
    expect(
      await linkIdentityToCustomer({
        identityId: identity.id,
        customerId: customer.id,
      }),
    ).toEqual({ ok: true, merged: false, movedEnquiries: 0, movedMessages: 0 });
  });

  it("survives two owners linking the same handle at once", async () => {
    if (!(await dbReachable())) return;
    const tag = uid("s6");
    const { customer: stub, identity } = await stubWithIdentity(tag);
    const real = await realCustomer(tag);

    // Whoever loses the race read the stub before the winner deleted it, so
    // their transaction finds nothing to delete. That has to come back as an
    // answer, not a raw P2025 out of Prisma.
    const results = await Promise.all([
      linkIdentityToCustomer({ identityId: identity.id, customerId: real.id }),
      linkIdentityToCustomer({ identityId: identity.id, customerId: real.id }),
    ]);

    expect(results.every((r) => r.ok)).toBe(true);
    // Exactly one of them did the move; the other is a no-op.
    expect(results.filter((r) => r.ok && r.merged)).toHaveLength(1);
    expect(
      (
        await db().customerIdentity.findUniqueOrThrow({
          where: { id: identity.id },
        })
      ).customerId,
    ).toBe(real.id);
    expect(await db().customer.findUnique({ where: { id: stub.id } })).toBeNull();
  });

  it("refuses a handle whose owner has contact details or bookings", async () => {
    if (!(await dbReachable())) return;
    const tag = uid("s4");
    const target = await realCustomer(`${tag}-target`);

    // (a) an email makes the owner a real record
    const withEmail = await stubWithIdentity(`${tag}a`, {
      email: `other-${tag}@example.test`,
    });
    expect(
      await linkIdentityToCustomer({
        identityId: withEmail.identity.id,
        customerId: target.id,
      }),
    ).toMatchObject({ ok: false, reason: "in_use" });

    // (b) so does a phone number
    const withPhone = await stubWithIdentity(`${tag}b`, {
      phone: `+4477009${tag.slice(-5)}`,
    });
    expect(
      await linkIdentityToCustomer({
        identityId: withPhone.identity.id,
        customerId: target.id,
      }),
    ).toMatchObject({ ok: false, reason: "in_use" });

    // (c) and so does a booking, even with no contact details at all
    const artist = await db().artist.create({
      data: {
        slug: `link-${tag}`,
        name: `Link ${tag}`,
        user: {
          create: {
            email: `link-${tag}@example.test`,
            displayName: `Link ${tag}`,
          },
        },
      },
    });
    artists.push(artist.id);
    users.push(artist.userId);
    const withBooking = await stubWithIdentity(`${tag}c`);
    await db().booking.create({
      data: {
        customerId: withBooking.customer.id,
        artistId: artist.id,
        type: "consult",
        start: new Date("2099-01-01T10:00:00.000Z"),
        end: new Date("2099-01-01T11:00:00.000Z"),
        durationMin: 60,
      },
    });
    expect(
      await linkIdentityToCustomer({
        identityId: withBooking.identity.id,
        customerId: target.id,
      }),
    ).toMatchObject({ ok: false, reason: "in_use" });
    // A refusal must leave the record exactly as it was — the booking above
    // cascades to its session and consent form, so a stub that is wrongly
    // absorbed does not merely lose a row.
    expect(
      (
        await db().customerIdentity.findUniqueOrThrow({
          where: { id: withBooking.identity.id },
        })
      ).customerId,
    ).toBe(withBooking.customer.id);
    expect(
      (
        await db().enquiry.findUniqueOrThrow({
          where: { id: withBooking.enquiry.id },
        })
      ).customerId,
    ).toBe(withBooking.customer.id);
    expect(
      await db().booking.count({
        where: { customerId: withBooking.customer.id },
      }),
    ).toBe(1);
  });

  it("carries the stub's consent, tags and loyalty across, and records the merge", async () => {
    if (!(await dbReachable())) return;
    const tag = uid("s7");
    const { customer: stub, identity } = await stubWithIdentity(tag, {
      notes: "Allergic to red ink",
      marketingConsent: true,
      tags: ["dm"],
      loyaltyStamps: 2,
    });
    const real = await db().customer.create({
      data: {
        name: `Amy ${tag}`,
        email: `amy-${tag}@example.test`,
        notes: "Prefers mornings",
        tags: ["regular"],
        loyaltyStamps: 3,
      },
    });
    customers.push(real.id);

    expect(
      await linkIdentityToCustomer({
        identityId: identity.id,
        customerId: real.id,
      }),
    ).toMatchObject({ ok: true, merged: true });

    // The same rules customer-merge applies: consent OR-ed, tags unioned,
    // stamps summed. Anything else would make two spellings of one merge.
    const after = await db().customer.findUniqueOrThrow({
      where: { id: real.id },
    });
    expect(after.marketingConsent).toBe(true);
    expect([...after.tags].sort()).toEqual(["dm", "regular"]);
    expect(after.loyaltyStamps).toBe(5);
    expect(after.notes).toContain("Prefers mornings");
    expect(after.notes).toContain("Allergic to red ink");
    // The stub is gone; the note is the only trace of what was absorbed.
    expect(after.notes).toContain(`[merged ${stub.name} (${stub.id}) on `);
  });

  it("reports a missing handle or customer rather than throwing", async () => {
    if (!(await dbReachable())) return;
    const tag = uid("s5");
    const real = await realCustomer(tag);
    expect(
      await linkIdentityToCustomer({
        identityId: "no-such-identity",
        customerId: real.id,
      }),
    ).toMatchObject({ ok: false, reason: "identity_missing" });
    const { identity } = await stubWithIdentity(tag);
    expect(
      await linkIdentityToCustomer({
        identityId: identity.id,
        customerId: "no-such-customer",
      }),
    ).toMatchObject({ ok: false, reason: "customer_missing" });
  });
});

/**
 * The transaction body on its own. A booking taken DURING the merge cannot be
 * raced deterministically against a real database, so the guard that protects
 * against it is asserted here instead: the body is handed a stand-in client
 * that records what it was asked to do.
 */
describe("applyIdentityMove (transaction body)", () => {
  /** The predicate that has to appear on both the re-read and the delete. */
  const STUB_WHERE = {
    email: null,
    phone: null,
    passwordHash: null,
    bookings: { none: {} },
  };

  function fakeTx(
    over: {
      stub?: object | null;
      target?: object | null;
      deleted?: number;
      /** Filled with every call in the order it was made, when supplied. */
      order?: string[];
    } = {},
  ) {
    const calls: Record<string, unknown[]> = {};
    const record = (key: string, result: unknown) => (args: unknown) => {
      (calls[key] ??= []).push(args);
      over.order?.push(key);
      return Promise.resolve(result);
    };
    const row = (extra: object) => ({
      id: "x",
      createdAt: new Date(),
      name: "amy.ink",
      email: null,
      phone: null,
      notes: null,
      tags: [],
      marketingConsent: false,
      loyaltyStamps: 0,
      loyaltyTier: 0,
      passwordHash: null,
      dob: null,
      ...extra,
    });
    const tx = {
      customer: {
        findFirst: record(
          "customer.findFirst",
          over.stub === undefined ? row({ id: "stub1" }) : over.stub,
        ),
        findUnique: record(
          "customer.findUnique",
          over.target === undefined
            ? row({ id: "target1", name: "Amy" })
            : over.target,
        ),
        update: record("customer.update", {}),
        deleteMany: record("customer.deleteMany", { count: over.deleted ?? 1 }),
      },
      enquiry: { updateMany: record("enquiry.updateMany", { count: 3 }) },
      enquiryMessage: {
        updateMany: record("enquiryMessage.updateMany", { count: 9 }),
      },
      messageLog: { updateMany: record("messageLog.updateMany", { count: 0 }) },
      review: { updateMany: record("review.updateMany", { count: 0 }) },
      customerPasswordToken: {
        updateMany: record("customerPasswordToken.updateMany", { count: 0 }),
      },
      customerIdentity: {
        updateMany: record("customerIdentity.updateMany", { count: 1 }),
      },
    };
    return { tx: tx as unknown as Prisma.TransactionClient, calls };
  }

  it("re-reads the owner and deletes it through the stub predicate", async () => {
    const { tx, calls } = fakeTx();

    expect(
      await applyIdentityMove(tx, {
        stubOwnerId: "stub1",
        targetId: "target1",
      }),
    ).toEqual({ kind: "moved", movedEnquiries: 3, movedMessages: 9 });

    // Both the check and the delete carry the predicate. Only the second one
    // matters for safety: Booking cascades from Customer (and Session and the
    // consent form cascade from Booking), so a delete by bare id would take a
    // real appointment with it if a booking landed mid-merge.
    expect(calls["customer.findFirst"][0]).toEqual({
      where: { id: "stub1", ...STUB_WHERE },
      select: expect.anything(),
    });
    expect(calls["customer.deleteMany"][0]).toEqual({
      where: { id: "stub1", ...STUB_WHERE },
    });
  });

  it("never parks an [unmatched contact] note for contacts it does not rewrite", async () => {
    // The target's phone is a placeholder the merge planner cannot normalise.
    // In a full customer merge that value would be moving OUT of the column
    // and into the notes; here the column is not written at all, so the same
    // line would be a lie printed on the customer record forever.
    const { tx, calls } = fakeTx({
      target: {
        id: "target1",
        createdAt: new Date(),
        name: "Amy",
        email: "amy@example.test",
        phone: "n/a",
        notes: "Allergic to red ink",
        tags: [],
        marketingConsent: false,
        loyaltyStamps: 0,
        loyaltyTier: 0,
        passwordHash: null,
        dob: null,
      },
    });

    await applyIdentityMove(tx, { stubOwnerId: "stub1", targetId: "target1" });

    const update = calls["customer.update"][0] as {
      data: { notes: string | null };
    };
    expect(update.data.notes).not.toContain("[unmatched contact]");
    // The audit line still has to be there — it is the only trace the deleted
    // stub ever existed.
    expect(update.data.notes).toContain("[merged ");
    expect(update.data.notes).toContain("Allergic to red ink");
  });

  it("reads the target immediately before rewriting its notes", async () => {
    // Read up front, the copy could be minutes old by the time it is written
    // back — silently undoing a `saveCustomerNotes` that landed in between.
    const order: string[] = [];
    const { tx, calls } = fakeTx({ order });
    await applyIdentityMove(tx, { stubOwnerId: "stub1", targetId: "target1" });
    expect(calls["customer.findUnique"]).toHaveLength(2);
    // …the existence check, then the moves, then the read the notes come from.
    expect(order.slice(-3)).toEqual([
      "customer.findUnique",
      "customer.update",
      "customer.deleteMany",
    ]);
  });

  it("aborts when the guarded delete matches nothing", async () => {
    const { tx } = fakeTx({ deleted: 0 });
    // Throwing is the point: it rolls back every move above it.
    await expect(
      applyIdentityMove(tx, { stubOwnerId: "stub1", targetId: "target1" }),
    ).rejects.toThrow(StubChangedError);
  });

  it("reports a missing target before writing anything", async () => {
    const { tx, calls } = fakeTx({ target: null });
    expect(
      await applyIdentityMove(tx, { stubOwnerId: "stub1", targetId: "gone" }),
    ).toEqual({ kind: "target_missing" });
    expect(calls["enquiry.updateMany"]).toBeUndefined();
    expect(calls["customer.update"]).toBeUndefined();
    expect(calls["customer.deleteMany"]).toBeUndefined();
  });

  it("reports a non-stub owner before writing anything", async () => {
    const { tx, calls } = fakeTx({ stub: null });
    expect(
      await applyIdentityMove(tx, { stubOwnerId: "real1", targetId: "target1" }),
    ).toEqual({ kind: "not_a_stub" });
    expect(calls["customer.findUnique"]).toBeUndefined();
    expect(calls["enquiry.updateMany"]).toBeUndefined();
    expect(calls["customer.deleteMany"]).toBeUndefined();
  });
});
