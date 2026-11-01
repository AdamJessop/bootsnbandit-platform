import { afterAll, describe, expect, it, vi } from "vitest";
import { closeTestDb, dbReachable, testDb, uid } from "./testdb";

const db = () => testDb();

const sendEmail = vi.fn(async () => ({ id: uid("msg"), status: "sent" }));
vi.mock("@bnb/core/email", () => ({ sendEmail }));

const { claimFlash, FlashUnavailableError } = await import("./flash");

describe("claimFlash (DB + mocked email)", () => {
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

  async function makeFlash(total: number, claimed = 0, withArtist = true) {
    const artist = withArtist ? await db().artist.findFirstOrThrow() : null;
    const f = await db().flash.create({
      data: {
        title: `Flash ${uid()}`,
        artistId: artist?.id ?? null,
        total,
        claimed,
        pricePence: 12000,
        status: "available",
      },
    });
    flashes.push(f.id);
    return f;
  }

  it("decrements availability (increments claimed) and creates a flash Enquiry", async () => {
    if (!(await dbReachable())) return;
    const flash = await makeFlash(3, 0);

    const result = await claimFlash({
      flashId: flash.id,
      contactName: "Claimer",
      contactEmail: `${uid("f")}@example.com`,
      placement: "Forearm",
    });
    enquiries.push(result.enquiry.id);
    if (result.enquiry.customerId) customers.push(result.enquiry.customerId);

    expect(result.enquiry.source).toBe("flash");
    expect(result.flash.claimed).toBe(1);

    const refreshed = await db().flash.findUniqueOrThrow({
      where: { id: flash.id },
    });
    expect(refreshed.claimed).toBe(1);
  });

  it("prefers the flash design's artist over the visitor's pick", async () => {
    if (!(await dbReachable())) return;
    const flash = await makeFlash(3, 0);
    const other = await db().artist.findFirstOrThrow({
      where: { id: { not: flash.artistId! } },
    });
    const result = await claimFlash({
      flashId: flash.id,
      contactName: "Picker",
      preferredArtistId: other.id,
    });
    enquiries.push(result.enquiry.id);
    if (result.enquiry.customerId) customers.push(result.enquiry.customerId);
    expect(result.enquiry.preferredArtistId).toBe(flash.artistId);
  });

  it("falls back to the visitor's pick when the flash has no artist", async () => {
    if (!(await dbReachable())) return;
    const flash = await makeFlash(3, 0, false);
    const artist = await db().artist.findFirstOrThrow();
    const result = await claimFlash({
      flashId: flash.id,
      contactName: "Picker",
      preferredArtistId: artist.id,
    });
    enquiries.push(result.enquiry.id);
    if (result.enquiry.customerId) customers.push(result.enquiry.customerId);
    expect(result.enquiry.preferredArtistId).toBe(artist.id);
  });

  it("marks the flash claimed when the last one is taken", async () => {
    if (!(await dbReachable())) return;
    const flash = await makeFlash(1, 0);
    const result = await claimFlash({
      flashId: flash.id,
      contactName: "Last",
    });
    enquiries.push(result.enquiry.id);
    if (result.enquiry.customerId) customers.push(result.enquiry.customerId);
    expect(result.flash.claimed).toBe(1);
    expect(result.flash.status).toBe("claimed");
  });

  it("rejects a claim when none are left", async () => {
    if (!(await dbReachable())) return;
    const flash = await makeFlash(2, 2);
    await expect(
      claimFlash({ flashId: flash.id, contactName: "TooLate" }),
    ).rejects.toBeInstanceOf(FlashUnavailableError);
  });
});
