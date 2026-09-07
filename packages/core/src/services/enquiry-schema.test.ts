import { afterAll, describe, expect, it } from "vitest";
import { closeTestDb, dbReachable, testDb, uid } from "./testdb";

const db = () => testDb();

/**
 * Contract test for the Phase-1 thread schema: the new enum values, the
 * auto-generated per-enquiry reply token, and the four new tables with their
 * cascade + uniqueness behaviour. Guards the migration, not business logic.
 */
describe("enquiry thread schema (DB)", () => {
  const customers: string[] = [];
  const enquiries: string[] = [];

  afterAll(async () => {
    if (await dbReachable()) {
      if (enquiries.length)
        await db().enquiry.deleteMany({ where: { id: { in: enquiries } } });
      if (customers.length)
        await db().customer.deleteMany({ where: { id: { in: customers } } });
    }
    await closeTestDb();
  });

  it("auto-generates a unique threadToken and accepts customer_replied", async () => {
    if (!(await dbReachable())) return;
    const a = await db().enquiry.create({
      data: { contactName: `Tok ${uid()}`, channel: "email" },
    });
    const b = await db().enquiry.create({
      data: { contactName: `Tok ${uid()}`, channel: "web" },
    });
    enquiries.push(a.id, b.id);
    expect(a.threadToken).toBeTruthy();
    expect(a.threadToken).not.toBe(b.threadToken);
    expect(a.channel).toBe("email");
    expect(a.lastMessageAt).toBeNull();
    expect(a.lastInboundAt).toBeNull();

    const updated = await db().enquiry.update({
      where: { id: a.id },
      data: { status: "customer_replied" },
    });
    expect(updated.status).toBe("customer_replied");
  });

  it("stores messages with attachments and cascades on enquiry delete", async () => {
    if (!(await dbReachable())) return;
    const enquiry = await db().enquiry.create({
      data: { contactName: `Msg ${uid()}` },
    });
    const message = await db().enquiryMessage.create({
      data: {
        enquiryId: enquiry.id,
        direction: "inbound",
        channel: "web",
        bodyText: "Hello there",
        fromName: "Amy",
        attachments: {
          create: [
            { mime: "image/png", size: 3, bytes: new Uint8Array([1, 2, 3]) },
            { mime: "application/pdf", size: 0, url: "https://x.test/a.pdf" },
          ],
        },
      },
      include: { attachments: true },
    });
    expect(message.deliveryStatus).toBe("logged");
    expect(message.attachments).toHaveLength(2);

    await db().enquiry.delete({ where: { id: enquiry.id } });
    expect(
      await db().enquiryMessage.findUnique({ where: { id: message.id } }),
    ).toBeNull();
    expect(
      await db().attachment.count({ where: { messageId: message.id } }),
    ).toBe(0);
  });

  it("rejects a duplicate externalId on EnquiryMessage", async () => {
    if (!(await dbReachable())) return;
    const enquiry = await db().enquiry.create({
      data: { contactName: `Ext ${uid()}` },
    });
    enquiries.push(enquiry.id);
    const externalId = uid("ext");
    await db().enquiryMessage.create({
      data: {
        enquiryId: enquiry.id,
        direction: "inbound",
        channel: "email",
        bodyText: "one",
        externalId,
      },
    });
    await expect(
      db().enquiryMessage.create({
        data: {
          enquiryId: enquiry.id,
          direction: "inbound",
          channel: "email",
          bodyText: "two",
          externalId,
        },
      }),
    ).rejects.toThrow();
  });

  it("keys EnquiryRead by (enquiryId, userId) and CustomerIdentity by (channel, externalId)", async () => {
    if (!(await dbReachable())) return;
    const user = await db().user.findFirstOrThrow();
    const enquiry = await db().enquiry.create({
      data: { contactName: `Read ${uid()}` },
    });
    enquiries.push(enquiry.id);

    const first = new Date("2026-09-01T10:00:00.000Z");
    const later = new Date("2026-09-02T10:00:00.000Z");
    await db().enquiryRead.upsert({
      where: { enquiryId_userId: { enquiryId: enquiry.id, userId: user.id } },
      create: { enquiryId: enquiry.id, userId: user.id, readAt: first },
      update: { readAt: first },
    });
    const bumped = await db().enquiryRead.upsert({
      where: { enquiryId_userId: { enquiryId: enquiry.id, userId: user.id } },
      create: { enquiryId: enquiry.id, userId: user.id, readAt: later },
      update: { readAt: later },
    });
    expect(bumped.readAt.toISOString()).toBe(later.toISOString());
    expect(
      await db().enquiryRead.count({ where: { enquiryId: enquiry.id } }),
    ).toBe(1);

    const customer = await db().customer.create({
      data: { name: `Ident ${uid()}` },
    });
    customers.push(customer.id);
    const psid = uid("psid");
    await db().customerIdentity.create({
      data: {
        customerId: customer.id,
        channel: "messenger",
        externalId: psid,
        displayName: "Amy J",
      },
    });
    await expect(
      db().customerIdentity.create({
        data: { customerId: customer.id, channel: "messenger", externalId: psid },
      }),
    ).rejects.toThrow();
    // Same external id on a different channel is a different person.
    await db().customerIdentity.create({
      data: { customerId: customer.id, channel: "instagram", externalId: psid },
    });
    expect(
      await db().customerIdentity.count({ where: { customerId: customer.id } }),
    ).toBe(2);
  });
});
