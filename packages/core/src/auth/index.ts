import "server-only";
import { redirect } from "next/navigation";
import { prisma } from "@bnb/core/db";
import { readSessionCookie } from "./cookies";
import { sessionPayloadToUser } from "./session";

/* CONTRACT (Phase 4 implements the bodies; Phase 6 imports these).
   Keep these exact signatures; add more files in src/lib/auth as needed. */
export type SessionRole = "OWNER" | "ARTIST";
export interface SessionUser {
  id: string;
  email: string;
  role: SessionRole;
  displayName: string;
  artistId?: string | null;
}

/**
 * Returns the signed-in staff user, or null. Sessions are stateless JWEs with
 * a 30-day TTL, so the user row is re-checked on every call (one PK lookup):
 * a deactivated or deleted staff member is signed out immediately, not when
 * their cookie expires. Fails closed — no row / inactive → null.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const payload = await readSessionCookie();
  if (!payload) return null;
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { active: true },
  });
  if (!user?.active) return null;
  return sessionPayloadToUser(payload);
}

/**
 * Asserts a signed-in user (optionally of a given role). Redirects to /sign-in
 * when unauthenticated; redirects an authenticated-but-wrong-role user to their
 * own area (env `AUTH_REDIRECT`, default `/`) rather than leaking the existence
 * of owner routes. Env-driven so each app can target its own home origin (P4).
 */
export async function requireRole(role?: SessionRole): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in");
  }
  if (role && user.role !== role) {
    // OWNER is a superset of ARTIST: an owner satisfies an ARTIST requirement.
    if (!(role === "ARTIST" && user.role === "OWNER")) {
      redirect(process.env.AUTH_REDIRECT || "/");
    }
  }
  return user;
}
