import { describe, it, expect, beforeAll } from "vitest";
import {
  CUSTOMER_COOKIE,
  encodeCustomerSession,
  decodeCustomerSession,
  type CustomerSessionPayload,
} from "./customer-session";

const SECRET = "test-only-session-secret-that-is-long-enough-32+";

beforeAll(() => {
  process.env.SESSION_SECRET = SECRET;
});

const payload: CustomerSessionPayload = {
  sub: "cust_123",
  email: "collector@example.com",
  name: "A. Collector",
};

describe("customer session encode/decode", () => {
  it("exports a customer-specific cookie name distinct from staff", () => {
    expect(CUSTOMER_COOKIE).toBe("bb_customer_session");
  });

  it("round-trips a payload through an encrypted token", async () => {
    const token = await encodeCustomerSession(payload);
    expect(token.split(".")).toHaveLength(5);

    const decoded = await decodeCustomerSession(token);
    expect(decoded).toEqual(payload);
  });

  it("returns null for a tampered/garbage token", async () => {
    expect(await decodeCustomerSession("garbage")).toBeNull();
    const token = await encodeCustomerSession(payload);
    expect(await decodeCustomerSession(token.slice(0, -3) + "xyz")).toBeNull();
  });

  it("rejects a STAFF session token (different key derivation)", async () => {
    const { encodeSession } = await import("./session");
    const staffToken = await encodeSession({
      sub: "user_1",
      email: "owner@example.com",
      role: "OWNER",
      displayName: "Owner",
      artistId: null,
    });
    expect(await decodeCustomerSession(staffToken)).toBeNull();
  });
});
