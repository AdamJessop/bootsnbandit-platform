import { describe, it, expect, afterEach } from "vitest";
import {
  getAuthConfig,
  dbRoleToSessionRole,
  sessionCookieOptions,
} from "./config";

const ORIG = { ...process.env };

afterEach(() => {
  process.env = { ...ORIG };
});

describe("auth config", () => {
  it("reads RP_ID / APP_ORIGIN from env", () => {
    process.env.RP_ID = "localhost";
    process.env.APP_ORIGIN = "http://localhost:3000";
    const cfg = getAuthConfig();
    expect(cfg.rpID).toBe("localhost");
    expect(cfg.origin).toBe("http://localhost:3000");
    expect(cfg.rpName).toBeTruthy();
    expect(cfg.sessionCookieName).toBeTruthy();
  });

  it("falls back to sane localhost defaults when env is missing", () => {
    delete process.env.RP_ID;
    delete process.env.APP_ORIGIN;
    const cfg = getAuthConfig();
    expect(cfg.rpID).toBe("localhost");
    expect(cfg.origin).toBe("http://localhost:3000");
  });

  it("renews sessions inside the last half of their 30-day life", () => {
    const cfg = getAuthConfig();
    expect(cfg.sessionTtlSeconds).toBe(60 * 60 * 24 * 30);
    expect(cfg.sessionRenewWithinSeconds).toBe(60 * 60 * 24 * 15);
  });

  it("builds host-only HttpOnly session cookie options", () => {
    process.env = { ...process.env, NODE_ENV: "production" };
    const opts = sessionCookieOptions();
    expect(opts).toEqual({
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    expect(opts).not.toHaveProperty("domain");
  });

  it("maps Prisma Role to SessionRole", () => {
    expect(dbRoleToSessionRole("OWNER")).toBe("OWNER");
    expect(dbRoleToSessionRole("ARTIST")).toBe("ARTIST");
  });
});
