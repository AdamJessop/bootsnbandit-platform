import type { Role } from "@prisma/client";
import type { SessionRole } from "./index";

/**
 * Static auth configuration derived from environment. Pure + side-effect-free
 * so it can be unit-tested without a request context. RP ID / origin are pinned
 * via env (see `.env`) because WebAuthn is origin-bound; localhost defaults keep
 * dev frictionless.
 */
export interface AuthConfig {
  rpID: string;
  rpName: string;
  origin: string;
  sessionCookieName: string;
  /** WebAuthn challenge handle cookie (ties a browser to a pending ceremony). */
  challengeCookieName: string;
  /** Session lifetime in seconds. */
  sessionTtlSeconds: number;
  /**
   * Sliding renewal window: a request carrying a session with less than this
   * left re-issues it for a full `sessionTtlSeconds` (see `renewSessionToken`).
   */
  sessionRenewWithinSeconds: number;
  /** Challenge lifetime in seconds (short-lived). */
  challengeTtlSeconds: number;
  /** Staff invite lifetime in seconds. */
  inviteTtlSeconds: number;
}

const DEFAULT_SESSION_COOKIE = "bb_session";
const CHALLENGE_COOKIE = "bb_webauthn";

export function getAuthConfig(): AuthConfig {
  return {
    rpID: process.env.RP_ID || "localhost",
    rpName: "Boots 'n' Bandit",
    origin: process.env.APP_ORIGIN || "http://localhost:3000",
    // Env-driven so each app (web/admin) can scope its session cookie to its
    // own origin (P4 isolation). Defaults to the legacy name for the root app.
    sessionCookieName: process.env.SESSION_COOKIE || DEFAULT_SESSION_COOKIE,
    challengeCookieName: CHALLENGE_COOKIE,
    sessionTtlSeconds: 60 * 60 * 24 * 30, // 30 days
    sessionRenewWithinSeconds: 60 * 60 * 24 * 15, // 15 days
    challengeTtlSeconds: 60 * 5, // 5 minutes
    inviteTtlSeconds: 60 * 60 * 24 * 7, // 7 days
  };
}

export interface SessionCookieOptions {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: "/";
  maxAge: number;
}

/**
 * Attributes for the session cookie, shared by the sign-in write and the
 * middleware renewal so a renewed cookie is indistinguishable from a fresh one.
 * No `domain` — host-only, scoped to the app's own origin (P4).
 */
export function sessionCookieOptions(
  cfg: AuthConfig = getAuthConfig(),
): SessionCookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: cfg.sessionTtlSeconds,
  };
}

/** Map a Prisma `Role` to the public `SessionRole`. Identity today, but the
 * single mapping point if the enums ever diverge. */
export function dbRoleToSessionRole(role: Role): SessionRole {
  return role === "OWNER" ? "OWNER" : "ARTIST";
}
