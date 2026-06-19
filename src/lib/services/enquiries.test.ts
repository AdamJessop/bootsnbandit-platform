import { afterAll, describe, expect, it, vi } from "vitest";
import { closeTestDb, dbReachable, testDb, uid } from "./testdb";

const db = () => testDb();

const sendEmail = vi.fn((input: { type: string }) =>
  Promise.resolve({ id: uid("msg"), status: "sent", type: input.type }),
);
vi.mock("@/lib/email", () => ({ sendEmail }));

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
});
