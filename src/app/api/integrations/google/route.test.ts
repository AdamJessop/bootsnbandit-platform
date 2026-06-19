import { describe, expect, it } from "vitest";
import { GET } from "./route";

/**
 * The Google Calendar connect endpoint is a documented stub for now: it returns
 * a "coming soon" payload describing the intended two-way OAuth sync. No real
 * OAuth happens yet.
 */
describe("GET /api/integrations/google (stub)", () => {
  it("returns a coming-soon status with the planned scope", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; sync: string };
    expect(body.status).toBe("coming_soon");
    expect(body.sync.toLowerCase()).toContain("two-way");
  });
});
