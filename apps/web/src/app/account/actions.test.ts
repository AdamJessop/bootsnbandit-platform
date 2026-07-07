import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookieSet: vi.fn(),
  cookieDelete: vi.fn(),
  clientIp: { value: "10.0.0.1" },
  redirect: vi.fn((href: string): never => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  }),
  signInCustomer: vi.fn(),
  redeemSetPasswordToken: vi.fn(),
  resendSetPasswordLink: vi.fn(),
  customerFindUnique: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ set: mocks.cookieSet, delete: mocks.cookieDelete }),
  headers: async () => new Headers({ "x-forwarded-for": mocks.clientIp.value }),
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@bnb/core/services/customer-auth", () => ({
  signInCustomer: mocks.signInCustomer,
  redeemSetPasswordToken: mocks.redeemSetPasswordToken,
}));
vi.mock("@bnb/core/services/customer-welcome", () => ({
  resendSetPasswordLink: mocks.resendSetPasswordLink,
}));
vi.mock("@bnb/core/db", () => ({
  prisma: { customer: { findUnique: mocks.customerFindUnique } },
}));

import {
  CUSTOMER_COOKIE,
  decodeCustomerSession,
} from "@bnb/core/auth/customer-session";
import { signInAction, signOutAction, setPasswordAction } from "./actions";

const initial = { error: null };

