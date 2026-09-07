import { afterAll, describe, expect, it, vi } from "vitest";
import { closeTestDb, dbReachable, testDb, uid } from "./testdb";

const db = () => testDb();

const sendEmail = vi.fn(
  (input: { type: string; data: Record<string, unknown> }) =>
    Promise.resolve({ id: uid("msg"), status: "sent", type: input.type }),
);
vi.mock("@bnb/core/email", () => ({ sendEmail }));

const { channelForSource, createEnquiry, enquiryBriefText, enquirySubject } =
  await import("./enquiries");

describe("createEnquiry (DB + mocked email)", () => {
  const customers: string[] = [];
  const enquiries: string[] = [];

  afterAll(async () => {
    if (enquiries.length)
      await db().enquiry.deleteMany({ where: { id: { in: enquiries } } });
    if (customers.length)
      await db().customer.deleteMany({ where: { id: { in: customers } } });
    await closeTestDb();
  });

  it("creates an Enquiry (source=web), links a customer, sends enquiry_ack", async () => {
    if (!(await dbReachable())) return;
    sendEmail.mockClear();
    const email = `${uid("e")}@example.com`;
    const enq = await createEnquiry({
      contactName: "Hannah M",
      contactEmail: email,
      style: "Fine-line",
      placement: "Forearm",
      description: "Small floral piece",
    });
    enquiries.push(enq.id);
    if (enq.customerId) customers.push(enq.customerId);

    expect(enq.source).toBe("web");
    expect(enq.status).toBe("new");
    expect(enq.customerId).toBeTruthy();
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0][0].type).toBe("enquiry_ack");
    // Regression: the ack must use the keys the template consumes
    // (customerName/subjectIdea), not the old contactName/style/source shape.
    const data = sendEmail.mock.calls[0][0].data;
    expect(data.customerName).toBe("Hannah M");
    expect(data.subjectIdea).toBe("Small floral piece");
  });

  it("falls back to style for subjectIdea and resolves the preferred artist's name", async () => {
    if (!(await dbReachable())) return;
    sendEmail.mockClear();
    const artist = await db().artist.findFirstOrThrow();
    const enq = await createEnquiry({
      contactName: `Prefer ${uid()}`,
      contactEmail: `${uid("p")}@example.com`,
      preferredArtistId: artist.id,
      style: "Blackwork",
      // no description → subjectIdea falls back to style
    });
    enquiries.push(enq.id);
    if (enq.customerId) customers.push(enq.customerId);

    expect(sendEmail).toHaveBeenCalledTimes(1);
    const data = sendEmail.mock.calls[0][0].data;
    expect(data.subjectIdea).toBe("Blackwork");
    expect(data.artistName).toBe(artist.name);
  });

  it("sets source=inkling and stores matchData", async () => {
    if (!(await dbReachable())) return;
    const enq = await createEnquiry({
      contactName: `Inkling ${uid()}`,
      contactEmail: `${uid("i")}@example.com`,
      source: "inkling",
      matchData: { top: "sarah", pct: 92 },
    });
    enquiries.push(enq.id);
    if (enq.customerId) customers.push(enq.customerId);
    expect(enq.source).toBe("inkling");
    expect(enq.matchData).toMatchObject({ top: "sarah" });
  });

  it("sets source=flash when claiming flash", async () => {
    if (!(await dbReachable())) return;
    const enq = await createEnquiry({
      contactName: `Flash ${uid()}`,
      source: "flash",
    });
    enquiries.push(enq.id);
    if (enq.customerId) customers.push(enq.customerId);
    expect(enq.source).toBe("flash");
  });

  it("stores moodboardData and attaches uploaded assets", async () => {
    if (!(await dbReachable())) return;
    const asset = await db().moodboardAsset.create({
      data: { bytes: new Uint8Array([1, 2, 3]), mime: "image/png", size: 3 },
    });
    const e = await createEnquiry({
      contactName: `Board ${uid()}`,
      source: "inkling",
      moodboard: ["https://x.test/a.jpg"],
      moodboardData: {
        version: 1,
        styles: ["Fine-line"],
        colour: null,
        description: "peony",
        query: null,
        notes: null,
        items: [],
      },
      assetIds: [asset.id],
    });
    enquiries.push(e.id);
    if (e.customerId) customers.push(e.customerId);
    const attached = await db().moodboardAsset.findUniqueOrThrow({
      where: { id: asset.id },
    });
    expect(attached.enquiryId).toBe(e.id);
    expect((e.moodboardData as { styles: string[] }).styles).toEqual([
      "Fine-line",
    ]);
  });
});

