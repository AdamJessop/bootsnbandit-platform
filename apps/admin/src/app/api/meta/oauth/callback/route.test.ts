import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const requireRole = vi.fn();
const connectMetaPages = vi.fn();
const cookieGet = vi.fn();
const cookieDelete = vi.fn();

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: cookieGet, delete: cookieDelete, set: vi.fn() }),
}));
vi.mock("@bnb/core/auth", () => ({ requireRole: (...a: unknown[]) => requireRole(...a) }));
vi.mock("@bnb/core/services/channels/meta-oauth", () => ({
  META_STATE_COOKIE: "bb_meta_oauth_state",
  // Re-stated rather than imported: this module is mocked wholesale (the real
  // one reaches Prisma through channel-connections), and the real helper has
  // its own test in the core suite.
  metaRedirectUri: () =>
    `${(process.env.APP_ORIGIN ?? "").replace(/\/$/, "")}/api/meta/oauth/callback`,
  connectMetaPages: (...a: unknown[]) => connectMetaPages(...a),
}));

import { GET } from "./route";

const ORIGINAL = process.env.APP_ORIGIN;

function callback(query: Record<string, string>) {
  const url = new URL("https://admin.example.test/api/meta/oauth/callback");
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  return new Request(url, { method: "GET" });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.APP_ORIGIN = "https://admin.example.test";
  requireRole.mockResolvedValue({ id: "u1", role: "OWNER" });
  cookieGet.mockReturnValue({ value: "nonce-abc" });
  connectMetaPages.mockResolvedValue({
    connected: [{ id: "c1" }, { id: "c2" }],
    warnings: [],
  });
});

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.APP_ORIGIN;
  else process.env.APP_ORIGIN = ORIGINAL;
});

