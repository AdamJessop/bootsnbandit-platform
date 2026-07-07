import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Unit tests for the POST /api/enquiries guards: the CMS `enquiriesOpen`
 * toggle (403) and the per-IP rate limit (429). Prisma + the enquiry service
 * are mocked so no database is needed.
 */

const prisma = vi.hoisted(() => ({
  siteSettings: { findFirst: vi.fn() },
}));
const createEnquiry = vi.hoisted(() =>
  vi.fn(async (input: Record<string, unknown>) => ({
    id: "enq_1",
    source: "web",
    ...input,
  })),
);
vi.mock("@bnb/core/db", () => ({ prisma }));
vi.mock("@bnb/core/services/enquiries", () => ({ createEnquiry }));

const { POST } = await import("./route");

let ipCounter = 0;
function post(body: Record<string, unknown>, ip?: string): Promise<Response> {
  // A unique IP per request (unless pinned) keeps the module-scoped limiter
  // from bleeding between tests.
  const key = ip ?? `10.9.${++ipCounter}.1`;
  return POST(
    new Request("http://x/api/enquiries", {
      method: "POST",
      headers: { "x-forwarded-for": key },
      body: JSON.stringify(body),
    }),
  );
}

const LEAD = { contactName: "Gate Test", contactPhone: "07123456789" };

beforeEach(() => {
  prisma.siteSettings.findFirst.mockResolvedValue({ enquiriesOpen: true });
  createEnquiry.mockClear();
});

describe("POST /api/enquiries — enquiriesOpen gate", () => {
  it("403s with a clear JSON error when books are closed", async () => {
    prisma.siteSettings.findFirst.mockResolvedValue({ enquiriesOpen: false });
    const res = await post(LEAD);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("closed");
    expect(createEnquiry).not.toHaveBeenCalled();
  });

  it("creates the enquiry when books are open", async () => {
    const res = await post(LEAD);
    expect(res.status).toBe(201);
    expect(createEnquiry).toHaveBeenCalledOnce();
  });

  it("treats a missing settings row as open", async () => {
    prisma.siteSettings.findFirst.mockResolvedValue(null);
    const res = await post(LEAD);
    expect(res.status).toBe(201);
  });
});

describe("POST /api/enquiries — rate limit", () => {
  it("429s the 6th request from one IP inside the window", async () => {
    const ip = "203.0.113.77";
    for (let i = 0; i < 5; i++) {
      const res = await post(LEAD, ip);
      expect(res.status).toBe(201);
    }
    const blocked = await post(LEAD, ip);
    expect(blocked.status).toBe(429);
    const body = await blocked.json();
    expect(typeof body.error).toBe("string");
    // Other IPs are unaffected.
    expect((await post(LEAD)).status).toBe(201);
  });
});
