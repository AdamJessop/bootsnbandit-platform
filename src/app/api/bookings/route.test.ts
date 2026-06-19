import { afterAll, describe, expect, it, vi } from "vitest";
import { closeTestDb, dbReachable, testDb, uid } from "@/lib/services/testdb";

vi.mock("@/lib/auth", () => ({
  requireRole: vi.fn(async () => ({
    id: "u1",
    email: "o@x",
    role: "OWNER" as const,
    displayName: "Owner",
  })),
  getCurrentUser: vi.fn(async () => null),
}));

const { GET, POST } = await import("./route");

describe("/api/bookings (admin)", () => {
  const db = () => testDb();
  const bookings: string[] = [];
  const customers: string[] = [];

  afterAll(async () => {
    if (bookings.length)
      await db().booking.deleteMany({ where: { id: { in: bookings } } });
    if (customers.length)
      await db().customer.deleteMany({ where: { id: { in: customers } } });
    await closeTestDb();
  });

  it("POST creates a booking", async () => {
    if (!(await dbReachable())) return;
    const artist = await db().artist.findFirstOrThrow();
    const customer = await db().customer.create({
      data: { name: `Route booking ${uid()}` },
    });
    customers.push(customer.id);

    const res = await POST(
      new Request("http://x/api/bookings", {
        method: "POST",
        body: JSON.stringify({
          customerId: customer.id,
          artistId: artist.id,
          type: "session",
          start: "2099-11-01T10:00:00Z",
          end: "2099-11-01T12:00:00Z",
          durationMin: 120,
        }),
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    bookings.push(body.booking.id);

    // Overlapping → 409.
    const conflict = await POST(
      new Request("http://x/api/bookings", {
        method: "POST",
        body: JSON.stringify({
          customerId: customer.id,
          artistId: artist.id,
          type: "session",
          start: "2099-11-01T11:00:00Z",
          end: "2099-11-01T13:00:00Z",
          durationMin: 120,
        }),
      }),
    );
    expect(conflict.status).toBe(409);
  });

  it("GET lists bookings", async () => {
    if (!(await dbReachable())) return;
    const res = await GET(new Request("http://x/api/bookings?take=5"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.bookings)).toBe(true);
  });
});
