import { readFileSync } from "node:fs";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@bnb/core/db";
import { closeTestDb, dbReachable, testDb, uid } from "../testdb";
import { ingestResendEvent } from "./email-inbound";
import type {
  ResendAttachmentLink,
  ResendInboundDeps,
  ResendInboundEmail,
  ResendReceivedEvent,
} from "./email";

/**
 * The full inbound path against the real database: identity resolution,
 * threading by reply token, the message row, its attachments, the status
 * flip and idempotency on a replayed delivery.
 */

const db = () => testDb();

function fixture<T>(name: string): T {
  return JSON.parse(
    readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), "utf8"),
  ) as T;
}

const BASE_EVENT = fixture<ResendReceivedEvent>("resend-email-received.json");
const BASE_EMAIL = fixture<ResendInboundEmail>("resend-inbound-email.json");
const BASE_LINKS = fixture<{ data: ResendAttachmentLink[] }>(
  "resend-inbound-attachments.json",
);

const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4,
]);
const DOMAIN = "mail.bootsnbandit.test";
const ORIGINAL_DOMAIN = process.env.INBOUND_EMAIL_DOMAIN;

/** An event + matching fetched email, uniquely keyed so runs never collide. */
function scenario(overrides: {
  emailId?: string;
  from?: string;
  to?: string[];
  subject?: string;
  text?: string;
  headers?: Record<string, string> | null;
  attachments?: ResendInboundEmail["attachments"];
}) {
  const emailId = overrides.emailId ?? uid("email");
  const event: ResendReceivedEvent = {
    ...structuredClone(BASE_EVENT),
    data: { ...structuredClone(BASE_EVENT.data), email_id: emailId },
  };
  const email: ResendInboundEmail = {
    ...structuredClone(BASE_EMAIL),
    id: emailId,
    from: overrides.from ?? BASE_EMAIL.from,
    to: overrides.to ?? BASE_EMAIL.to,
    cc: null,
    subject: overrides.subject ?? BASE_EMAIL.subject,
    text: overrides.text ?? BASE_EMAIL.text,
    headers:
      overrides.headers === undefined ? BASE_EMAIL.headers : overrides.headers,
    message_id: `<${emailId}@mail.gmail.com>`,
    attachments: overrides.attachments ?? [],
  };
  const deps: ResendInboundDeps = {
    getEmail: vi.fn(async () => email),
    listAttachments: vi.fn(async () => structuredClone(BASE_LINKS.data)),
    download: vi.fn(async () => PNG),
  };
  return { event, email, deps };
}

