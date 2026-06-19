import { afterAll, describe, expect, it, vi } from "vitest";
import { closeTestDb, dbReachable } from "@/lib/services/testdb";

vi.mock("@/lib/auth", () => ({
  requireRole: vi.fn(async () => ({
    id: "u1",
    email: "o@x",
    role: "OWNER" as const,
    displayName: "Owner",
  })),
  getCurrentUser: vi.fn(async () => null),
}));

const { GET } = await import("./route");

describe("GET /api/reports (admin)", () => {
  afterAll(async () => {
    await closeTestDb();
  });

  it("returns an overview for a date range", async () => {
    if (!(await dbReachable())) return;
    const res = await GET(
      new Request(
        "http://x/api/reports?from=2099-10-01&to=2099-10-31",
      ),
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
});
