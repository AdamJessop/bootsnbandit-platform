import { beforeEach, describe, expect, it, vi } from "vitest";

const startAuthentication = vi.fn();
vi.mock("@bnb/core/auth/webauthn", () => ({
  startAuthentication: (...args: unknown[]) => startAuthentication(...args),
}));

import { POST } from "./route";

describe("POST /api/auth/authentication/options", () => {
  beforeEach(() => startAuthentication.mockReset());

  it("rejects a missing/invalid email with 400", async () => {
    const res = await POST(
      new Request("http://kiosk/api/auth/authentication/options", {
        method: "POST",
        body: JSON.stringify({ email: "not-an-email" }),
      }),
    );
    expect(res.status).toBe(400);
    expect(startAuthentication).not.toHaveBeenCalled();
  });

  it("returns the assertion options for a valid email", async () => {
    startAuthentication.mockResolvedValue({ challenge: "abc" });
    const res = await POST(
      new Request("http://kiosk/api/auth/authentication/options", {
        method: "POST",
        body: JSON.stringify({ email: "staff@bnb.studio" }),
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ challenge: "abc" });
    expect(startAuthentication).toHaveBeenCalledWith("staff@bnb.studio");
  });
});