function formData(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

let ipCounter = 0;
function freshIp(): void {
  ipCounter += 1;
  mocks.clientIp.value = `10.0.${Math.floor(ipCounter / 250)}.${ipCounter % 250}`;
}

beforeAll(() => {
  process.env.SESSION_SECRET ??=
    "test-session-secret-0123456789abcdef0123456789";
  process.env.APP_ORIGIN = "https://web.example.test";
});

beforeEach(() => {
  vi.clearAllMocks();
  freshIp();
});

describe("signInAction", () => {
  it("rejects an invalid email without hitting the credential service", async () => {
    const res = await signInAction(
      initial,
      formData({ email: "not-an-email", password: "hunter22" }),
    );
    expect(res.error).toBeTruthy();
    expect(mocks.signInCustomer).not.toHaveBeenCalled();
  });

  it("returns a generic error for wrong credentials (no enumeration)", async () => {
    mocks.signInCustomer.mockResolvedValue(null);
    const res = await signInAction(
      initial,
      formData({ email: "jo@example.com", password: "wrongpass" }),
    );
    expect(res.error).toBe("Email or password is incorrect.");
    expect(mocks.cookieSet).not.toHaveBeenCalled();
  });

  it("sets the customer session cookie and redirects to /passport on success", async () => {
    mocks.signInCustomer.mockResolvedValue({
      id: "cus_1",
      name: "Jo Bloggs",
      email: "jo@example.com",
    });
    await expect(
      signInAction(
        initial,
        formData({ email: "jo@example.com", password: "hunter22" }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT:/passport");

    expect(mocks.cookieSet).toHaveBeenCalledTimes(1);
    const [name, token, opts] = mocks.cookieSet.mock.calls[0] as [
      string,
      string,
      Record<string, unknown>,
    ];
    expect(name).toBe(CUSTOMER_COOKIE);
    expect(opts).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      secure: false, // NODE_ENV !== "production" in tests
      path: "/",
      maxAge: 30 * 24 * 3600,
    });
    expect(await decodeCustomerSession(token)).toEqual({
      sub: "cus_1",
      email: "jo@example.com",
      name: "Jo Bloggs",
    });
  });

  it("rate-limits repeated attempts from the same client", async () => {
    mocks.signInCustomer.mockResolvedValue(null);
    for (let i = 0; i < 5; i += 1) {
      const res = await signInAction(
        initial,
        formData({ email: "jo@example.com", password: "wrongpass" }),
      );
      expect(res.error).toBe("Email or password is incorrect.");
    }
    const res = await signInAction(
      initial,
      formData({ email: "jo@example.com", password: "wrongpass" }),
    );
    expect(res.error).toMatch(/too many/i);
    expect(mocks.signInCustomer).toHaveBeenCalledTimes(5);
  });
});

describe("signOutAction", () => {
  it("deletes the session cookie and redirects home", async () => {
    await expect(signOutAction()).rejects.toThrow("NEXT_REDIRECT:/");
    expect(mocks.cookieDelete).toHaveBeenCalledWith(CUSTOMER_COOKIE);
  });
});

describe("setPasswordAction", () => {
  it("rejects a password under 8 characters without redeeming", async () => {
    const res = await setPasswordAction(
      initial,
      formData({ token: "tok_1", password: "short", confirm: "short" }),
    );
    expect(res.error).toMatch(/8 characters/i);
    expect(mocks.redeemSetPasswordToken).not.toHaveBeenCalled();
  });

  it("rejects mismatched passwords without redeeming", async () => {
    const res = await setPasswordAction(
      initial,
      formData({
        token: "tok_1",
        password: "longenough",
        confirm: "different1",
      }),
    );
    expect(res.error).toMatch(/match/i);
    expect(mocks.redeemSetPasswordToken).not.toHaveBeenCalled();
  });

  it("signs the customer in and redirects to /passport on success", async () => {
    mocks.redeemSetPasswordToken.mockResolvedValue({
      ok: true,
      customerId: "cus_9",
    });
    mocks.customerFindUnique.mockResolvedValue({
      id: "cus_9",
      name: "Sam Smith",
      email: "sam@example.com",
    });
    await expect(
      setPasswordAction(
        initial,
        formData({
          token: "tok_9",
          password: "longenough",
          confirm: "longenough",
        }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT:/passport");

    expect(mocks.redeemSetPasswordToken).toHaveBeenCalledWith(
      "tok_9",
      "longenough",
    );
    const [name, token] = mocks.cookieSet.mock.calls[0] as [string, string];
    expect(name).toBe(CUSTOMER_COOKIE);
    expect(await decodeCustomerSession(token)).toEqual({
      sub: "cus_9",
      email: "sam@example.com",
      name: "Sam Smith",
    });
  });

  it("falls back to sign-in when the redeemed customer row is missing", async () => {
    mocks.redeemSetPasswordToken.mockResolvedValue({
      ok: true,
      customerId: "cus_gone",
    });
    mocks.customerFindUnique.mockResolvedValue(null);
    await expect(
      setPasswordAction(
        initial,
        formData({
          token: "tok_x",
          password: "longenough",
          confirm: "longenough",
        }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT:/account/sign-in");
    expect(mocks.cookieSet).not.toHaveBeenCalled();
  });

  it("re-sends a fresh link for an expired token", async () => {
    mocks.redeemSetPasswordToken.mockResolvedValue({
      ok: false,
      reason: "expired",
      customerId: "cus_5",
    });
    const res = await setPasswordAction(
      initial,
      formData({
        token: "tok_old",
        password: "longenough",
        confirm: "longenough",
      }),
    );
    expect(mocks.resendSetPasswordLink).toHaveBeenCalledWith(
      "cus_5",
      "https://web.example.test",
    );
    expect(res.code).toBe("expired");
    expect(res.error).toMatch(/expired/i);
    expect(res.error).toMatch(/fresh one/i);
  });

  it("returns the invalid state for an unknown token", async () => {
    mocks.redeemSetPasswordToken.mockResolvedValue({
      ok: false,
      reason: "invalid",
    });
    const res = await setPasswordAction(
      initial,
      formData({
        token: "tok_bad",
        password: "longenough",
        confirm: "longenough",
      }),
    );
    expect(res.code).toBe("invalid");
    expect(res.error).toMatch(/isn't valid/i);
    expect(mocks.resendSetPasswordLink).not.toHaveBeenCalled();
  });

  it("rate-limits repeated attempts from the same client", async () => {
    mocks.redeemSetPasswordToken.mockResolvedValue({
      ok: false,
      reason: "invalid",
    });
    for (let i = 0; i < 5; i += 1) {
      await setPasswordAction(
        initial,
        formData({
          token: "tok_bad",
          password: "longenough",
          confirm: "longenough",
        }),
      );
    }
    const res = await setPasswordAction(
      initial,
      formData({
        token: "tok_bad",
        password: "longenough",
        confirm: "longenough",
      }),
    );
    expect(res.error).toMatch(/too many/i);
    expect(mocks.redeemSetPasswordToken).toHaveBeenCalledTimes(5);
  });
});
