import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookieGet: vi.fn<(name: string) => { value: string } | undefined>(),
  redirect: vi.fn((href: string): never => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  }),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: mocks.cookieGet }),
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import {
  CUSTOMER_COOKIE,
  encodeCustomerSession,
} from "@bnb/core/auth/customer-session";
import { getCustomerSession, requireCustomer } from "./customer-auth";

beforeAll(() => {
  process.env.SESSION_SECRET ??=
    "test-session-secret-0123456789abcdef0123456789";
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getCustomerSession", () => {
  it("returns null when the cookie is absent", async () => {
    mocks.cookieGet.mockReturnValue(undefined);
    expect(await getCustomerSession()).toBeNull();
  });

  it("decodes a valid session cookie", async () => {
    const token = await encodeCustomerSession({
      sub: "cus_1",
      email: "jo@example.com",
      name: "Jo Bloggs",
    });
    mocks.cookieGet.mockImplementation((name) =>
      name === CUSTOMER_COOKIE ? { value: token } : undefined,
    );
    expect(await getCustomerSession()).toEqual({
      sub: "cus_1",
      email: "jo@example.com",
      name: "Jo Bloggs",
    });
    expect(mocks.cookieGet).toHaveBeenCalledWith(CUSTOMER_COOKIE);
  });

  it("returns null for a garbage token", async () => {
    mocks.cookieGet.mockReturnValue({ value: "not-a-jwe" });
    expect(await getCustomerSession()).toBeNull();
  });
});

describe("requireCustomer", () => {
  it("redirects to /account/sign-in when there is no session", async () => {
    mocks.cookieGet.mockReturnValue(undefined);
    await expect(requireCustomer()).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.redirect).toHaveBeenCalledWith("/account/sign-in");
  });

  it("returns the session when present", async () => {
    const token = await encodeCustomerSession({
      sub: "cus_2",
      email: "sam@example.com",
      name: "Sam Smith",
    });
    mocks.cookieGet.mockReturnValue({ value: token });
    const session = await requireCustomer();
    expect(session.sub).toBe("cus_2");
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
