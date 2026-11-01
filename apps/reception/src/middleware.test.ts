import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Reception session renewal. The front-desk tablet stays signed in as long as
 * it is used: an ageing session cookie is re-issued for another 30 days, a
 * fresh one is left alone, and the middleware never redirects (pages guard
 * themselves with requireRole).
 */

const SECRET = "test-only-session-secret-that-is-long-enough-32+";
const DAY_MS = 24 * 60 * 60 * 1000;

function makeRequest(cookies: Record<string, string> = {}) {
  return {
    nextUrl: new URL("https://reception.example.com/"),
    cookies: {
      get(name: string) {
        const value = cookies[name];
        return value === undefined ? undefined : { value };
      },
    },
  };
}

async function sessionMintedDaysAgo(days: number): Promise<string> {
  const { encodeSession } = await import("@bnb/core/auth/session");
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(Date.now() - days * DAY_MS);
  try {
    return await encodeSession(
      {
        sub: "u1",
        email: "front@example.com",
        role: "ARTIST",
        displayName: "Front desk",
      },
      60 * 60 * 24 * 30,
    );
  } finally {
    vi.useRealTimers();
  }
}

beforeEach(() => {
  vi.resetModules();
  process.env.SESSION_SECRET = SECRET;
  process.env.SESSION_COOKIE = "bb_reception_session";
});

afterEach(() => {
  delete process.env.SESSION_COOKIE;
});

describe("reception middleware", () => {
  it("re-issues a session that is past the half-way mark", async () => {
    const token = await sessionMintedDaysAgo(25);
    const { middleware } = await import("./middleware");
    const res = await middleware(
      makeRequest({ bb_reception_session: token }) as never,
    );
    const cookie = res.cookies.get("bb_reception_session");
    expect(cookie?.value).toBeTruthy();
    expect(cookie?.value).not.toBe(token);
    expect(cookie?.maxAge).toBe(60 * 60 * 24 * 30);
  });

  it("leaves a fresh session alone", async () => {
    const token = await sessionMintedDaysAgo(1);
    const { middleware } = await import("./middleware");
    const res = await middleware(
      makeRequest({ bb_reception_session: token }) as never,
    );
    expect(res.cookies.get("bb_reception_session")).toBeUndefined();
  });

  it("never redirects a signed-out tablet", async () => {
    const { middleware } = await import("./middleware");
    const res = await middleware(makeRequest() as never);
    expect(res.headers.get("location")).toBeNull();
    expect(res.cookies.get("bb_reception_session")).toBeUndefined();
  });

  it("excludes api + assets from the matcher", async () => {
    const { config } = await import("./middleware");
    expect(config.matcher[0]).toContain("api");
    expect(config.matcher[0]).toContain("sw.js");
  });
});
