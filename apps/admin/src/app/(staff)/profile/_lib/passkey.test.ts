import { describe, expect, it, vi } from "vitest";
import { enrolPasskey, type EnrolPasskeyDeps } from "./passkey";

const OPTIONS = { challenge: "abc" };
const ATTESTATION = { id: "cred-1", response: {} };

function deps(overrides: Partial<EnrolPasskeyDeps> = {}): EnrolPasskeyDeps {
  return {
    post: vi.fn(async (url: string) =>
      url.endsWith("/options")
        ? Response.json(OPTIONS)
        : Response.json({ verified: true }),
    ),
    register: vi.fn(async () => ATTESTATION),
    ...overrides,
  };
}

describe("enrolPasskey", () => {
  it("runs options → register → verify and passes the device name", async () => {
    const d = deps();
    const res = await enrolPasskey(d, "My iPhone");
    expect(res).toEqual({ ok: true });
    expect(d.post).toHaveBeenNthCalledWith(
      1,
      "/api/auth/registration/options",
      {},
    );
    expect(d.register).toHaveBeenCalledWith(OPTIONS);
    expect(d.post).toHaveBeenNthCalledWith(2, "/api/auth/registration/verify", {
      response: ATTESTATION,
      deviceName: "My iPhone",
    });
  });

  it("omits an empty device name", async () => {
    const d = deps();
    await enrolPasskey(d, "  ");
    expect(d.post).toHaveBeenNthCalledWith(2, "/api/auth/registration/verify", {
      response: ATTESTATION,
      deviceName: undefined,
    });
  });

  it("surfaces an options failure without calling the authenticator", async () => {
    const d = deps({
      post: vi.fn(async () => new Response(null, { status: 401 })),
    });
    const res = await enrolPasskey(d);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/sign in/i);
    expect(d.register).not.toHaveBeenCalled();
  });

  it("surfaces a verify failure", async () => {
    const d = deps({
      post: vi.fn(async (url: string) =>
        url.endsWith("/options")
          ? Response.json(OPTIONS)
          : new Response(null, { status: 400 }),
      ),
    });
    const res = await enrolPasskey(d);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/could not register/i);
  });

  it("catches an authenticator cancel/error", async () => {
    const d = deps({
      register: vi.fn(async () => {
        throw new Error("The operation was aborted");
      }),
    });
    const res = await enrolPasskey(d);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/aborted/i);
  });
});
