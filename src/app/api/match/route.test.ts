import { afterAll, describe, expect, it } from "vitest";
import { closeTestDb, dbReachable } from "@bnb/core/services/testdb";
import { POST } from "./route";

describe("POST /api/match (public)", () => {
  afterAll(async () => {
    await closeTestDb();
  });

  it("returns ranked results for a valid answer set", async () => {
    if (!(await dbReachable())) return;
    const req = new Request("http://x/api/match", {
      method: "POST",
      body: JSON.stringify({
        vibe: "fine",
        subject: "floral",
        colour: "bw",
        exp: "first",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.results)).toBe(true);
    expect(body.results.length).toBeGreaterThan(0);
    expect(body.results[0].rank).toBe(0);
  });

  it("400s on invalid enum value", async () => {
    const req = new Request("http://x/api/match", {
      method: "POST",
      body: JSON.stringify({ vibe: "nonsense" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
