import { afterAll, describe, expect, it } from "vitest";
import {
  linkIdentityToCustomer,
  listLinkableIdentities,
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
