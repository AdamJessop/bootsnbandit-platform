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

describe("/api/leave (admin)", () => {
  const db = () => testDb();
  const leaves: string[] = [];

  afterAll(async () => {
    if (leaves.length)
      await db().leave.deleteMany({ where: { id: { in: leaves } } });
    await closeTestDb();
  });

  it("POST creates leave, GET lists it", async () => {
    if (!(await dbReachable())) return;
    const artist = await db().artist.findFirstOrThrow();
    const res = await POST(
      new Request("http://x/api/leave", {
        method: "POST",
        body: JSON.stringify({
          artistId: artist.id,
          startDate: "2099-09-01T00:00:00Z",
          endDate: "2099-09-07T00:00:00Z",
          reason: `Route leave ${uid()}`,
        }),
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    leaves.push(body.leave.id);

    const get = await GET(
      new Request(`http://x/api/leave?artistId=${artist.id}`),
    );
    expect(get.status).toBe(200);
    const list = await get.json();
    expect(Array.isArray(list.leave)).toBe(true);
  });

  it("403s when an artist creates leave for another artist (POST)", async () => {
    asArtist("other-artist");
    const res = await POST(
      new Request("http://x/api/leave", {
        method: "POST",
        body: JSON.stringify({
          artistId: "victim-artist",
          startDate: "2099-09-01T00:00:00Z",
          endDate: "2099-09-07T00:00:00Z",
        }),
      }),
    );
    expect(res.status).toBe(403);
  });

  it("403s when an artist lists another artist's leave (GET)", async () => {
    asArtist("other-artist");
    const res = await GET(
      new Request("http://x/api/leave?artistId=victim-artist"),
    );
    expect(res.status).toBe(403);
  });

  it("forces non-owner leave to pending even if approved is requested", async () => {
    if (!(await dbReachable())) return;
    const artist = await db().artist.findFirstOrThrow();
    asArtist(artist.id);
    const res = await POST(
      new Request("http://x/api/leave", {
        method: "POST",
        body: JSON.stringify({
          artistId: artist.id,
          startDate: "2099-09-10T00:00:00Z",
          endDate: "2099-09-12T00:00:00Z",
          reason: `Self leave ${uid()}`,
          status: "approved",
        }),
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    leaves.push(body.leave.id);
    expect(body.leave.status).toBe("pending");
  });
});
