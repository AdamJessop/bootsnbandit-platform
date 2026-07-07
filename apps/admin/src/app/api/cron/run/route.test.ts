import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * /api/cron/run is guarded by the CRON_SECRET header. Wrong/absent secret
 * → 401 and no jobs run. Correct secret → runs all jobs and returns a summary.
 * Exposed as both POST (manual/system cron) and GET (Vercel Cron invokes GET).
 */

const runAllCron = vi.fn();
vi.mock("@bnb/core/cron", () => ({
  runAllCron: (...a: unknown[]) => runAllCron(...a),
}));

import { GET, POST } from "./route";

const ORIGINAL = process.env.CRON_SECRET;

beforeEach(() => {
  runAllCron.mockReset().mockResolvedValue({
    ranAt: "2026-06-19T00:00:00.000Z",
    jobs: [{ job: "reminders", sent: 1, skipped: 0 }],
    totalSent: 1,
    totalSkipped: 0,
  });
  process.env.CRON_SECRET = "s3cret";
});

afterEach(() => {
  process.env.CRON_SECRET = ORIGINAL;
});

function req(secret?: string, method = "POST") {
  return new Request("http://x/api/cron/run", {
    method,
    headers: secret ? { "x-cron-secret": secret } : {},
  });
}

describe("POST /api/cron/run", () => {
  it("401s without the secret and runs nothing", async () => {
    const res = await POST(req());
    expect(res.status).toBe(401);
    expect(runAllCron).not.toHaveBeenCalled();
  });

  it("401s with a wrong secret", async () => {
    const res = await POST(req("nope"));
    expect(res.status).toBe(401);
    expect(runAllCron).not.toHaveBeenCalled();
  });

  it("runs all jobs and returns the summary with the correct secret", async () => {
    const res = await POST(req("s3cret"));
    expect(res.status).toBe(200);
    expect(runAllCron).toHaveBeenCalledOnce();
    const body = (await res.json()) as { totalSent: number };
    expect(body.totalSent).toBe(1);
  });

  it("503s when CRON_SECRET is not configured", async () => {
    delete process.env.CRON_SECRET;
    const res = await POST(req("anything"));
    expect(res.status).toBe(503);
    expect(runAllCron).not.toHaveBeenCalled();
  });
});

describe("GET /api/cron/run (Vercel Cron)", () => {
  it("runs all jobs and returns the summary with the correct secret", async () => {
    const res = await GET(req("s3cret", "GET"));
    expect(res.status).toBe(200);
    expect(runAllCron).toHaveBeenCalledOnce();
    const body = (await res.json()) as { totalSent: number };
    expect(body.totalSent).toBe(1);
  });

  it("accepts the secret via Authorization: Bearer (Vercel's header)", async () => {
    const res = await GET(
      new Request("http://x/api/cron/run", {
        method: "GET",
        headers: { authorization: "Bearer s3cret" },
      }),
    );
    expect(res.status).toBe(200);
    expect(runAllCron).toHaveBeenCalledOnce();
  });

  it("401s with a wrong secret and runs nothing", async () => {
    const res = await GET(req("nope", "GET"));
    expect(res.status).toBe(401);
    expect(runAllCron).not.toHaveBeenCalled();
  });

  it("503s when CRON_SECRET is not configured", async () => {
    delete process.env.CRON_SECRET;
    const res = await GET(req("anything", "GET"));
    expect(res.status).toBe(503);
    expect(runAllCron).not.toHaveBeenCalled();
  });
});
