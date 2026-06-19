import { afterAll, describe, expect, it, vi } from "vitest";
import { closeTestDb, dbReachable, testDb, uid } from "@/lib/services/testdb";

vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn(async () => ({ id: "msg", status: "sent" })),
}));

const { POST } = await import("./route");

describe("POST /api/flash (public claim)", () => {
  const db = () => testDb();
  const flashes: string[] = [];
  const enquiries: string[] = [];
  const customers: string[] = [];

  afterAll(async () => {
    if (enquiries.length)
      await db().enquiry.deleteMany({ where: { id: { in: enquiries } } });
    if (customers.length)
      await db().customer.deleteMany({ where: { id: { in: customers } } });
    if (flashes.length)
      await db().flash.deleteMany({ where: { id: { in: flashes } } });
    await closeTestDb();
  });

  it("claims a flash and returns the enquiry + updated flash", async () => {
    if (!(await dbReachable())) return;
    const artist = await db().artist.findFirstOrThrow();
    const flash = await db().flash.create({
      data: {
        title: `Route flash ${uid()}`,
        artistId: artist.id,
        total: 2,
        claimed: 0,
        pricePence: 9000,
        status: "available",
      },
    });
    flashes.push(flash.id);

    const res = await POST(
      new Request("http://x/api/flash", {
        method: "POST",
        body: JSON.stringify({
          flashId: flash.id,
          contactName: "Flash Claimer",
          placement: "Forearm",
        }),
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.flash.claimed).toBe(1);
    expect(body.enquiry.source).toBe("flash");
    enquiries.push(body.enquiry.id);
    if (body.enquiry.customerId) customers.push(body.enquiry.customerId);
  });

  it("409s when the flash is sold out", async () => {
    if (!(await dbReachable())) return;
    const flash = await db().flash.create({
      data: { title: `Sold ${uid()}`, total: 1, claimed: 1, status: "claimed" },
    });
    flashes.push(flash.id);
    const res = await POST(
      new Request("http://x/api/flash", {
        method: "POST",
        body: JSON.stringify({ flashId: flash.id, contactName: "Late" }),
      }),
    );
    expect(res.status).toBe(409);
  });
});
