import { afterAll, describe, expect, it, vi } from "vitest";
import { closeTestDb, dbReachable, testDb, uid } from "./testdb";

const db = () => testDb();

const sendEmail = vi.fn(
  (input: { type: string; data: Record<string, unknown> }) =>
    Promise.resolve({ id: uid("msg"), status: "sent", type: input.type }),
);
vi.mock("@bnb/core/email", () => ({ sendEmail }));

const { createEnquiry } = await import("./enquiries");

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
