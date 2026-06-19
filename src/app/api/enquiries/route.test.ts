import { afterAll, describe, expect, it, vi } from "vitest";
import { closeTestDb, dbReachable, testDb, uid } from "@/lib/services/testdb";

vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn(async () => ({ id: "msg", status: "sent" })),
}));
// Admin GET requires an OWNER; stub the auth contract.
const requireRole = vi.fn(
  async (): Promise<{
    id: string;
    email: string;
    role: "OWNER" | "ARTIST";
    displayName: string;
    artistId: string | null;
  }> => ({
    id: "u1",
    email: "o@x",
    role: "OWNER",
    displayName: "Owner",
    artistId: null,
  }),
);
vi.mock("@/lib/auth", () => ({
  requireRole,
  getCurrentUser: vi.fn(async () => null),
}));

const { POST, GET } = await import("./route");

describe("/api/enquiries", () => {
  const db = () => testDb();
  const enquiries: string[] = [];
  const customers: string[] = [];
  const artists: string[] = [];
  const users: string[] = [];

  afterAll(async () => {
    if (enquiries.length)
      await db().enquiry.deleteMany({ where: { id: { in: enquiries } } });
    if (customers.length)
      await db().customer.deleteMany({ where: { id: { in: customers } } });
    if (artists.length)
      await db().artist.deleteMany({ where: { id: { in: artists } } });
    if (users.length)
      await db().user.deleteMany({ where: { id: { in: users } } });
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
    const res = await POST(
      new Request("http://x/api/enquiries", {
        method: "POST",
        body: JSON.stringify({ style: "Fine-line" }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("GET lists enquiries (owner sees all)", async () => {
    if (!(await dbReachable())) return;
    const res = await GET(new Request("http://x/api/enquiries"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.enquiries)).toBe(true);
  });

  it("GET scopes a non-OWNER to enquiries preferring their artist", async () => {
    if (!(await dbReachable())) return;
    const d = db();
    const slug = uid("art");
    const artistA = await d.artist.create({
      data: {
        slug: `${slug}-a`,
        name: "Artist A",
        status: "RESIDENT",
        user: {
          create: { email: `${slug}-a@example.test`, displayName: "Artist A" },
        },
      },
    });
    const artistB = await d.artist.create({
      data: {
        slug: `${slug}-b`,
        name: "Artist B",
        status: "RESIDENT",
        user: {
          create: { email: `${slug}-b@example.test`, displayName: "Artist B" },
        },
      },
    });
    artists.push(artistA.id, artistB.id);
    users.push(artistA.userId, artistB.userId);
    const eqA = await d.enquiry.create({
      data: { contactName: `Lead A ${uid()}`, preferredArtistId: artistA.id },
    });
    const eqB = await d.enquiry.create({
      data: { contactName: `Lead B ${uid()}`, preferredArtistId: artistB.id },
    });
    enquiries.push(eqA.id, eqB.id);

    requireRole.mockResolvedValueOnce({
      id: "ua",
      email: "a@x",
      role: "ARTIST",
      displayName: "Artist A",
      artistId: artistA.id,
    });
    const res = await GET(new Request("http://x/api/enquiries?take=200"));
    expect(res.status).toBe(200);
    const body = await res.json();
    const ids: string[] = body.enquiries.map((e: { id: string }) => e.id);
    expect(ids).toContain(eqA.id);
    expect(ids).not.toContain(eqB.id);
  });
});
