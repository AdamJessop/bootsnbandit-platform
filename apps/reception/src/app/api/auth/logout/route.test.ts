import { describe, expect, it, vi } from "vitest";

const clearSessionCookie = vi.fn();
vi.mock("@bnb/core/auth/cookies", () => ({
  clearSessionCookie: () => clearSessionCookie(),
}));

import { POST } from "./route";

describe("POST /api/auth/logout", () => {
  it("clears the kiosk session cookie", async () => {
    const res = await POST();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(clearSessionCookie).toHaveBeenCalled();
  });
});
