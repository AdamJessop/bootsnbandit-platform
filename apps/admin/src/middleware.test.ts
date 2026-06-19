import { describe, expect, it, beforeEach, vi } from "vitest";

/**
 * Admin auth guard. Verifies the cheap session-cookie presence check that keeps
 * signed-out browsers off the staff app shell while leaving /sign-in reachable.
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

beforeEach(() => {
  vi.resetModules();
  delete process.env.SESSION_COOKIE;
});

describe("admin middleware auth guard", () => {
  it("redirects unauthenticated visitors to /sign-in", async () => {
    const { middleware } = await import("./middleware");
    const res = middleware(makeRequest("/calendar") as never);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/sign-in");
  });

  it("lets the sign-in route through while signed out", async () => {
    const { middleware } = await import("./middleware");
    const res = middleware(makeRequest("/sign-in") as never);
    // NextResponse.next() has no redirect Location header.
    expect(res.headers.get("location")).toBeNull();
  });

  it("lets an authenticated visitor through", async () => {
    const { middleware } = await import("./middleware");
    const res = middleware(
      makeRequest("/calendar", { bb_session: "token" }) as never,
    );
    expect(res.headers.get("location")).toBeNull();
  });

  it("honours an env-overridden session cookie name", async () => {
    process.env.SESSION_COOKIE = "bnb_admin";
    const { middleware } = await import("./middleware");
    const res = middleware(
      makeRequest("/calendar", { bnb_admin: "token" }) as never,
    );
    expect(res.headers.get("location")).toBeNull();
  });

  it("excludes api + assets from the matcher", async () => {
    const { config } = await import("./middleware");
    expect(config.matcher[0]).toContain("api");
    expect(config.matcher[0]).toContain("sw.js");
  });
});
