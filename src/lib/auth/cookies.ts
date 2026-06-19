import "server-only";
import { cookies } from "next/headers";
import { getAuthConfig } from "./config";
import { encodeSession, decodeSession, type SessionPayload } from "./session";

/**
 * Session-cookie read/write helpers. The cookie holds an encrypted JWE
 * (see session.ts); HttpOnly + SameSite=Lax + Secure (prod) keep it safe from
 * JS and CSRF on top-level navigations.
 */

export async function writeSessionCookie(
  payload: SessionPayload,
): Promise<void> {
  const cfg = getAuthConfig();
  const token = await encodeSession(payload, cfg.sessionTtlSeconds);
  const jar = await cookies();
  jar.set(cfg.sessionCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: cfg.sessionTtlSeconds,
  });
}

export async function readSessionCookie(): Promise<SessionPayload | null> {
  const cfg = getAuthConfig();
  const jar = await cookies();
  const raw = jar.get(cfg.sessionCookieName)?.value;
  if (!raw) return null;
  return decodeSession(raw);
}

export async function clearSessionCookie(): Promise<void> {
  const cfg = getAuthConfig();
  const jar = await cookies();
  jar.delete(cfg.sessionCookieName);
}

/** Write the short-lived challenge-handle cookie (opaque id, not the challenge). */
export async function writeChallengeCookie(handle: string): Promise<void> {
  const cfg = getAuthConfig();
  const jar = await cookies();
  jar.set(cfg.challengeCookieName, handle, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: cfg.challengeTtlSeconds,
  });
}

export async function readChallengeCookie(): Promise<string | null> {
  const cfg = getAuthConfig();
  const jar = await cookies();
  return jar.get(cfg.challengeCookieName)?.value ?? null;
}

export async function clearChallengeCookie(): Promise<void> {
  const cfg = getAuthConfig();
  const jar = await cookies();
  jar.delete(cfg.challengeCookieName);
}
