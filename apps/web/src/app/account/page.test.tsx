import { describe, expect, it, vi } from "vitest";

const getCustomerSession = vi.hoisted(() => vi.fn());
vi.mock("@/lib/customer-auth", () => ({ getCustomerSession }));
const redirect = vi.hoisted(() =>
  vi.fn((to: string) => {
    throw new Error(`redirect:${to}`);
  }),
);
vi.mock("next/navigation", () => ({ redirect }));

const { default: AccountPage } = await import("./page");

describe("AccountPage (/account)", () => {
  it("sends a signed-out visitor to sign-in", async () => {
    getCustomerSession.mockResolvedValueOnce(null);
    await expect(AccountPage()).rejects.toThrow("redirect:/account/sign-in");
  });

  it("sends a signed-in customer to their Bandit Pass", async () => {
    getCustomerSession.mockResolvedValueOnce({ customerId: "c1" });
    await expect(AccountPage()).rejects.toThrow("redirect:/passport");
  });
});
