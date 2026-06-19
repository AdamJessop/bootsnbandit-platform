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
  /** Challenge lifetime in seconds (short-lived). */
  challengeTtlSeconds: number;
  /** Staff invite lifetime in seconds. */
  inviteTtlSeconds: number;
}

const SESSION_COOKIE = "bb_session";
const CHALLENGE_COOKIE = "bb_webauthn";

export function getAuthConfig(): AuthConfig {
  return {
    rpID: process.env.RP_ID || "localhost",
    rpName: "Boots 'n' Bandit",
    origin: process.env.APP_ORIGIN || "http://localhost:3000",
    sessionCookieName: SESSION_COOKIE,
    challengeCookieName: CHALLENGE_COOKIE,
    sessionTtlSeconds: 60 * 60 * 24 * 30, // 30 days
    challengeTtlSeconds: 60 * 5, // 5 minutes
    inviteTtlSeconds: 60 * 60 * 24 * 7, // 7 days
  };
}

/** Map a Prisma `Role` to the public `SessionRole`. Identity today, but the
 * single mapping point if the enums ever diverge. */
export function dbRoleToSessionRole(role: Role): SessionRole {
  return role === "OWNER" ? "OWNER" : "ARTIST";
}
