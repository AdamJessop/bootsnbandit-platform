import {
  getAuthConfig,
  sessionCookieOptions,
  type SessionCookieOptions,
} from "./config";
import { renewSessionToken } from "./session";

/**
 * Sliding-session glue for app middleware (admin + reception). Edge-safe: no
 * `server-only`, no `next/headers`, no Prisma — the middleware owns the
 * request/response and just applies the cookie this returns.
 *
 * A reception tablet is signed in once and left on the desk; a fixed 30-day
 * session would sign it out mid-shift on day 30. Instead every request with a
 * session in the last half of its life gets a fresh 30-day cookie. In the
 * common case this is one decrypt and no write.
 */
export interface RenewedSessionCookie {
  name: string;
  value: string;
  options: SessionCookieOptions;
}

export async function renewedSessionCookie(
  token: string | undefined,
): Promise<RenewedSessionCookie | null> {
  if (!token) return null;
  const cfg = getAuthConfig();
  const value = await renewSessionToken(token, {
    ttlSeconds: cfg.sessionTtlSeconds,
    renewWithinSeconds: cfg.sessionRenewWithinSeconds,
  });
  if (!value) return null;
  return {
    name: cfg.sessionCookieName,
    value,
    options: sessionCookieOptions(cfg),
  };
}