describe("ingestResendEvent (DB)", () => {
  const customers: string[] = [];
  const enquiries: string[] = [];

  beforeEach(() => {
    process.env.INBOUND_EMAIL_DOMAIN = DOMAIN;
  });

  afterEach(() => {
    if (ORIGINAL_DOMAIN === undefined) delete process.env.INBOUND_EMAIL_DOMAIN;
    else process.env.INBOUND_EMAIL_DOMAIN = ORIGINAL_DOMAIN;
  });

  afterAll(async () => {
    if (await dbReachable()) {
      if (enquiries.length)
        await db().enquiry.deleteMany({ where: { id: { in: enquiries } } });
      if (customers.length)
        await db().customer.deleteMany({ where: { id: { in: customers } } });
    }
    await closeTestDb();
  });

  it("ignores an event that is not email.received", async () => {
    expect(
      await ingestResendEvent({ type: "email.delivered", data: { email_id: "x" } }),
    ).toEqual({ status: "ignored", reason: "unsupported_event" });
    expect(await ingestResendEvent(null)).toEqual({
      status: "ignored",
      reason: "unsupported_event",
    });
  });

  it("creates the customer and a new enquiry when there is no token", async () => {
    if (!(await dbReachable())) return;
    const address = `${uid("amy")}@example.com`;
    const { event, deps } = scenario({
      from: `Amy Jones <${address}>`,
      to: [`hello@${DOMAIN}`],
      headers: null,
      subject: "Sleeve idea",
      text: "Hi, can I book a sleeve?",
    });

    const outcome = await ingestResendEvent(event, deps);
    expect(outcome.status).toBe("recorded");
    if (outcome.status !== "recorded") return;
    expect(outcome.createdEnquiry).toBe(true);
    enquiries.push(outcome.enquiryId);

    const enquiry = await db().enquiry.findUniqueOrThrow({
      where: { id: outcome.enquiryId },
      select: {
        channel: true,
        source: true,
        status: true,
        subject: true,
        contactName: true,
        contactEmail: true,
        customerId: true,
        lastInboundAt: true,
      },
    });
    if (enquiry.customerId) customers.push(enquiry.customerId);
    expect(enquiry.channel).toBe("email");
    expect(enquiry.source).toBe("web");
    expect(enquiry.status).toBe("new");
    expect(enquiry.subject).toBe("Sleeve idea");
    expect(enquiry.contactName).toBe("Amy Jones");
    expect(enquiry.contactEmail).toBe(address);
    expect(enquiry.lastInboundAt).toBeInstanceOf(Date);

    const customer = await db().customer.findUniqueOrThrow({
      where: { id: enquiry.customerId as string },
      select: { email: true, name: true },
    });
    expect(customer.email).toBe(address);
    expect(customer.name).toBe("Amy Jones");

    const message = await db().enquiryMessage.findUniqueOrThrow({
      where: { externalId: event.data.email_id },
      select: {
        direction: true,
        channel: true,
        bodyText: true,
        bodyHtml: true,
        fromAddress: true,
        fromName: true,
        subject: true,
        messageIdHeader: true,
        enquiryId: true,
      },
    });
    expect(message.direction).toBe("inbound");
    expect(message.channel).toBe("email");
    expect(message.enquiryId).toBe(outcome.enquiryId);
    expect(message.bodyText).toBe("Hi, can I book a sleeve?");
    expect(message.bodyHtml).toBeTruthy();
    expect(message.fromAddress).toBe(address);
    expect(message.fromName).toBe("Amy Jones");
    expect(message.messageIdHeader).toBe(`<${event.data.email_id}@mail.gmail.com>`);
  });

  it("threads onto the token's enquiry and flips replied → customer_replied", async () => {
    if (!(await dbReachable())) return;
    const address = `${uid("bea")}@example.com`;
    const customer = await db().customer.create({
      data: { name: "Bea Existing", email: address },
    });
    customers.push(customer.id);
    const enquiry = await db().enquiry.create({
      data: {
        customerId: customer.id,
        contactName: "Bea Existing",
        contactEmail: address,
        channel: "email",
        status: "replied",
      },
      select: { id: true, threadToken: true },
    });
    enquiries.push(enquiry.id);

    const { event, deps } = scenario({
      from: `Bea Existing <${address}>`,
      to: [`enq-${enquiry.threadToken}@${DOMAIN}`],
      text: "Tuesday suits, thanks!",
    });
    const outcome = await ingestResendEvent(event, deps);
    expect(outcome).toMatchObject({
      status: "recorded",
      enquiryId: enquiry.id,
      createdEnquiry: false,
    });

    const after = await db().enquiry.findUniqueOrThrow({
      where: { id: enquiry.id },
      select: { status: true, lastInboundAt: true },
    });
    expect(after.status).toBe("customer_replied");
    expect(after.lastInboundAt).toBeInstanceOf(Date);
    expect(await db().enquiry.count({ where: { customerId: customer.id } })).toBe(1);
  });

  it("is idempotent on a replayed delivery", async () => {
    if (!(await dbReachable())) return;
    const address = `${uid("cass")}@example.com`;
    const { event, deps } = scenario({
      from: `Cass <${address}>`,
      to: [`hello@${DOMAIN}`],
      headers: null,
      text: "First and only",
    });

    const first = await ingestResendEvent(event, deps);
    expect(first.status).toBe("recorded");
    if (first.status !== "recorded") return;
    enquiries.push(first.enquiryId);
    const enquiry = await db().enquiry.findUniqueOrThrow({
      where: { id: first.enquiryId },
      select: { customerId: true },
    });
    if (enquiry.customerId) customers.push(enquiry.customerId);

    const second = await ingestResendEvent(event, deps);
    expect(second).toEqual({
      status: "duplicate",
      enquiryId: first.enquiryId,
      messageId: first.messageId,
    });
    // The replay must not re-fetch, and must not duplicate the row.
    expect(deps.getEmail).toHaveBeenCalledTimes(1);
    expect(
      await db().enquiryMessage.count({ where: { enquiryId: first.enquiryId } }),
    ).toBe(1);
  });

  it("stores a sniffed image inline and a non-image as a link", async () => {
    if (!(await dbReachable())) return;
    const address = `${uid("dee")}@example.com`;
    const { event, deps } = scenario({
      from: `Dee <${address}>`,
      to: [`hello@${DOMAIN}`],
      headers: null,
      attachments: structuredClone(BASE_EMAIL.attachments),
    });
    const outcome = await ingestResendEvent(event, deps);
    expect(outcome.status).toBe("recorded");
    if (outcome.status !== "recorded") return;
    enquiries.push(outcome.enquiryId);
    const enquiry = await db().enquiry.findUniqueOrThrow({
      where: { id: outcome.enquiryId },
      select: { customerId: true },
    });
    if (enquiry.customerId) customers.push(enquiry.customerId);

    const rows = await db().attachment.findMany({
      where: { messageId: outcome.messageId },
      orderBy: { createdAt: "asc" },
      select: { mime: true, size: true, filename: true, url: true, bytes: true },
    });
    expect(rows).toHaveLength(2);
    expect(rows[0].mime).toBe("image/png");
    expect(rows[0].bytes).not.toBeNull();
    expect(rows[0].size).toBe(PNG.byteLength);
    expect(rows[1].mime).toBe("application/pdf");
    expect(rows[1].bytes).toBeNull();
    expect(rows[1].url).toContain("att_01HZX9Q0000000000000000002");
  });

  it("drops auto-replies and mail from our own inbound domain", async () => {
    if (!(await dbReachable())) return;
    const auto = scenario({
      from: `Robot <${uid("robot")}@example.com>`,
      to: [`hello@${DOMAIN}`],
      headers: { "Auto-Submitted": "auto-replied" },
    });
    expect(await ingestResendEvent(auto.event, auto.deps)).toEqual({
      status: "ignored",
      reason: "auto_reply",
    });

    const loop = scenario({
      from: `Studio <enquiries@${DOMAIN}>`,
      to: [`hello@${DOMAIN}`],
      headers: null,
    });
    expect(await ingestResendEvent(loop.event, loop.deps)).toEqual({
      status: "ignored",
      reason: "self_addressed",
    });

    expect(
      await prisma.enquiryMessage.count({
        where: { externalId: { in: [auto.event.data.email_id, loop.event.data.email_id] } },
      }),
    ).toBe(0);
  });

  /* Hostile / degenerate inputs. */

  it("survives the same delivery racing itself: one message, consistent outcomes", async () => {
    if (!(await dbReachable())) return;
    const address = `${uid("eve")}@example.com`;
    const { event, deps } = scenario({
      from: `Eve <${address}>`,
      to: [`hello@${DOMAIN}`],
      headers: null,
      text: "Sent twice by the provider",
    });

    // Both calls pass the fast-path externalId check before either has
    // written, so the unique index is the only thing standing between us and
    // a duplicate thread bubble.
    const [a, b] = await Promise.all([
      ingestResendEvent(event, deps),
      ingestResendEvent(event, deps),
    ]);
    for (const outcome of [a, b]) {
      if (outcome.status === "recorded" || outcome.status === "duplicate") {
        enquiries.push(outcome.enquiryId);
      }
    }

    const rows = await db().enquiryMessage.findMany({
      where: { externalId: event.data.email_id },
      select: { id: true, enquiryId: true },
    });
    expect(rows).toHaveLength(1);
    const customer = await db().customer.findUniqueOrThrow({
      where: { email: address },
      select: { id: true },
    });
    customers.push(customer.id);

    // Whatever each caller was told, it must point at the row that exists —
    // the retry button and the webhook route both surface these ids.
    for (const outcome of [a, b]) {
      expect(outcome.status).not.toBe("ignored");
      if (outcome.status === "ignored") continue;
      expect(outcome.messageId).toBe(rows[0].id);
      expect(outcome.enquiryId).toBe(rows[0].enquiryId);
    }
  });

  it("ignores a reply token belonging to a different customer", async () => {
    if (!(await dbReachable())) return;
    const victimAddress = `${uid("victim")}@example.com`;
    const victim = await db().customer.create({
      data: { name: "Victim", email: victimAddress },
    });
    customers.push(victim.id);
    const victimEnquiry = await db().enquiry.create({
      data: {
        customerId: victim.id,
        contactName: "Victim",
        contactEmail: victimAddress,
        channel: "email",
        status: "replied",
      },
      select: { id: true, threadToken: true },
    });
    enquiries.push(victimEnquiry.id);

    // A stranger guesses (or is forwarded) the victim's reply address.
    const attackerAddress = `${uid("mallory")}@example.com`;
    const { event, deps } = scenario({
      from: `Mallory <${attackerAddress}>`,
      to: [`enq-${victimEnquiry.threadToken}@${DOMAIN}`],
      headers: null,
      text: "Let me in",
    });
    const outcome = await ingestResendEvent(event, deps);
    expect(outcome.status).toBe("recorded");
    if (outcome.status !== "recorded") return;
    enquiries.push(outcome.enquiryId);

    expect(outcome.enquiryId).not.toBe(victimEnquiry.id);
    expect(outcome.createdEnquiry).toBe(true);
    const attacker = await db().customer.findUniqueOrThrow({
      where: { email: attackerAddress },
      select: { id: true },
    });
    customers.push(attacker.id);

    const untouched = await db().enquiry.findUniqueOrThrow({
      where: { id: victimEnquiry.id },
      select: { status: true, lastInboundAt: true, _count: { select: { messages: true } } },
    });
    expect(untouched.status).toBe("replied");
    expect(untouched.lastInboundAt).toBeNull();
    expect(untouched._count.messages).toBe(0);
  });

  it("names a nameless first-time sender from the email local part", async () => {
    if (!(await dbReachable())) return;
    const local = uid("faye");
    const address = `${local}@example.com`;
    const { event, deps } = scenario({
      from: address, // bare address, no display name
      to: [`hello@${DOMAIN}`],
      headers: null,
      text: "No display name here",
    });

    const outcome = await ingestResendEvent(event, deps);
    expect(outcome.status).toBe("recorded");
    if (outcome.status !== "recorded") return;
    enquiries.push(outcome.enquiryId);

    const enquiry = await db().enquiry.findUniqueOrThrow({
      where: { id: outcome.enquiryId },
      select: { contactName: true, customerId: true },
    });
    if (enquiry.customerId) customers.push(enquiry.customerId);
    expect(enquiry.contactName).toBe(local);

    const customer = await db().customer.findUniqueOrThrow({
      where: { id: enquiry.customerId as string },
      select: { name: true },
    });
    expect(customer.name).toBe(local);
  });

  it("records the message when an attachment download throws", async () => {
    if (!(await dbReachable())) return;
    const address = `${uid("gus")}@example.com`;
    const { event, deps } = scenario({
      from: `Gus <${address}>`,
      to: [`hello@${DOMAIN}`],
      headers: null,
      attachments: structuredClone(BASE_EMAIL.attachments),
    });
    deps.download = vi.fn(async () => {
      throw new Error("attachment host is down");
    });

    const outcome = await ingestResendEvent(event, deps);
    expect(outcome.status).toBe("recorded");
    if (outcome.status !== "recorded") return;
    enquiries.push(outcome.enquiryId);
    const enquiry = await db().enquiry.findUniqueOrThrow({
      where: { id: outcome.enquiryId },
      select: { customerId: true },
    });
    if (enquiry.customerId) customers.push(enquiry.customerId);

    // Nothing is lost: both attachments survive as links staff can still open.
    const rows = await db().attachment.findMany({
      where: { messageId: outcome.messageId },
      select: { bytes: true, url: true },
    });
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.bytes === null)).toBe(true);
    expect(rows.every((row) => Boolean(row.url))).toBe(true);
  });

  it("records a message with no attachments without listing any", async () => {
    if (!(await dbReachable())) return;
    const address = `${uid("hal")}@example.com`;
    const { event, deps } = scenario({
      from: `Hal <${address}>`,
      to: [`hello@${DOMAIN}`],
      headers: null,
      attachments: [],
    });

    const outcome = await ingestResendEvent(event, deps);
    expect(outcome.status).toBe("recorded");
    if (outcome.status !== "recorded") return;
    enquiries.push(outcome.enquiryId);
    const enquiry = await db().enquiry.findUniqueOrThrow({
      where: { id: outcome.enquiryId },
      select: { customerId: true },
    });
    if (enquiry.customerId) customers.push(enquiry.customerId);

    expect(deps.listAttachments).not.toHaveBeenCalled();
    expect(
      await db().attachment.count({ where: { messageId: outcome.messageId } }),
    ).toBe(0);
  });
});
