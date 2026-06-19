import { afterAll, describe, expect, it, vi } from "vitest";
import { closeTestDb, dbReachable, testDb } from "@/lib/services/testdb";

vi.mock("@/lib/auth", () => ({
  requireRole: vi.fn(async () => ({
    id: "u1",
    email: "o@x",
    role: "OWNER" as const,
    displayName: "Owner",
  })),
  getCurrentUser: vi.fn(async () => null),
}));

const { GET, PUT } = await import("./route");

describe("/api/availability (admin)", () => {
  const db = () => testDb();
  let artistId: string;

  afterAll(async () => {
    if (artistId)
      await db().availabilityRule.deleteMany({ where: { artistId } });
    await closeTestDb();
  });

  it("PUT replaces rules, GET returns them", async () => {
    if (!(await dbReachable())) return;
    const artist = await db().artist.findFirstOrThrow();
    artistId = artist.id;

    const put = await PUT(
      new Request("http://x/api/availability", {
        method: "PUT",
        body: JSON.stringify({
          artistId,
          rules: [{ weekday: 2, startTime: "10:00", endTime: "18:00" }],
        }),
      }),
    );
    expect(put.status).toBe(200);

    const get = await GET(
      new Request(`http://x/api/availability?artistId=${artistId}`),
    );
    expect(get.status).toBe(200);
    const body = await get.json();
    expect(body.rules.length).toBe(1);
  });

  it("GET 400s without artistId", async () => {
    const res = await GET(new Request("http://x/api/availability"));
    expect(res.status).toBe(400);
  });
});
