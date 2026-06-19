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
vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn(async () => ({ id: "msg", status: "sent" })),
}));

const { requireRole } = await import("@/lib/auth");
const asArtist = (artistId: string | null) =>
  vi.mocked(requireRole).mockResolvedValueOnce({
    id: "a1",
    email: "artist@x",
    role: "ARTIST" as const,
    displayName: "Artist",
    artistId,
  });

const { POST } = await import("./route");

describe("POST /api/sessions (complete session, admin)", () => {
  const db = () => testDb();
  const cleanup = {
    sessions: [] as string[],
    bookings: [] as string[],
    customers: [] as string[],
  };

  afterAll(async () => {
    if (cleanup.sessions.length)
      await db().session.deleteMany({ where: { id: { in: cleanup.sessions } } });
    if (cleanup.bookings.length)
      await db().booking.deleteMany({ where: { id: { in: cleanup.bookings } } });
    if (cleanup.customers.length)
      await db().customer.deleteMany({
        where: { id: { in: cleanup.customers } },
      });
    await closeTestDb();
  });

  it("completes a session, returns 201 with the session", async () => {
    if (!(await dbReachable())) return;
    const artist = await db().artist.findFirstOrThrow();
    const customer = await db().customer.create({
      data: { name: `Route session ${uid()}` },
    });
    cleanup.customers.push(customer.id);
    const booking = await db().booking.create({
      data: {
        customerId: customer.id,
        artistId: artist.id,
        type: "session",
        start: new Date("2099-12-01T10:00:00Z"),
        end: new Date("2099-12-01T12:00:00Z"),
        durationMin: 120,
        status: "confirmed",
      },
    });
    cleanup.bookings.push(booking.id);

    const res = await POST(
      new Request("http://x/api/sessions", {
        method: "POST",
        body: JSON.stringify({
          bookingId: booking.id,
          amountChargedPence: 15000,
          tipPence: 1500,
          bankRef: "REF-9",
        }),
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.session.amountChargedPence).toBe(15000);
    cleanup.sessions.push(body.session.id);

    const logs = await db().messageLog.findMany({
      where: { relatedBookingId: booking.id },
    });
    // Mocked sendEmail doesn't write logs here; assert booking completed instead.
    void logs;
    const refreshed = await db().booking.findUniqueOrThrow({
      where: { id: booking.id },
    });
    expect(refreshed.status).toBe("completed");
  });

  it("400s on a negative amount", async () => {
    const res = await POST(
      new Request("http://x/api/sessions", {
        method: "POST",
        body: JSON.stringify({ bookingId: "x", amountChargedPence: -1 }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("403s when an artist completes another artist's booking", async () => {
    if (!(await dbReachable())) return;
    const artist = await db().artist.findFirstOrThrow();
    const customer = await db().customer.create({
      data: { name: `Route session idor ${uid()}` },
    });
    cleanup.customers.push(customer.id);
    const booking = await db().booking.create({
      data: {
        customerId: customer.id,
        artistId: artist.id,
        type: "session",
        start: new Date("2099-12-05T10:00:00Z"),
        end: new Date("2099-12-05T12:00:00Z"),
        durationMin: 120,
        status: "confirmed",
      },
    });
    cleanup.bookings.push(booking.id);

    asArtist("a-different-artist");
    const res = await POST(
      new Request("http://x/api/sessions", {
        method: "POST",
        body: JSON.stringify({
          bookingId: booking.id,
          amountChargedPence: 1000,
        }),
      }),
    );
    expect(res.status).toBe(403);
    // Booking must remain not-completed.
    const refreshed = await db().booking.findUniqueOrThrow({
      where: { id: booking.id },
    });
    expect(refreshed.status).not.toBe("completed");
  });
});
