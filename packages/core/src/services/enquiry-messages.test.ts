import { afterAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@bnb/core/db";
import {
  listThread,
  listThreadsFor,
  markRead,
  recordInbound,
  recordNote,
  recordOutbound,
  unreadCountsFor,
  visibleEnquiryWhere,
} from "./enquiry-messages";
import { closeTestDb, dbReachable, testDb, uid } from "./testdb";

const db = () => testDb();
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 9, 9]);

describe("visibleEnquiryWhere", () => {
  it("owners see everything", () => {
    expect(
      visibleEnquiryWhere({ userId: "u1", role: "OWNER", artistId: null }),
    ).toEqual({});
  });

  it("artists see their own plus every unassigned enquiry", () => {
    expect(
      visibleEnquiryWhere({ userId: "u2", role: "ARTIST", artistId: "art1" }),
    ).toEqual({
      OR: [{ preferredArtistId: "art1" }, { preferredArtistId: null }],
    });
  });

  it("an artist user with no artist record sees nothing", () => {
    expect(
      visibleEnquiryWhere({ userId: "u3", role: "ARTIST", artistId: null }),
    ).toEqual({ id: "__none__" });
  });
});

describe("enquiry messages (DB)", () => {
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

  async function seed(status: "new" | "replied" | "closed" = "new") {
    const customer = await db().customer.create({
      data: { name: `Msg ${uid()}` },
    });
    customers.push(customer.id);
    const enquiry = await db().enquiry.create({
      data: { contactName: customer.name, customerId: customer.id, status },
    });
    enquiries.push(enquiry.id);
    return { customer, enquiry };
  }

  it("records an inbound message, bumps both timestamps and keeps 'new' as new", async () => {
    if (!(await dbReachable())) return;
    const { customer, enquiry } = await seed("new");
    const at = new Date("2026-09-05T09:00:00.000Z");
    const msg = await recordInbound({
      enquiryId: enquiry.id,
      customerId: customer.id,
      channel: "email",
      bodyText: "Hello, is Tuesday free?",
      fromName: "Amy",
      fromAddress: "amy@example.com",
      subject: "Tuesday?",
      at,
    });
    expect(msg.direction).toBe("inbound");
    expect(msg.attachments).toEqual([]);
    const after = await db().enquiry.findUniqueOrThrow({ where: { id: enquiry.id } });
    expect(after.status).toBe("new");
    expect(after.lastInboundAt?.toISOString()).toBe(at.toISOString());
    expect(after.lastMessageAt?.toISOString()).toBe(at.toISOString());
  });

  it("promotes a replied enquiry to customer_replied, but never a closed one", async () => {
    if (!(await dbReachable())) return;
    const replied = await seed("replied");
    await recordInbound({
      enquiryId: replied.enquiry.id,
      channel: "email",
      bodyText: "Any update?",
    });
    expect(
      (await db().enquiry.findUniqueOrThrow({ where: { id: replied.enquiry.id } }))
        .status,
    ).toBe("customer_replied");

    const closed = await seed("closed");
    await recordInbound({
      enquiryId: closed.enquiry.id,
      channel: "email",
      bodyText: "Thanks!",
    });
    const after = await db().enquiry.findUniqueOrThrow({
      where: { id: closed.enquiry.id },
    });
    expect(after.status).toBe("closed");
    expect(after.lastInboundAt).not.toBeNull();
  });

  it("is idempotent on externalId", async () => {
    if (!(await dbReachable())) return;
    const { enquiry } = await seed();
    const externalId = uid("mid");
    const first = await recordInbound({
      enquiryId: enquiry.id,
      channel: "messenger",
      bodyText: "first",
      externalId,
    });
    const again = await recordInbound({
      enquiryId: enquiry.id,
      channel: "messenger",
      bodyText: "duplicate delivery",
      externalId,
    });
    expect(again.id).toBe(first.id);
    expect(again.bodyText).toBe("first");
    expect(
      await db().enquiryMessage.count({ where: { enquiryId: enquiry.id } }),
    ).toBe(1);
  });

  it("a duplicate externalId delivery re-applies no side effects", async () => {
    if (!(await dbReachable())) return;
    const { enquiry } = await seed("new");
    const externalId = uid("mid-dup");
    const first = await recordInbound({
      enquiryId: enquiry.id,
      channel: "email",
      bodyText: "first",
      externalId,
      at: new Date("2026-09-05T09:00:00.000Z"),
    });
    // Simulate a staff reply having happened after the first delivery landed.
    await db().enquiry.update({
      where: { id: enquiry.id },
      data: { status: "replied" },
    });
    const before = await db().enquiry.findUniqueOrThrow({
      where: { id: enquiry.id },
    });

    const again = await recordInbound({
      enquiryId: enquiry.id,
      channel: "email",
      bodyText: "duplicate delivery",
      externalId,
      at: new Date("2026-09-06T09:00:00.000Z"),
    });

    expect(again.id).toBe(first.id);
    const after = await db().enquiry.findUniqueOrThrow({
      where: { id: enquiry.id },
    });
    expect(after.status).toBe("replied");
    expect(after.lastInboundAt?.toISOString()).toBe(
      before.lastInboundAt?.toISOString(),
    );
    expect(
      await db().enquiryMessage.count({ where: { enquiryId: enquiry.id } }),
    ).toBe(1);
  });

  it("a concurrent duplicate insert loses the race but returns the winner's row", async () => {
    if (!(await dbReachable())) return;
    const { enquiry } = await seed();
    const externalId = uid("mid-race");
    const winner = await recordInbound({
      enquiryId: enquiry.id,
      channel: "messenger",
      bodyText: "winner",
      externalId,
    });

    // Force the fast-path idempotency check to miss the row that is really
    // already there, as it would if this call ran a moment before the
    // winner's insert committed — the code then proceeds to its own create
    // and collides for real on the unique index, exactly the P2002 the
    // recovery branch handles. The recovery branch's own re-read is left
    // real, so it has to actually find the winner for the test to pass.
    const spy = vi
      .spyOn(prisma.enquiryMessage, "findUnique")
      .mockResolvedValueOnce(null);
    try {
      const loser = await recordInbound({
        enquiryId: enquiry.id,
        channel: "messenger",
        bodyText: "loser",
        externalId,
      });
      expect(loser.id).toBe(winner.id);
    } finally {
      spy.mockRestore();
    }
    expect(
      await db().enquiryMessage.count({ where: { enquiryId: enquiry.id } }),
    ).toBe(1);
  });

  it("stores inbound attachments", async () => {
    if (!(await dbReachable())) return;
    const { enquiry } = await seed();
    const msg = await recordInbound({
      enquiryId: enquiry.id,
      channel: "email",
      bodyText: "reference attached",
      attachments: [
        { mime: "image/png", filename: "ref.png", bytes: PNG },
        { mime: "application/pdf", filename: "brief.pdf", url: "https://f.test/b.pdf" },
      ],
    });
    expect(msg.attachments).toHaveLength(2);
    expect(msg.attachments[0]).toMatchObject({ hasBytes: true, filename: "ref.png" });
    expect(msg.attachments[1]).toMatchObject({ hasBytes: false, url: "https://f.test/b.pdf" });
  });

  it("outbound bumps lastMessageAt only and leaves the status alone", async () => {
    if (!(await dbReachable())) return;
    const { enquiry } = await seed("new");
    const user = await db().user.findFirstOrThrow();
    const at = new Date("2026-09-06T09:00:00.000Z");
    const msg = await recordOutbound({
      enquiryId: enquiry.id,
      channel: "email",
      bodyText: "Tuesday works!",
      authorUserId: user.id,
      deliveryStatus: "sent",
      at,
    });
    expect(msg.direction).toBe("outbound");
    expect(msg.authorName).toBe(user.displayName);
    const after = await db().enquiry.findUniqueOrThrow({ where: { id: enquiry.id } });
    expect(after.status).toBe("new");
    expect(after.lastMessageAt?.toISOString()).toBe(at.toISOString());
    expect(after.lastInboundAt).toBeNull();
  });

  it("notes are internal: no timestamps, no status change, still on the thread", async () => {
    if (!(await dbReachable())) return;
    const { enquiry } = await seed("replied");
    const user = await db().user.findFirstOrThrow();
    const note = await recordNote({
      enquiryId: enquiry.id,
      authorUserId: user.id,
      bodyText: "Chased on Instagram too.",
    });
    expect(note.direction).toBe("internal");
    expect(note.channel).toBe("note");
    const after = await db().enquiry.findUniqueOrThrow({ where: { id: enquiry.id } });
    expect(after.status).toBe("replied");
    expect(after.lastMessageAt).toBeNull();
    const thread = await listThread(enquiry.id);
    expect(thread.map((m) => m.id)).toContain(note.id);
  });

  it("lists a thread oldest-first and batches by enquiry", async () => {
    if (!(await dbReachable())) return;
    const { enquiry } = await seed();
    const other = await seed();
    const first = await recordInbound({
      enquiryId: enquiry.id,
      channel: "web",
      bodyText: "one",
      at: new Date("2026-09-01T10:00:00.000Z"),
    });
    const second = await recordOutbound({
      enquiryId: enquiry.id,
      channel: "email",
      bodyText: "two",
      at: new Date("2026-09-02T10:00:00.000Z"),
    });
    await recordInbound({
      enquiryId: other.enquiry.id,
      channel: "web",
      bodyText: "elsewhere",
    });
    expect((await listThread(enquiry.id)).map((m) => m.id)).toEqual([
      first.id,
      second.id,
    ]);
    const map = await listThreadsFor([enquiry.id, other.enquiry.id, "missing"]);
    expect(map.get(enquiry.id)).toHaveLength(2);
    expect(map.get(other.enquiry.id)).toHaveLength(1);
    expect(map.get("missing")).toBeUndefined();
    expect(await listThreadsFor([])).toEqual(new Map());
  });

  it("trims the OLDEST history when the cap bites, never the newest replies", async () => {
    if (!(await dbReachable())) return;
    const { enquiry } = await seed();
    await recordInbound({
      enquiryId: enquiry.id,
      channel: "web",
      bodyText: "oldest",
      at: new Date("2026-09-01T10:00:00.000Z"),
    });
    const middle = await recordOutbound({
      enquiryId: enquiry.id,
      channel: "email",
      bodyText: "middle",
      at: new Date("2026-09-02T10:00:00.000Z"),
    });
    const newest = await recordInbound({
      enquiryId: enquiry.id,
      channel: "email",
      bodyText: "newest",
      at: new Date("2026-09-03T10:00:00.000Z"),
    });

    const map = await listThreadsFor([enquiry.id], 2);
    // Still oldest-first for rendering, but the dropped row is the oldest.
    expect(map.get(enquiry.id)?.map((m) => m.id)).toEqual([
      middle.id,
      newest.id,
    ]);
  });

  it("counts unread until read, then again after a newer inbound", async () => {
    if (!(await dbReachable())) return;
    const user = await db().user.findFirstOrThrow();
    const viewer = { userId: user.id, role: "OWNER" as const, artistId: null };
    const { enquiry } = await seed("replied");

    await recordInbound({
      enquiryId: enquiry.id,
      channel: "email",
      bodyText: "unread please",
      at: new Date("2026-09-03T10:00:00.000Z"),
    });
    const before = await unreadCountsFor(viewer);
    expect(before.enquiryIds).toContain(enquiry.id);
    expect(before.total).toBe(before.enquiryIds.length);

    await markRead(enquiry.id, user.id, new Date("2026-09-03T11:00:00.000Z"));
    expect((await unreadCountsFor(viewer)).enquiryIds).not.toContain(enquiry.id);

    await recordInbound({
      enquiryId: enquiry.id,
      channel: "email",
      bodyText: "and again",
      at: new Date("2026-09-04T10:00:00.000Z"),
    });
    expect((await unreadCountsFor(viewer)).enquiryIds).toContain(enquiry.id);
  });

  it("never counts an enquiry the viewer cannot see, or one with no inbound", async () => {
    if (!(await dbReachable())) return;
    const user = await db().user.findFirstOrThrow();
    const artist = await db().artist.findFirstOrThrow();
    const mine = await seed();
    await db().enquiry.update({
      where: { id: mine.enquiry.id },
      data: { preferredArtistId: artist.id },
    });
    await recordInbound({
      enquiryId: mine.enquiry.id,
      channel: "email",
      bodyText: "for the assigned artist",
    });

    const silent = await seed();
    const owner = await unreadCountsFor({
      userId: user.id,
      role: "OWNER",
      artistId: null,
    });
    expect(owner.enquiryIds).toContain(mine.enquiry.id);
    expect(owner.enquiryIds).not.toContain(silent.enquiry.id);

    const stranger = await unreadCountsFor({
      userId: user.id,
      role: "ARTIST",
      artistId: `${artist.id}-not`,
    });
    expect(stranger.enquiryIds).not.toContain(mine.enquiry.id);
  });

  it("persists the RFC Message-ID header of an inbound email", async () => {
    if (!(await dbReachable())) return;
    const { enquiry } = await seed();
    const messageIdHeader = `<${uid("mid")}@mail.example.com>`;
    const row = await recordInbound({
      enquiryId: enquiry.id,
      channel: "email",
      bodyText: "threaded",
      externalId: uid("ext"),
      messageIdHeader,
    });
    const stored = await db().enquiryMessage.findUniqueOrThrow({
      where: { id: row.id },
      select: { messageIdHeader: true },
    });
    expect(stored.messageIdHeader).toBe(messageIdHeader);
  });
});
