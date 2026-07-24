import { beforeEach, describe, expect, it, vi } from "vitest";

const finishAuthentication = vi.fn();
vi.mock("@bnb/core/auth/webauthn", () => ({
  finishAuthentication: (...args: unknown[]) => finishAuthentication(...args),
}));

import { POST } from "./route";

describe("POST /api/auth/authentication/verify", () => {
  beforeEach(() => finishAuthentication.mockReset());

  it("rejects a malformed body with 400", async () => {
    const res = await POST(
      new Request("http://kiosk/api/auth/authentication/verify", {
        method: "POST",
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 401 when the assertion fails verification", async () => {
    finishAuthentication.mockResolvedValue({ verified: false });
    const res = await POST(
      new Request("http://kiosk/api/auth/authentication/verify", {
        method: "POST",
        body: JSON.stringify({ response: { id: "cred" } }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it("returns verified on success", async () => {
    finishAuthentication.mockResolvedValue({ verified: true });
    const res = await POST(
      new Request("http://kiosk/api/auth/authentication/verify", {
        method: "POST",
        body: JSON.stringify({ response: { id: "cred" } }),
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ verified: true });
  });
});