describe("GET /api/meta/oauth/callback", () => {
  it("connects the pages and redirects back with a count", async () => {
    const res = await GET(callback({ code: "CODE", state: "nonce-abc" }));
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/studio/channels?meta_connected=2");
    expect(requireRole).toHaveBeenCalledWith("OWNER");
    expect(cookieGet).toHaveBeenCalledWith("bb_meta_oauth_state");
    expect(connectMetaPages).toHaveBeenCalledWith({
      code: "CODE",
      redirectUri: "https://admin.example.test/api/meta/oauth/callback",
    });
    // The single-use nonce is spent whatever happened.
    expect(cookieDelete).toHaveBeenCalledWith("bb_meta_oauth_state");
  });

  it("sends no-store on every redirect", async () => {
    // A 302 with a flash in the query string must not sit in a shared cache.
    for (const res of [
      await GET(callback({ code: "CODE", state: "nonce-abc" })),
      await GET(callback({ code: "CODE", state: "wrong" })),
      await GET(callback({ error: "access_denied", state: "nonce-abc" })),
      await GET(callback({ state: "nonce-abc" })),
    ]) {
      expect(res.headers.get("cache-control")).toBe("no-store");
    }
  });

  it("never touches the code when the caller is not an owner", async () => {
    // requireRole redirects an artist (and a signed-out visitor) away; in a
    // route handler that surfaces as a throw.
    requireRole.mockRejectedValue(new Error("NEXT_REDIRECT:/"));
    await expect(
      GET(callback({ code: "CODE", state: "nonce-abc" })),
    ).rejects.toThrow(/NEXT_REDIRECT/);
    expect(connectMetaPages).not.toHaveBeenCalled();
    // The owner's pending nonce survives: a rejected caller must not be able
    // to burn the connect attempt that is genuinely in flight.
    expect(cookieDelete).not.toHaveBeenCalled();
  });

  it("refuses a mismatched or missing state without exchanging anything", async () => {
    const res = await GET(callback({ code: "CODE", state: "nonce-other" }));
    expect(res.headers.get("location")).toBe(
      "/studio/channels?meta_error=bad_state",
    );
    expect(connectMetaPages).not.toHaveBeenCalled();
    // NOT spent: the nonce belongs to the owner's real attempt, and anyone can
    // send this URL. Burning it on a forged call is a denial of service.
    expect(cookieDelete).not.toHaveBeenCalled();

    cookieGet.mockReturnValue(undefined);
    const res2 = await GET(callback({ code: "CODE", state: "nonce-abc" }));
    expect(res2.headers.get("location")).toBe(
      "/studio/channels?meta_error=bad_state",
    );
  });

  it("refuses a callback with no state at all", async () => {
    const res = await GET(callback({ code: "CODE" }));
    expect(res.headers.get("location")).toBe(
      "/studio/channels?meta_error=bad_state",
    );
    expect(connectMetaPages).not.toHaveBeenCalled();
  });

  it("checks the state before honouring Meta's error param", async () => {
    // `?error=access_denied` with no valid state is a forged request, not
    // Facebook: it must not burn the nonce, and it must not be believed.
    const res = await GET(callback({ error: "access_denied", state: "wrong" }));
    expect(res.headers.get("location")).toBe(
      "/studio/channels?meta_error=bad_state",
    );
    expect(cookieDelete).not.toHaveBeenCalled();
  });

  it("passes Meta's own cancellation through as a readable error", async () => {
    const res = await GET(
      callback({ error: "access_denied", state: "nonce-abc" }),
    );
    expect(res.headers.get("location")).toBe(
      "/studio/channels?meta_error=access_denied",
    );
    expect(connectMetaPages).not.toHaveBeenCalled();
  });

  it("does not reflect a hostile error slug into the redirect", async () => {
    const res = await GET(
      callback({
        error: '"><script>alert(1)</script>',
        state: "nonce-abc",
      }),
    );
    expect(res.headers.get("location")).toBe(
      "/studio/channels?meta_error=access_denied",
    );
  });

  it("reports a callback with neither code nor error", async () => {
    const res = await GET(callback({ state: "nonce-abc" }));
    expect(res.headers.get("location")).toBe(
      "/studio/channels?meta_error=no_code",
    );
    expect(connectMetaPages).not.toHaveBeenCalled();
  });

  it("reports a failed exchange instead of a 500", async () => {
    connectMetaPages.mockRejectedValue(new Error("Invalid verification code."));
    const res = await GET(callback({ code: "CODE", state: "nonce-abc" }));
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(
      "/studio/channels?meta_error=exchange_failed",
    );
  });

  it("names a too-short SESSION_SECRET rather than blaming Facebook", async () => {
    // The exchange succeeded; STORING the token failed. "exchange_failed"
    // would send the owner to check the redirect URI for hours.
    const { SecretConfigError } = await import("@bnb/core/services/secrets");
    connectMetaPages.mockRejectedValue(
      new SecretConfigError(
        "SESSION_SECRET must be at least 32 characters to store channel tokens.",
      ),
    );
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await GET(callback({ code: "CODE", state: "nonce-abc" }));
    spy.mockRestore();
    expect(res.headers.get("location")).toBe(
      "/studio/channels?meta_error=session_secret",
    );
  });

  it("never echoes the code or Graph's message back to the browser", async () => {
    connectMetaPages.mockRejectedValue(
      new Error("This authorization code has been used. token=EAAG_secret"),
    );
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await GET(callback({ code: "SECRET_CODE", state: "nonce-abc" }));
    const location = res.headers.get("location") ?? "";
    expect(location).not.toContain("SECRET_CODE");
    expect(location).not.toContain("EAAG_secret");
    expect(location).not.toContain("authorization code");
    spy.mockRestore();
  });

  it("carries a subscription warning back to the panel", async () => {
    connectMetaPages.mockResolvedValue({
      connected: [{ id: "c1" }],
      warnings: ["Boots 'n' Bandit: connected, but the webhook subscription failed — retry Connect."],
    });
    const res = await GET(callback({ code: "CODE", state: "nonce-abc" }));
    expect(res.headers.get("location")).toBe(
      "/studio/channels?meta_connected=1&meta_warning=subscribe_failed",
    );
  });

  it("says no pages were connected rather than claiming a subscription failure", async () => {
    connectMetaPages.mockResolvedValue({
      connected: [],
      warnings: ["That Facebook account manages no Pages this app can use…"],
    });
    const res = await GET(callback({ code: "CODE", state: "nonce-abc" }));
    expect(res.headers.get("location")).toBe(
      "/studio/channels?meta_error=no_pages",
    );
  });
});
