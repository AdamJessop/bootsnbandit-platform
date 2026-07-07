import { beforeEach, describe, expect, it, vi } from "vitest";

const getCustomerSession = vi.fn();
vi.mock("@/lib/customer-auth", () => ({
  getCustomerSession: (...a: unknown[]) => getCustomerSession(...a),
}));

const findUnique = vi.fn();
const update = vi.fn();
vi.mock("@bnb/core/db", () => ({
  prisma: {
    booking: {
      findUnique: (...a: unknown[]) => findUnique(...a),
      update: (...a: unknown[]) => update(...a),
    },
  },
}));

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (...a: unknown[]) => revalidatePath(...a),
}));

import { requestCancellationAction } from "./actions";

const SESSION = { sub: "cust_1", email: "c@example.com", name: "Cust" };

beforeEach(() => {
  vi.clearAllMocks();
  getCustomerSession.mockResolvedValue(SESSION);
  update.mockResolvedValue({});
});

describe("requestCancellationAction", () => {
  it("flags the customer's own upcoming booking", async () => {
    findUnique.mockResolvedValue({
      id: "b1",
      customerId: "cust_1",
      status: "confirmed",
      cancelRequestedAt: null,
    });
    const res = await requestCancellationAction("b1");
    expect(res).toEqual({ ok: true });
    expect(update).toHaveBeenCalledWith({
      where: { id: "b1" },
      data: { cancelRequestedAt: expect.any(Date) },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/passport");
  });

  it("rejects a booking belonging to another customer", async () => {
    findUnique.mockResolvedValue({
      id: "b2",
      customerId: "someone_else",
      status: "confirmed",
      cancelRequestedAt: null,
    });
    const res = await requestCancellationAction("b2");
    expect(res.ok).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it("is a no-op when a request is already pending", async () => {
    findUnique.mockResolvedValue({
      id: "b3",
      customerId: "cust_1",
      status: "confirmed",
      cancelRequestedAt: new Date(),
    });
    const res = await requestCancellationAction("b3");
    expect(res).toEqual({ ok: true });
    expect(update).not.toHaveBeenCalled();
  });

  it("rejects when signed out or booking unknown", async () => {
    getCustomerSession.mockResolvedValue(null);
    expect((await requestCancellationAction("b1")).ok).toBe(false);

    getCustomerSession.mockResolvedValue(SESSION);
    findUnique.mockResolvedValue(null);
    expect((await requestCancellationAction("missing")).ok).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });
});