describe("enquiry channel + brief helpers", () => {
  it("maps the legacy source to a channel", () => {
    expect(channelForSource("web")).toBe("web");
    expect(channelForSource("flash")).toBe("flash");
    expect(channelForSource("inkling")).toBe("inkling");
  });

  it("summarises the brief when there is no description", () => {
    expect(
      enquiryBriefText({
        description: "  Peony on the forearm  ",
        style: "Fine-line",
        placement: "Forearm",
        size: null,
        budgetPence: null,
      }),
    ).toBe("Peony on the forearm");
    expect(
      enquiryBriefText({
        description: null,
        style: "Fine-line",
        placement: "Forearm",
        size: "Palm-sized",
        budgetPence: 15000,
      }),
    ).toBe("Style: Fine-line · Placement: Forearm · Size: Palm-sized · Budget: £150.00");
    expect(
      enquiryBriefText({
        description: "   ",
        style: null,
        placement: null,
        size: null,
        budgetPence: null,
      }),
    ).toBe("(no details given)");
  });

  it("derives a short subject", () => {
    expect(enquirySubject({ description: "Peony on the forearm", style: "Fine-line" })).toBe(
      "Peony on the forearm",
    );
    expect(enquirySubject({ description: null, style: "Fine-line" })).toBe("Fine-line");
    expect(enquirySubject({ description: null, style: null })).toBeNull();
    expect(enquirySubject({ description: "x".repeat(200), style: null })?.length).toBe(120);
  });
});

describe("createEnquiry threads (DB)", () => {
  // Own cleanup arrays — the ones above are scoped to the first describe block.
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

  it("normalises the customer, sets the channel and opens the thread with an inbound message", async () => {
    if (!(await dbReachable())) return;
    sendEmail.mockClear();
    const local = uid("thread");
    const enq = await createEnquiry({
      contactName: "Amy Jones",
      contactEmail: `  ${local}@EXAMPLE.com `,
      contactPhone: "07700 900128",
      style: "Fine-line",
      description: "Peony on the forearm",
    });
    enquiries.push(enq.id);
    if (enq.customerId) customers.push(enq.customerId);

    expect(enq.channel).toBe("web");
    expect(enq.subject).toBe("Peony on the forearm");
    expect(enq.threadToken).toBeTruthy();

    const customer = await db().customer.findUniqueOrThrow({
      where: { id: enq.customerId as string },
    });
    expect(customer.email).toBe(`${local}@example.com`);
    expect(customer.phone).toBe("+447700900128");

    const messages = await db().enquiryMessage.findMany({
      where: { enquiryId: enq.id },
      orderBy: { createdAt: "asc" },
    });
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      direction: "inbound",
      channel: "web",
      bodyText: "Peony on the forearm",
      fromName: "Amy Jones",
      fromAddress: `${local}@example.com`,
    });

    const after = await db().enquiry.findUniqueOrThrow({ where: { id: enq.id } });
    expect(after.status).toBe("new");
    expect(after.lastInboundAt).not.toBeNull();
    // The ack is sent with the enquiry id so Phase-1 threads show it too.
    expect(sendEmail.mock.calls[0][0].enquiryId).toBe(enq.id);
  });

  it("sets channel=flash / channel=inkling from the source", async () => {
    if (!(await dbReachable())) return;
    const flash = await createEnquiry({
      contactName: `Flash ${uid()}`,
      source: "flash",
      description: "Flash claim: Bandit Rose",
    });
    enquiries.push(flash.id);
    if (flash.customerId) customers.push(flash.customerId);
    expect(flash.channel).toBe("flash");

    const inkling = await createEnquiry({
      contactName: `Inkling ${uid()}`,
      source: "inkling",
    });
    enquiries.push(inkling.id);
    if (inkling.customerId) customers.push(inkling.customerId);
    expect(inkling.channel).toBe("inkling");
    const body = await db().enquiryMessage.findFirstOrThrow({
      where: { enquiryId: inkling.id },
    });
    expect(body.bodyText).toBe("(no details given)");
  });
});
