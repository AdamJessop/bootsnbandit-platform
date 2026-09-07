import { afterAll, describe, expect, it } from "vitest";
import {
  activityAt,
  chooseThread,
  isThreadable,
  resolveThread,
  sourceForChannel,
  type ThreadCandidate,
} from "./enquiry-threading";
import { closeTestDb, dbReachable, testDb, uid } from "./testdb";

const NOW = new Date("2026-09-07T12:00:00.000Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 3600_000);

function cand(over: Partial<ThreadCandidate> & { id: string }): ThreadCandidate {
  return {
    status: "replied",
    lastMessageAt: daysAgo(1),
    createdAt: daysAgo(10),
    ...over,
  };
}

describe("threading primitives", () => {
  it("treats new / replied / customer_replied as threadable, never closed or converted", () => {
    expect(isThreadable("new")).toBe(true);
    expect(isThreadable("replied")).toBe(true);
    expect(isThreadable("customer_replied")).toBe(true);
    expect(isThreadable("converted")).toBe(false);
    expect(isThreadable("closed")).toBe(false);
  });

  it("falls back to createdAt when there is no lastMessageAt", () => {
    expect(activityAt(cand({ id: "a", lastMessageAt: null })).toISOString()).toBe(
      daysAgo(10).toISOString(),
    );
    expect(activityAt(cand({ id: "a" })).toISOString()).toBe(
      daysAgo(1).toISOString(),
    );
  });

  it("maps a channel to the legacy source column", () => {
    expect(sourceForChannel("flash")).toBe("flash");
    expect(sourceForChannel("inkling")).toBe("inkling");
    expect(sourceForChannel("web")).toBe("web");
    expect(sourceForChannel("email")).toBe("web");
    expect(sourceForChannel("messenger")).toBe("web");
  });
});

describe("chooseThread", () => {
  it("uses the token match first, ignoring the 30-day window", () => {
    const res = chooseThread({
      tokenMatch: cand({ id: "tok", lastMessageAt: daysAgo(200) }),
      candidates: [cand({ id: "recent", lastMessageAt: daysAgo(1) })],
      now: NOW,
    });
    expect(res).toEqual({ kind: "existing", enquiryId: "tok" });
  });

  it("ignores a token match on a closed or converted enquiry", () => {
    for (const status of ["closed", "converted"] as const) {
      expect(
        chooseThread({
          tokenMatch: cand({ id: "tok", status }),
          candidates: [],
          now: NOW,
        }),
      ).toEqual({ kind: "new" });
    }
  });

  it("falls back to the most recently active threadable enquiry inside 30 days", () => {
    const res = chooseThread({
      candidates: [
        cand({ id: "old", lastMessageAt: daysAgo(20) }),
        cand({ id: "newest", lastMessageAt: daysAgo(2), status: "new" }),
        cand({ id: "mid", lastMessageAt: daysAgo(5), status: "customer_replied" }),
      ],
      now: NOW,
    });
    expect(res).toEqual({ kind: "existing", enquiryId: "newest" });
  });

  it("skips closed / converted candidates entirely", () => {
    expect(
      chooseThread({
        candidates: [
          cand({ id: "closed", status: "closed", lastMessageAt: daysAgo(1) }),
          cand({ id: "converted", status: "converted", lastMessageAt: daysAgo(1) }),
        ],
        now: NOW,
      }),
    ).toEqual({ kind: "new" });
  });

  it("starts a new enquiry past the 30-day window (boundary inclusive)", () => {
    expect(
      chooseThread({
        candidates: [cand({ id: "stale", lastMessageAt: daysAgo(31) })],
        now: NOW,
      }),
    ).toEqual({ kind: "new" });
    expect(
      chooseThread({
        candidates: [cand({ id: "edge", lastMessageAt: daysAgo(30) })],
        now: NOW,
      }),
    ).toEqual({ kind: "existing", enquiryId: "edge" });
  });

  it("starts a new enquiry when there is nothing to attach to", () => {
    expect(chooseThread({ candidates: [], now: NOW })).toEqual({ kind: "new" });
  });
});

describe("resolveThread (DB)", () => {
  const db = () => testDb();
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

  async function customer() {
    const c = await db().customer.create({ data: { name: `Thread ${uid()}` } });
    customers.push(c.id);
    return c;
  }

  it("attaches to the customer's recent open enquiry", async () => {
    if (!(await dbReachable())) return;
    const c = await customer();
    const open = await db().enquiry.create({
      data: {
        contactName: "Amy",
        customerId: c.id,
        status: "replied",
        lastMessageAt: daysAgo(3),
      },
    });
    enquiries.push(open.id);
    const res = await resolveThread({
      customerId: c.id,
      channel: "email",
      contactName: "Amy",
      now: NOW,
    });
    expect(res).toEqual({ enquiryId: open.id, created: false });
  });

  it("follows the reply token even when the thread is old", async () => {
    if (!(await dbReachable())) return;
    const c = await customer();
    const old = await db().enquiry.create({
      data: {
        contactName: "Amy",
        customerId: c.id,
        status: "replied",
        lastMessageAt: daysAgo(120),
      },
    });
    enquiries.push(old.id);
    const res = await resolveThread({
      customerId: c.id,
      channel: "email",
      threadToken: old.threadToken,
      contactName: "Amy",
      now: NOW,
    });
    expect(res).toEqual({ enquiryId: old.id, created: false });
  });

  it("creates a new enquiry beside a closed one, never reopening it", async () => {
    if (!(await dbReachable())) return;
    const c = await customer();
    const closed = await db().enquiry.create({
      data: {
        contactName: "Amy",
        customerId: c.id,
        status: "closed",
        lastMessageAt: daysAgo(1),
      },
    });
    enquiries.push(closed.id);
    const res = await resolveThread({
      customerId: c.id,
      channel: "messenger",
      threadToken: closed.threadToken,
      contactName: "Amy Jones",
      subject: "One more thing",
      now: NOW,
    });
    expect(res.created).toBe(true);
    expect(res.enquiryId).not.toBe(closed.id);
    enquiries.push(res.enquiryId);
    const made = await db().enquiry.findUniqueOrThrow({
      where: { id: res.enquiryId },
    });
    expect(made.channel).toBe("messenger");
    expect(made.source).toBe("web");
    expect(made.status).toBe("new");
    expect(made.contactName).toBe("Amy Jones");
    expect(made.subject).toBe("One more thing");
    expect(made.customerId).toBe(c.id);
    expect(
      (await db().enquiry.findUniqueOrThrow({ where: { id: closed.id } })).status,
    ).toBe("closed");
  });

  it("never crosses customers", async () => {
    if (!(await dbReachable())) return;
    const mine = await customer();
    const theirs = await customer();
    const other = await db().enquiry.create({
      data: {
        contactName: "Other",
        customerId: theirs.id,
        status: "new",
        lastMessageAt: daysAgo(1),
      },
    });
    enquiries.push(other.id);
    const res = await resolveThread({
      customerId: mine.id,
      channel: "web",
      contactName: "Mine",
      now: NOW,
    });
    expect(res.created).toBe(true);
    enquiries.push(res.enquiryId);
  });
});
