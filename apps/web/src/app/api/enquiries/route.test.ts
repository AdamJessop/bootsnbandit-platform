import { afterAll, describe, expect, it, vi } from "vitest";
import { closeTestDb, dbReachable, testDb } from "@bnb/core/services/testdb";

vi.mock("@bnb/core/email", () => ({
  sendEmail: vi.fn(async () => ({ id: "msg", status: "sent" })),
}));

const routeModule = await import("./route");
const { POST } = routeModule;

describe("/api/enquiries", () => {
  const db = () => testDb();
  const enquiries: string[] = [];
  const customers: string[] = [];

  afterAll(async () => {
    if (enquiries.length)
      await db().enquiry.deleteMany({ where: { id: { in: enquiries } } });
    if (customers.length)
      await db().customer.deleteMany({ where: { id: { in: customers } } });
    await closeTestDb();
  });

  it("POST creates an enquiry (public, source=web)", async () => {
    if (!(await dbReachable())) return;
    const res = await POST(
      new Request("http://x/api/enquiries", {
        method: "POST",
        body: JSON.stringify({
          contactName: "Web Lead",
          contactEmail: `route-${Date.now()}@example.com`,
          style: "Fine-line",
        }),
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.enquiry.source).toBe("web");
    enquiries.push(body.enquiry.id);
    if (body.enquiry.customerId) customers.push(body.enquiry.customerId);
  });

  it("POST 400s without a contact name", async () => {
    if (!(await dbReachable())) return;
    const res = await POST(
      new Request("http://x/api/enquiries", {
        method: "POST",
        body: JSON.stringify({ style: "Fine-line" }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("does not ship a staff GET handler on the public origin", () => {
    expect("GET" in routeModule).toBe(false);
  });
});
