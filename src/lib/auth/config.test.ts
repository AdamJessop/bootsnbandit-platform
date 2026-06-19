import { describe, it, expect, afterEach } from "vitest";
import { getAuthConfig, dbRoleToSessionRole } from "./config";

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

  it("maps Prisma Role to SessionRole", () => {
    expect(dbRoleToSessionRole("OWNER")).toBe("OWNER");
    expect(dbRoleToSessionRole("ARTIST")).toBe("ARTIST");
  });
});
