import { afterAll, describe, expect, it, vi } from "vitest";
import { closeTestDb, dbReachable, testDb, uid } from "@/lib/services/testdb";

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

const { GET, POST } = await import("./route");

describe("/api/customers (admin)", () => {
  const db = () => testDb();
  const customers: string[] = [];
  const artists: string[] = [];
  const users: string[] = [];
  const bookings: string[] = [];

  afterAll(async () => {
    if (bookings.length)
      await db().booking.deleteMany({ where: { id: { in: bookings } } });
    if (customers.length)
      await db().customer.deleteMany({ where: { id: { in: customers } } });
    if (artists.length)
      await db().artist.deleteMany({ where: { id: { in: artists } } });
    if (users.length)
      await db().user.deleteMany({ where: { id: { in: users } } });
    await closeTestDb();
  });

  it("POST creates a customer (requires a signed-in user)", async () => {
    if (!(await dbReachable())) return;
    requireRole.mockClear();
    const res = await POST(
      new Request("http://x/api/customers", {
        method: "POST",
        body: JSON.stringify({ name: "Route Cust", marketingConsent: true }),
      }),
    );
    expect(res.status).toBe(201);
    expect(requireRole).toHaveBeenCalled();
    const body = await res.json();
    customers.push(body.customer.id);
  });

  it("GET lists customers (owner sees all)", async () => {
    if (!(await dbReachable())) return;
    const res = await GET(new Request("http://x/api/customers?take=3"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.customers)).toBe(true);
  });

  it("GET scopes a non-OWNER to customers with a booking by their artist", async () => {
    if (!(await dbReachable())) return;
    const d = db();
    // Two artists, two customers; only customer A has a booking by artist A.
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
    const custA = await d.customer.create({
      data: { name: `Cust A ${uid()}` },
    });
    const custB = await d.customer.create({
      data: { name: `Cust B ${uid()}` },
    });
    customers.push(custA.id, custB.id);
    const now = new Date();
    const bookingA = await d.booking.create({
      data: {
        customerId: custA.id,
        artistId: artistA.id,
        type: "session",
        start: now,
        end: new Date(now.getTime() + 3600_000),
        durationMin: 60,
      },
    });
    const bookingB = await d.booking.create({
      data: {
        customerId: custB.id,
        artistId: artistB.id,
        type: "session",
        start: now,
        end: new Date(now.getTime() + 3600_000),
        durationMin: 60,
      },
    });
    bookings.push(bookingA.id, bookingB.id);

    requireRole.mockResolvedValueOnce({
      id: "ua",
      email: "a@x",
      role: "ARTIST",
      displayName: "Artist A",
      artistId: artistA.id,
    });
    const res = await GET(new Request("http://x/api/customers?take=200"));
    expect(res.status).toBe(200);
    const body = await res.json();
    const ids: string[] = body.customers.map((c: { id: string }) => c.id);
    expect(ids).toContain(custA.id);
    expect(ids).not.toContain(custB.id);
  });

  it("returns 401 when auth throws", async () => {
    requireRole.mockRejectedValueOnce(new Error("requireRole: unauthorized"));
    const res = await GET(new Request("http://x/api/customers"));
    expect(res.status).toBe(401);
  });
});
