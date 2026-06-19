import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Unit tests for POST /api/reviews. The prisma client is mocked so these run
 * without a database: we assert token validation, status mapping, and the
 * submitted review shape.
 */

const findUnique = vi.fn();
const update = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    review: {
      findUnique: (...args: unknown[]) => findUnique(...args),
      update: (...args: unknown[]) => update(...args),
    },
  },
}));

import { POST } from "./route";

function post(body: unknown): Request {
  return new Request("http://x/api/reviews", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

afterEach(() => {
  findUnique.mockReset();
  update.mockReset();
});

describe("POST /api/reviews", () => {
  it("400s on an invalid body (rating out of range)", async () => {
    const res = await POST(post({ token: "t1", rating: 9 }));
    expect(res.status).toBe(400);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("404s when the token maps to no review", async () => {
    findUnique.mockResolvedValue(null);
    const res = await POST(post({ token: "nope", rating: 5 }));
    expect(res.status).toBe(404);
  });

  it("409s when the review was already submitted", async () => {
    findUnique.mockResolvedValue({
      id: "r1",
      token: "t1",
      status: "submitted",
    });
    const res = await POST(post({ token: "t1", rating: 5 }));
    expect(res.status).toBe(409);
    expect(update).not.toHaveBeenCalled();
  });

  it("submits a pending review and returns 201", async () => {
    findUnique.mockResolvedValue({ id: "r1", token: "t1", status: "pending" });
    update.mockResolvedValue({ id: "r1", status: "submitted", rating: 5 });
    const res = await POST(post({ token: "t1", rating: 5, body: "great work" }));
    expect(res.status).toBe(201);
    const arg = update.mock.calls[0][0] as {
      where: { id: string };
      data: { rating: number; body: string; status: string };
    };
    expect(arg.where).toEqual({ id: "r1" });
    expect(arg.data.rating).toBe(5);
    expect(arg.data.body).toBe("great work");
    expect(arg.data.status).toBe("submitted");
  });
});
