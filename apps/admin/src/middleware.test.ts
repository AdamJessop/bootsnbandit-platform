import { describe, expect, it, beforeEach, vi } from "vitest";

/**
 * Admin auth guard. Verifies the cheap session-cookie presence check that keeps
 * signed-out browsers off the staff app shell while leaving /sign-in reachable,
 * and the sliding renewal that re-issues an ageing session cookie.
 */

type CookieJar = Record<string, string | undefined>;

function makeRequest(pathname: string, cookies: CookieJar = {}) {
  const url = new URL(`https://admin.example.com${pathname}`);
  return {
    nextUrl: Object.assign(url, {
      clone() {
        return new URL(url.toString());
      },
    }),
    cookies: {
      get(name: string) {
        const value = cookies[name];
        return value === undefined ? undefined : { value };
      },
    },
  };
}

const SECRET = "test-only-session-secret-that-is-long-enough-32+";

/** A real encrypted session token, minted `days` ago with the 30-day TTL. */
async function sessionMintedDaysAgo(days: number): Promise<string> {
  const { encodeSession } = await import("@bnb/core/auth/session");
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(Date.now() - days * 24 * 60 * 60 * 1000);
  try {
    return await encodeSession(
      {
        sub: "u1",
        email: "sarah@example.com",
        role: "OWNER",
        displayName: "Sarah",
      },
      60 * 60 * 24 * 30,
    );
  } finally {
    vi.useRealTimers();
  }
}

beforeEach(() => {
  vi.resetModules();
  delete process.env.SESSION_COOKIE;
});

describe("admin middleware auth guard", () => {
  it("redirects unauthenticated visitors to /sign-in", async () => {
    const { middleware } = await import("./middleware");
    const res = await middleware(makeRequest("/calendar") as never);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/sign-in");
  });

  it("lets the sign-in route through while signed out", async () => {
    const { middleware } = await import("./middleware");
    const res = await middleware(makeRequest("/sign-in") as never);
    // NextResponse.next() has no redirect Location header.
    expect(res.headers.get("location")).toBeNull();
  });

  it("lets CMS images under /media through while signed out", async () => {
    const { middleware } = await import("./middleware");
    const res = await middleware(makeRequest("/media/clx123abc") as never);
    expect(res.headers.get("location")).toBeNull();
  });

  it("only opens the /media segment, not look-alike paths", async () => {
    const { middleware } = await import("./middleware");
    const res = await middleware(makeRequest("/media-library") as never);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/sign-in");
  });

  it("lets an authenticated visitor through", async () => {
    const { middleware } = await import("./middleware");
    const res = await middleware(
      makeRequest("/calendar", { bb_session: "token" }) as never,
    );
    expect(res.headers.get("location")).toBeNull();
  });

  it("honours an env-overridden session cookie name", async () => {
    process.env.SESSION_COOKIE = "bnb_admin";
    const { middleware } = await import("./middleware");
    const res = await middleware(
      makeRequest("/calendar", { bnb_admin: "token" }) as never,
    );
    expect(res.headers.get("location")).toBeNull();
  });

  it("re-issues a valid session in the last half of its life (sliding renewal)", async () => {
    process.env.SESSION_SECRET = SECRET;
    const token = await sessionMintedDaysAgo(20);
    const { middleware } = await import("./middleware");
    const res = await middleware(
      makeRequest("/calendar", { bb_session: token }) as never,
    );
    expect(res.headers.get("location")).toBeNull();
    const cookie = res.cookies.get("bb_session");
    expect(cookie?.value).toBeTruthy();
    expect(cookie?.value).not.toBe(token);
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.maxAge).toBe(60 * 60 * 24 * 30);
    const { decodeSession } = await import("@bnb/core/auth/session");
    expect((await decodeSession(cookie!.value))?.sub).toBe("u1");
  });

  it("does not rewrite a fresh session cookie on every request", async () => {
    process.env.SESSION_SECRET = SECRET;
    const token = await sessionMintedDaysAgo(2);
    const { middleware } = await import("./middleware");
    const res = await middleware(
      makeRequest("/calendar", { bb_session: token }) as never,
    );
    expect(res.cookies.get("bb_session")).toBeUndefined();
  });

  it("lets an unreadable cookie through untouched (requireRole decides)", async () => {
    process.env.SESSION_SECRET = SECRET;
    const { middleware } = await import("./middleware");
    const res = await middleware(
      makeRequest("/calendar", { bb_session: "garbage" }) as never,
    );
    expect(res.headers.get("location")).toBeNull();
    expect(res.cookies.get("bb_session")).toBeUndefined();
  });

  it("excludes api + assets from the matcher", async () => {
    const { config } = await import("./middleware");
    expect(config.matcher[0]).toContain("api");
    expect(config.matcher[0]).toContain("sw.js");
  });

  it("excludes the brand logo so it loads on the sign-in screen", async () => {
    const { config } = await import("./middleware");
    expect(config.matcher[0]).toContain("bb-logo.png");
  });
});
