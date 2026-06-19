import { afterAll, describe, expect, it, vi } from "vitest";
import { closeTestDb, dbReachable } from "@/lib/services/testdb";

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

const { GET } = await import("./route");

describe("GET /api/reports (admin)", () => {
  afterAll(async () => {
    await closeTestDb();
  });

  it("returns an overview for a date range (owner)", async () => {
    if (!(await dbReachable())) return;
    requireRole.mockResolvedValueOnce({
      id: "u1",
      email: "o@x",
      role: "OWNER",
      displayName: "Owner",
      artistId: null,
    });
    const res = await GET(
      new Request("http://x/api/reports?from=2099-10-01&to=2099-10-31"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.report.totals).toBeDefined();
    expect(Array.isArray(body.report.perArtist)).toBe(true);
  });

  it("400s on a missing date range", async () => {
    const res = await GET(new Request("http://x/api/reports"));
    expect(res.status).toBe(400);
  });

  it("403s an artist with no artistId (fail closed)", async () => {
    requireRole.mockResolvedValueOnce({
      id: "a1",
      email: "a@x",
      role: "ARTIST",
      displayName: "Artist",
      artistId: null,
    });
    const res = await GET(
      new Request("http://x/api/reports?from=2099-10-01&to=2099-10-31"),
    );
    expect(res.status).toBe(403);
  });

  it("403s an artist requesting another artist's artistId", async () => {
    requireRole.mockResolvedValueOnce({
      id: "a1",
      email: "a@x",
      role: "ARTIST",
      displayName: "Artist",
      artistId: "artist-self",
    });
    const res = await GET(
      new Request(
        "http://x/api/reports?from=2099-10-01&to=2099-10-31&artistId=artist-other",
      ),
    );
    expect(res.status).toBe(403);
  });

  it("allows an artist to query their own artistId", async () => {
    if (!(await dbReachable())) return;
    requireRole.mockResolvedValueOnce({
      id: "a1",
      email: "a@x",
      role: "ARTIST",
      displayName: "Artist",
      artistId: "artist-self",
    });
    const res = await GET(
      new Request(
        "http://x/api/reports?from=2099-10-01&to=2099-10-31&artistId=artist-self",
      ),
    );
    expect(res.status).toBe(200);
  });
});
