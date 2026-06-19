import { afterAll, describe, expect, it, vi } from "vitest";
import { closeTestDb, dbReachable, testDb } from "@/lib/services/testdb";

const requireRole = vi.fn(async () => ({
  id: "u1",
  email: "o@x",
  role: "OWNER" as const,
  displayName: "Owner",
}));
vi.mock("@/lib/auth", () => ({
  requireRole,
  getCurrentUser: vi.fn(async () => null),
}));

const { GET, POST } = await import("./route");

describe("/api/customers (admin)", () => {
  const db = () => testDb();
  const customers: string[] = [];

  afterAll(async () => {
    if (customers.length)
      await db().customer.deleteMany({ where: { id: { in: customers } } });
    await closeTestDb();
  });

  it("POST creates a customer (requires a signed-in user)", async () => {
    if (!(await dbReachable())) return;
    requireRole.mockClear();
    const res = await POST(
      new Request("http://x/api/customers", {
        method: "POST",
        body: JSON.stringify({ name: "Route Cust", marketingConsent: true }),
      }),
    );
    expect(res.status).toBe(201);
    expect(requireRole).toHaveBeenCalled();
    const body = await res.json();
    customers.push(body.customer.id);
  });

  it("GET lists customers", async () => {
    if (!(await dbReachable())) return;
    const res = await GET(new Request("http://x/api/customers?take=3"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.customers)).toBe(true);
  });

  it("returns 401 when auth throws", async () => {
    requireRole.mockRejectedValueOnce(new Error("requireRole: unauthorized"));
    const res = await GET(new Request("http://x/api/customers"));
    expect(res.status).toBe(401);
  });
});
