import { afterAll, describe, expect, it, vi } from "vitest";
import {
  closeTestDb,
  dbReachable,
  testDb,
  uid,
} from "@bnb/core/services/testdb";

vi.mock("@bnb/core/auth", () => ({
  requireRole: vi.fn(async () => ({
    id: "u1",
    email: "o@x",
    role: "OWNER" as const,
    displayName: "Owner",
  })),
  getCurrentUser: vi.fn(async () => null),
}));

const { requireRole } = await import("@bnb/core/auth");
const asArtist = (artistId: string | null) =>
  vi.mocked(requireRole).mockResolvedValueOnce({
    id: "a1",
    email: "artist@x",
    role: "ARTIST" as const,
    displayName: "Artist",
    artistId,
  });

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

  it("403s when an artist creates a booking for another artist (POST)", async () => {
    if (!(await dbReachable())) return;
    const customer = await db().customer.create({
      data: { name: `Route booking idor ${uid()}` },
    });
    customers.push(customer.id);
    asArtist("other-artist");
    const res = await POST(
      new Request("http://x/api/bookings", {
        method: "POST",
        body: JSON.stringify({
          customerId: customer.id,
          artistId: "victim-artist",
          type: "session",
          start: "2099-11-20T10:00:00Z",
          end: "2099-11-20T12:00:00Z",
          durationMin: 120,
        }),
      }),
    );
    expect(res.status).toBe(403);
  });

  it("GET self-scopes a non-owner to their own bookings", async () => {
    if (!(await dbReachable())) return;
    const artist = await db().artist.findFirstOrThrow();
    const customer = await db().customer.create({
      data: { name: `Route booking scope ${uid()}` },
    });
    customers.push(customer.id);
    const mine = await POST(
      new Request("http://x/api/bookings", {
        method: "POST",
        body: JSON.stringify({
          customerId: customer.id,
          artistId: artist.id,
          type: "session",
          start: "2099-11-25T10:00:00Z",
          end: "2099-11-25T12:00:00Z",
          durationMin: 120,
        }),
      }),
    );
    bookings.push((await mine.json()).booking.id);

    // Artist asks for a different artistId; route must override to their own.
    asArtist(artist.id);
    const res = await GET(
      new Request("http://x/api/bookings?artistId=some-other-artist&take=100"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.bookings)).toBe(true);
    for (const b of body.bookings) {
      expect(b.artistId).toBe(artist.id);
    }
  });
});
